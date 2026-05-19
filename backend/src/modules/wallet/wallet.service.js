/**
 * Wallet service — core financial operations.
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
 * Peer-to-peer transfer — atomic debit sender + credit recipient.
 */
const transfer = async (senderId, { recipientPhone, amount, description }) => {
  const reference = `P2P-${uuidv4()}`;

  const result = await prisma.$transaction(async (tx) => {
    const senderWallet = await tx.wallet.findUnique({ where: { userId: senderId } });
    if (!senderWallet) throw AppError.notFound('Sender wallet not found');
    if (senderWallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    const senderBalance = Number(senderWallet.balance);
    if (senderBalance < amount) throw AppError.insufficientBalance();

    const recipient = await tx.user.findUnique({
      where: { phone: recipientPhone },
      include: { wallet: true },
    });

    if (!recipient || !recipient.wallet) throw AppError.notFound('Recipient not found', { code: 'RECIPIENT_NOT_FOUND' });
    if (recipient.id === senderId) throw AppError.badRequest('Cannot transfer to yourself', { code: 'TRANSFER_TO_SELF' });

    const recipientBalance = Number(recipient.wallet.balance);

    await tx.wallet.update({ where: { id: senderWallet.id }, data: { balance: { decrement: amount } } });
    await tx.wallet.update({ where: { id: recipient.wallet.id }, data: { balance: { increment: amount } } });

    await tx.transaction.create({
      data: {
        reference: `${reference}-DEBIT`,
        type: 'P2P_TRANSFER_SENT',
        status: 'COMPLETED',
        amount,
        description: description || `Transfer to ${recipientPhone}`,
        debitWalletId: senderWallet.id,
        creditWalletId: recipient.wallet.id,
        balanceBefore: senderBalance,
        balanceAfter: senderBalance - amount,
        metadata: {
          recipientPhone,
          recipientName: `${recipient.firstName} ${recipient.lastName}`,
          recipientId: recipient.id,
        },
      },
    });

    const creditTx = await tx.transaction.create({
      data: {
        reference: `${reference}-CREDIT`,
        type: 'P2P_TRANSFER_RECEIVED',
        status: 'COMPLETED',
        amount,
        description: description || `Transfer from ${senderWallet.userId}`,
        debitWalletId: senderWallet.id,
        creditWalletId: recipient.wallet.id,
        balanceBefore: recipientBalance,
        balanceAfter: recipientBalance + amount,
      },
    });

    return {
      transactionRef: reference,
      amount,
      recipientPhone,
      recipientName: `${recipient.firstName} ${recipient.lastName}`,
      recipientId: recipient.id,
      recipientWalletId: recipient.wallet.id,
      newBalance: senderBalance - amount,
      creditTransaction: creditTx,
    };
  });

  logger.info('P2P transfer completed', { senderId, recipientPhone, amount, reference });

  // Live wallet-balance nudges (silent — no Notification Center row each time).
  const senderWallet = await prisma.wallet.findUnique({ where: { userId: senderId }, select: { balance: true } });
  notifyService.balanceUpdated(senderId, { balance: Number(senderWallet.balance) });
  notifyService.balanceUpdated(result.recipientId, { balance: Number((await prisma.wallet.findFirst({ where: { id: result.recipientWalletId } })).balance) });
  notifyService.transferReceived(result.recipientId, {
    amount,
    senderName: 'A user',
    reference,
  });

  // Persisted notifications: sender + recipient each get a row + push.
  // Sender-side fire-and-forget — failure of a notification must not roll back
  // the transfer (already committed above).
  notifyService.onWalletEvent(senderId, {
    kind: 'TRANSFER_SENT',
    amount,
    transactionId: result.debitTransaction?.reference || reference,
    route: '/wallet',
  }).catch((err) => logger.warn('TRANSFER_SENT notification failed', { error: err.message }));
  notifyService.onWalletEvent(result.recipientId, {
    kind: 'TRANSFER_RECEIVED',
    amount,
    transactionId: result.creditTransaction?.reference || reference,
    senderName: 'A user',
    route: '/wallet',
  }).catch((err) => logger.warn('TRANSFER_RECEIVED notification failed', { error: err.message }));

  return result;
};

/**
 * Withdraw to bank account — atomic debit + queue disbursement.
 */
const withdrawToBank = async (userId, { bankCode, bankName, accountNumber, accountName, amount }) => {
  const reference = `WIT-${uuidv4()}`;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');
    if (wallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    const balance = Number(wallet.balance);
    if (balance < amount) throw AppError.insufficientBalance();

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount } } });

    await tx.transaction.create({
      data: {
        reference,
        type: 'WITHDRAWAL',
        status: 'PROCESSING',
        amount,
        description: `Withdrawal to ${bankName || bankCode} - ${accountNumber}`,
        debitWalletId: wallet.id,
        provider: 'KATPAY',
        metadata: { bankCode, bankName, accountNumber, accountName },
        balanceBefore: balance,
        balanceAfter: balance - amount,
      },
    });

    return { transactionRef: reference, amount, newBalance: balance - amount, status: 'PROCESSING' };
  });

  await paymentQueue.add(
    PAYMENT_JOBS.PROCESS_WITHDRAWAL,
    { transactionId: reference, bankCode, accountNumber, accountName, amount, userId },
    DEFAULT_JOB_OPTIONS,
  );

  logger.info('Withdrawal initiated', { userId, amount, reference });

  const freshWallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
  notifyService.balanceUpdated(userId, { balance: Number(freshWallet.balance) });

  // Notification: withdrawal is PROCESSING here. We surface a "withdrawal
  // initiated" entry; the payment worker will create another row when the
  // payout actually clears.
  notifyService.onWalletEvent(userId, {
    kind: 'WALLET',
    amount,
    transactionId: reference,
    route: '/wallet',
    description: `Withdrawal of ₦${Number(amount).toLocaleString('en-NG')} initiated`,
  }).catch((err) => logger.warn('Withdrawal-initiated notification failed', { error: err.message }));

  return result;
};

/**
 * Process wallet funding from KatPay webhook.
 * Uses reference-based idempotency — safe to call multiple times.
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

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });

    const transaction = await tx.transaction.create({
      data: {
        reference,
        type: 'WALLET_FUNDING',
        status: 'COMPLETED',
        amount,
        description: 'Wallet funding via bank transfer',
        creditWalletId: wallet.id,
        provider: 'KATPAY',
        providerRef: reference,
        metadata,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + amount,
      },
    });

    return { transaction, wallet, newBalance: currentBalance + amount };
  });

  logger.info('Wallet funded', { accountNumber, amount, reference });

  // Live wallet-balance nudge + Notification Center row + push.
  const ownerWallet = await prisma.wallet.findUnique({ where: { virtualAccountNumber: accountNumber }, select: { userId: true, balance: true } });
  if (ownerWallet) {
    notifyService.balanceUpdated(ownerWallet.userId, { balance: Number(ownerWallet.balance) });
    notifyService.fundingReceived(ownerWallet.userId, { amount, reference });
    notifyService.onWalletEvent(ownerWallet.userId, {
      kind: 'FUNDING',
      amount,
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
 * Lookup bank account name via KatPay (cached 6h).
 */
const lookupBankAccount = async ({ bankCode, accountNumber }) => {
  const cacheKey = `bank:lookup:${bankCode}:${accountNumber}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  // KatPay name enquiry — the endpoint pattern varies; adjust to actual KatPay docs
  const axios = require('axios');
  const { config } = require('../../config');

  const response = await axios.post(
    `${config.KATPAY_BASE_URL}/bank-account/resolve`,
    { bank_code: bankCode, account_number: accountNumber },
    {
      headers: {
        Authorization: `Bearer ${config.KATPAY_API_SECRET}`,
        'api-key': config.KATPAY_PUBLIC_KEY,
        'Content-Type': 'application/json',
      },
    },
  );

  const data = response.data?.data || response.data;
  const result = {
    accountName: data.account_name || data.accountName,
    accountNumber: data.account_number || data.accountNumber || accountNumber,
    bankCode,
  };

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
    merchant_reference: providerRef, // KatPay API field name — do not rename the key
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
 * Re-enqueue a virtual-account provisioning job for a user who is KYC-verified
 * but whose wallet has no NUBAN (KatPay was down/misconfigured at original
 * verification). Throttled per-user via Redis so the client can't spam KatPay.
 *
 * Worker handler is idempotent — short-circuits if accountNumber already set.
 */
const retryVirtualAccountProvisioning = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user) throw AppError.notFound('User not found');
  if (user.kycStatus !== 'VERIFIED') {
    throw AppError.badRequest('Complete BVN verification first', { code: 'KYC_NOT_VERIFIED' });
  }
  if (user.wallet?.virtualAccountNumber) {
    return { alreadyProvisioned: true };
  }

  // KatPay requires phoneNumber. We adopt the BVN-verified phone into
  // user.phone at verification time, so it should always be set by here.
  // If it isn't, the user is from before that fix landed — revert their
  // kycStatus so the BVN screen lets them back in to re-submit. Without
  // this revert the screen would render the "already verified" success
  // view and they'd have no way to fix the missing phone.
  if (!user.phone) {
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: 'NONE' },
    });
    logger.warn('Reverted kycStatus to NONE: verified user has no phone on file', { userId });
    throw AppError.badRequest(
      'No phone on file. Please re-submit your BVN to recover your account.',
      { code: 'BVN_PHONE_MISSING' },
    );
  }
  const phoneNumber = user.phone;

  // 30s throttle keyed by user — generous enough to absorb screen mounts +
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
  transfer,
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
