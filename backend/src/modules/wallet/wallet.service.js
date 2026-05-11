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

    if (!recipient || !recipient.wallet) throw AppError.notFound('Recipient not found');
    if (recipient.id === senderId) throw AppError.badRequest('Cannot transfer to yourself');

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

  // Emit real-time updates
  const senderWallet = await prisma.wallet.findUnique({ where: { userId: senderId }, select: { balance: true } });
  notifyService.balanceUpdated(senderId, { balance: Number(senderWallet.balance) });
  notifyService.balanceUpdated(result.recipientId, { balance: Number((await prisma.wallet.findFirst({ where: { id: result.recipientWalletId } })).balance) });
  notifyService.transferReceived(result.recipientId, {
    amount,
    senderName: 'A user',
    reference,
  });

  return result;
};

/**
 * Withdraw to bank account — atomic debit + queue disbursement.
 */
const withdrawToBank = async (userId, { bankCode, accountNumber, accountName, amount }) => {
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
        description: `Withdrawal to ${bankCode} - ${accountNumber}`,
        debitWalletId: wallet.id,
        merchant: 'KATPAY',
        metadata: { bankCode, accountNumber, accountName },
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
        merchant: 'KATPAY',
        merchantRef: reference,
        metadata,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + amount,
      },
    });

    return { transaction, wallet, newBalance: currentBalance + amount };
  });

  logger.info('Wallet funded', { accountNumber, amount, reference });

  // Emit real-time updates via socket
  const ownerWallet = await prisma.wallet.findUnique({ where: { virtualAccountNumber: accountNumber }, select: { userId: true, balance: true } });
  if (ownerWallet) {
    notifyService.balanceUpdated(ownerWallet.userId, { balance: Number(ownerWallet.balance) });
    notifyService.fundingReceived(ownerWallet.userId, { amount, reference });
  }

  return result.transaction;
};

/**
 * Get paginated transaction history for a user.
 */
const getTransactionHistory = async (userId, { page, limit, type, startDate, endDate }) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw AppError.notFound('Wallet not found');

  const where = {
    OR: [{ debitWalletId: wallet.id }, { creditWalletId: wallet.id }],
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

  const merchantRef = `TOPUP-${uuidv4()}`;
  const result = await katpayService.initiateTransferPayment({
    amount,
    customer: { email: user.email, name: `${user.firstName} ${user.lastName}`, phone: user.phone },
    merchant_reference: merchantRef,
    metadata: { userId, purpose: 'WALLET_TOPUP' },
  });

  logger.info('Transfer payment funding initiated', { userId, amount, merchantRef });
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
};
