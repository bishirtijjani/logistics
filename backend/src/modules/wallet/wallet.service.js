/**
 * Wallet service - core financial operations.
 *
 * CRITICAL RULES:
 * 1. EVERY balance mutation MUST happen inside a Prisma transaction
 * 2. EVERY balance mutation MUST create a corresponding Transaction record
 * 3. NEVER update balance without recording balanceBefore and balanceAfter
 * 4. ALWAYS check for sufficient balance INSIDE the transaction (not before)
 * 5. Use reference-based idempotency to prevent duplicate operations
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const katpayService = require('../../services/katpay.service');
const notifyService = require('../../services/notify.service');
const settingsService = require('../../services/settings.service');
const { Queue } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, PAYMENT_JOBS, DEFAULT_JOB_OPTIONS } = require('../../queues/jobs');

const paymentQueue = new Queue(QUEUES.PAYMENT, { connection: redis });

// Bank name lookup cache: "bankCode|accountNumber" → name, TTL 6h
const LOOKUP_CACHE_TTL = 6 * 60 * 60; // seconds

/**
 * Get wallet balance and details for a user.
 */
const getWallet = async (userId) => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: {
      id: true,
      balance: true,
      virtualAccountNumber: true,
      virtualAccountBank: true,
      virtualAccountName: true,
      isLocked: true,
    },
  });

  if (!wallet) throw AppError.notFound('Wallet not found');
  return wallet;
};

/**
 * Withdraw to bank account - atomic debit + queue disbursement.
 *
 * A "transfer to any bank account" is the same financial operation as a
 * withdrawal (debit the wallet, queue a KatPay payout to a NUBAN); the only
 * difference is how it reads to the user. `opts.kind === 'transfer'` flavours
 * the reference, ledger description, metadata and notification copy without
 * forking the payout/reversal/retry machinery - the payment worker keys off
 * `reference`/`status` and the WITHDRAWAL type, so transfers ride the exact
 * same rails (including the failed-payout retry path) for free.
 */
const withdrawToBank = async (userId, { bankCode, bankName, accountNumber, accountName, amount }, opts = {}) => {
  const isTransfer = opts.kind === 'transfer';
  const reference = `${isTransfer ? 'TRF' : 'WIT'}-${uuidv4()}`;

  const feeFlat = await settingsService.getSetting('wallet.withdrawalFee', 20);
  const feePayer = await settingsService.getSetting('wallet.withdrawalFeePayer', 'PLATFORM');
  const fee = feePayer === 'USER' ? Number(feeFlat) : 0;
  const totalDebit = amount + fee;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');
    if (wallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    const balance = Number(wallet.balance);
    // Conditional debit so concurrent withdrawals can't overdraw (the WHERE runs
    // under the UPDATE's row lock; a read-then-decrement overdraws under READ
    // COMMITTED and would dispatch a real payout for money the user never had).
    const debit = await tx.wallet.updateMany({
      where: { id: wallet.id, isLocked: false, balance: { gte: totalDebit } },
      data: { balance: { decrement: totalDebit } },
    });
    if (debit.count !== 1) throw AppError.insufficientBalance();

    await tx.transaction.create({
      data: {
        reference,
        type: 'WITHDRAWAL',
        status: 'PROCESSING',
        amount,
        fee,
        description: isTransfer
          ? `Transfer to ${accountName || accountNumber}`
          : `Withdrawal to ${bankName || bankCode} - ${accountNumber}`,
        debitWalletId: wallet.id,
        provider: 'KATPAY',
        metadata: { bankCode, bankName, accountNumber, accountName, fee, ...(isTransfer ? { kind: 'transfer' } : {}) },
        balanceBefore: balance,
        balanceAfter: balance - totalDebit,
      },
    });

    return { walletId: wallet.id, transactionRef: reference, amount, fee, totalDebit, newBalance: balance - totalDebit, status: 'PROCESSING' };
  });

  // The debit has committed. If we can't enqueue the payout job, the funds would
  // be stranded in PROCESSING forever (no payout, no refund), so compensate by
  // reversing the debit before surfacing the error.
  try {
    await paymentQueue.add(
      PAYMENT_JOBS.PROCESS_WITHDRAWAL,
      { transactionId: reference, bankCode, accountNumber, accountName, amount, userId },
      DEFAULT_JOB_OPTIONS,
    );
  } catch (enqueueErr) {
    // CAUTION: paymentQueue.add can reject AFTER the job was actually persisted
    // (lost ack), in which case the worker will dispatch the payout. So only
    // reverse if the row is STILL PROCESSING (the worker claims PROCESSING→SENT
    // before paying) - winning that compare-and-set means the cash has NOT and
    // will NOT go out. If we lose it, the worker owns the outcome; do nothing.
    logger.error('Failed to enqueue withdrawal payout - reversing if not yet dispatched', { reference, error: enqueueErr.message });
    const reversed = await prisma.$transaction(async (tx) => {
      const claim = await tx.transaction.updateMany({
        where: { reference, status: 'PROCESSING' },
        data: { status: 'FAILED' },
      });
      if (claim.count !== 1) return false;
      await tx.wallet.update({ where: { id: result.walletId }, data: { balance: { increment: totalDebit } } });
      await tx.transaction.create({
        data: {
          reference: `REF-${reference}`,
          type: 'REFUND',
          status: 'COMPLETED',
          amount: totalDebit,
          description: 'Withdrawal reversed - could not queue payout',
          creditWalletId: result.walletId,
          provider: 'KATPAY',
        },
      });
      return true;
    }).catch((e) => {
      // REF row already exists (worker refunded) → P2002 rolls back; worker owns it.
      logger.warn('Withdrawal reversal skipped - already handled', { reference, error: e.message });
      return false;
    });
    if (reversed) {
      throw AppError.internal('Could not start withdrawal - your balance was not affected. Please try again.');
    }
    throw AppError.internal('Your withdrawal is processing - please check your wallet shortly.');
  }

  logger.info(`${isTransfer ? 'Transfer' : 'Withdrawal'} initiated`, { userId, amount, reference });

  const freshWallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
  notifyService.balanceUpdated(userId, { balance: Number(freshWallet.balance) });

  // Notification: the payout is PROCESSING here. We surface an "initiated"
  // entry; the payment worker will create another row when the payout clears.
  notifyService.onWalletEvent(userId, {
    kind: 'WALLET',
    amount,
    transactionId: reference,
    route: '/wallet',
    description: isTransfer
      ? `Transfer of ₦${Number(amount).toLocaleString('en-NG')} to ${accountName || accountNumber} initiated`
      : `Withdrawal of ₦${Number(amount).toLocaleString('en-NG')} initiated`,
  }).catch((err) => logger.warn(`${isTransfer ? 'Transfer' : 'Withdrawal'}-initiated notification failed`, { error: err.message }));

  return result;
};

/**
 * Transfer wallet funds to any bank account. Thin alias over `withdrawToBank` -
 * see that function for why the two share a rail.
 */
const transferToBank = (userId, params) => withdrawToBank(userId, params, { kind: 'transfer' });

/**
 * Process wallet funding from KatPay webhook.
 * Uses reference-based idempotency - safe to call multiple times.
 */
const fundWallet = async ({ accountNumber, amount, reference, metadata }) => {
  const existing = await prisma.transaction.findUnique({ where: { reference } });
  if (existing) {
    logger.warn('Duplicate funding attempt', { reference });
    return existing;
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { virtualAccountNumber: accountNumber } });
    if (!wallet) throw AppError.notFound('Wallet not found for account number');

    const currentBalance = Number(wallet.balance);

    const feePercent = await settingsService.getSetting('wallet.fundingFeePercent', 1);
    const feePayer = await settingsService.getSetting('wallet.fundingFeePayer', 'PLATFORM');
    const fee = feePayer === 'USER' ? (amount * Number(feePercent)) / 100 : 0;
    const creditAmount = amount - fee;

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: creditAmount } } });

    const transaction = await tx.transaction.create({
      data: {
        reference,
        type: 'WALLET_FUNDING',
        status: 'COMPLETED',
        amount: creditAmount,
        fee,
        description: 'Wallet funding via bank transfer',
        creditWalletId: wallet.id,
        provider: 'KATPAY',
        providerRef: reference,
        metadata: { ...metadata, originalAmount: amount, fee },
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + creditAmount,
      },
    });

    return { transaction, wallet, creditAmount, fee, newBalance: currentBalance + creditAmount };
  });

  logger.info('Wallet funded', { accountNumber, amount, reference, fee: result.fee });

  // Live wallet-balance nudge + Notification Center row + push.
  const ownerWallet = await prisma.wallet.findUnique({ where: { virtualAccountNumber: accountNumber }, select: { userId: true, balance: true } });
  if (ownerWallet) {
    notifyService.balanceUpdated(ownerWallet.userId, { balance: Number(ownerWallet.balance) });
    notifyService.fundingReceived(ownerWallet.userId, { amount: result.creditAmount, reference });
    notifyService.onWalletEvent(ownerWallet.userId, {
      kind: 'FUNDING',
      amount: result.creditAmount,
      transactionId: reference,
      route: '/wallet',
    }).catch((err) => logger.warn('FUNDING notification failed', { error: err.message }));
  }

  return result.transaction;
};

/**
 * Get paginated transaction history for a user.
 */
const getTransactionHistory = async (userId, { page, limit, type, startDate, endDate, q }) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw AppError.notFound('Wallet not found');

  // Search collapses to (matches user's wallet) AND (search term hits ref/desc).
  // Keeping the wallet-membership clause in AND guarantees we never leak rows
  // belonging to another user even if `q` accidentally matches their reference.
  const walletClause = {
    OR: [{ debitWalletId: wallet.id }, { creditWalletId: wallet.id }],
  };

  const where = {
    AND: [
      walletClause,
      ...(q
        ? [{
            OR: [
              { reference: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }]
        : []),
    ],
    ...(type && { type }),
    ...(startDate && endDate && { createdAt: { gte: startDate, lte: endDate } }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, page, limit };
};

/**
 * Bank account name lookup (cached 6h on success).
 *
 * KatPay has no name-enquiry endpoint, so we resolve against Paystack's free
 * `/bank/resolve` (works on test keys, before business approval). `bankCode` is
 * the KatPay code the dashboards use; the Paystack service maps it across.
 *
 * Verification is ADVISORY: this never throws and never 500s. On success it
 * returns the resolved name with `resolved: true`; if Paystack is unconfigured,
 * the bank is unsupported, or the account can't be resolved, it returns
 * `resolved: false` so callers fall back to a user-typed name. (The customer +
 * rider withdraw screens also call this and must keep working.)
 */
const lookupBankAccount = async ({ bankCode, accountNumber }) => {
  const cacheKey = `bank:lookup:${bankCode}:${accountNumber}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  const paystackService = require('../../services/paystack.service');
  let result;
  try {
    const r = await paystackService.resolveAccountName({ accountNumber, bankCode });
    result = { accountName: r.accountName, accountNumber, bankCode, resolved: true };
  } catch (err) {
    return { accountName: null, accountNumber, bankCode, resolved: false, reason: err.message };
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', LOOKUP_CACHE_TTL);
  } catch (_) {}

  return result;
};

/**
 * Initiate a one-time KatPay transfer payment for ad-hoc wallet top-ups.
 */
const initiateTransferPaymentFunding = async (userId, { amount }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true, phone: true },
  });
  if (!user) throw AppError.notFound('User not found');

  const providerRef = `TOPUP-${uuidv4()}`;
  const result = await katpayService.initiateTransferPayment({
    amount,
    customer: { email: user.email, name: `${user.firstName} ${user.lastName}`, phone: user.phone },
    merchant_reference: providerRef, // KatPay API field name - do not rename the key
    metadata: { userId, purpose: 'WALLET_TOPUP' },
  });

  logger.info('Transfer payment funding initiated', { userId, amount, providerRef });
  return result;
};

// ─── Saved Beneficiaries ──────────────────────────────────────────────────────

const getBeneficiaries = async (userId) => {
  return prisma.savedBeneficiary.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

const addBeneficiary = async (userId, { name, phone, bankCode, accountNumber, accountName }) => {
  // Idempotent: if the user already has a row for this bank+account (or
  // phone), return the existing one instead of throwing P2002. This
  // matches the rider-app's "save as beneficiary" UX where every
  // successful withdraw may auto-save the same account. Phase 6.
  if (bankCode && accountNumber) {
    const existing = await prisma.savedBeneficiary.findUnique({
      where: {
        userId_accountNumber_bankCode: { userId, accountNumber, bankCode },
      },
    });
    if (existing) {
      // Refresh display name / account name if it changed.
      const updates = {};
      if (accountName && existing.accountName !== accountName) updates.accountName = accountName;
      if (name && existing.name !== name) updates.name = name;
      if (Object.keys(updates).length === 0) return existing;
      return prisma.savedBeneficiary.update({ where: { id: existing.id }, data: updates });
    }
  }
  if (phone) {
    const existing = await prisma.savedBeneficiary.findUnique({
      where: { userId_phone: { userId, phone } },
    });
    if (existing) return existing;
  }
  return prisma.savedBeneficiary.create({
    data: { userId, name, phone, bankCode, accountNumber, accountName },
  });
};

const deleteBeneficiary = async (userId, beneficiaryId) => {
  const b = await prisma.savedBeneficiary.findUnique({ where: { id: beneficiaryId } });
  if (!b || b.userId !== userId) throw AppError.notFound('Beneficiary not found');
  await prisma.savedBeneficiary.delete({ where: { id: beneficiaryId } });
};

/**
 * Get a single transaction receipt for a user.
 */
const getTransactionReceipt = async (userId, transactionId) => {
  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      OR: [{ debitWalletId: { in: await _walletIdForUser(userId) } }, { creditWalletId: { in: await _walletIdForUser(userId) } }],
    },
  });
  if (!tx) throw AppError.notFound('Transaction not found');
  return tx;
};

const _walletIdForUser = async (userId) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { id: true } });
  return wallet ? [wallet.id] : [];
};

/**
 * Re-enqueue a virtual-account provisioning job for a user whose wallet has no
 * NUBAN yet (KatPay was down/misconfigured at signup, or a legacy account that
 * predates signup-time provisioning). Requires a phone on file - no BVN/NIN.
 * Throttled per-user via Redis so the client can't spam KatPay.
 *
 * Worker handler is idempotent - short-circuits if accountNumber already set.
 */
const retryVirtualAccountProvisioning = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user) throw AppError.notFound('User not found');
  if (user.wallet?.virtualAccountNumber) {
    return { alreadyProvisioned: true };
  }

  // KatPay mints the NUBAN under the user's phone - no BVN/NIN needed. Phone is
  // required at signup, so it's normally present. Legacy accounts created before
  // that requirement may have none: signal the client to capture one (the
  // one-time phone-capture screen) and then call this again.
  if (!user.phone) {
    throw AppError.badRequest(
      'Add your phone number to activate your wallet account.',
      { code: 'PHONE_REQUIRED' },
    );
  }
  const phoneNumber = user.phone;

  // 30s throttle keyed by user - generous enough to absorb screen mounts +
  // pull-to-refreshes while still letting a user manually retry.
  const throttleKey = `wallet:provision:retry:${userId}`;
  const acquired = await redis.set(throttleKey, '1', 'EX', 30, 'NX');
  if (!acquired) {
    throw AppError.tooManyRequests('A provisioning attempt is already in progress. Please wait a moment.');
  }

  await paymentQueue.add(
    PAYMENT_JOBS.PROVISION_VIRTUAL_ACCOUNT,
    {
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      phoneNumber,
    },
    { ...DEFAULT_JOB_OPTIONS, attempts: 5 },
  );

  logger.info('Virtual account re-provision enqueued', { userId, phoneNumber });
  return { queued: true };
};

module.exports = {
  getWallet,
  transferToBank,
  withdrawToBank,
  fundWallet,
  initiateTransferPaymentFunding,
  getTransactionHistory,
  lookupBankAccount,
  getBeneficiaries,
  addBeneficiary,
  deleteBeneficiary,
  getTransactionReceipt,
  retryVirtualAccountProvisioning,
};
