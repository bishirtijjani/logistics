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

  if (!wallet) {
    throw AppError.notFound('Wallet not found');
  }

  return wallet;
};

/**
 * Peer-to-peer transfer — atomic debit sender + credit recipient.
 *
 * This is the canonical example of a safe wallet operation:
 * - Both wallets are updated in a single DB transaction
 * - Two Transaction records are created (sent + received)
 * - Balance snapshots are recorded for audit
 * - Insufficient balance is checked INSIDE the transaction
 */
const transfer = async (senderId, { recipientPhone, amount, description }) => {
  const reference = `P2P-${uuidv4()}`;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Load sender wallet
    const senderWallet = await tx.wallet.findUnique({
      where: { userId: senderId },
    });

    if (!senderWallet) throw AppError.notFound('Sender wallet not found');
    if (senderWallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    // 2. Check balance INSIDE transaction
    const senderBalance = Number(senderWallet.balance);
    if (senderBalance < amount) {
      throw AppError.insufficientBalance();
    }

    // 3. Find recipient
    const recipient = await tx.user.findUnique({
      where: { phone: recipientPhone },
      include: { wallet: true },
    });

    if (!recipient || !recipient.wallet) {
      throw AppError.notFound('Recipient not found');
    }

    if (recipient.id === senderId) {
      throw AppError.badRequest('Cannot transfer to yourself');
    }

    const recipientBalance = Number(recipient.wallet.balance);

    // 4. Debit sender
    await tx.wallet.update({
      where: { id: senderWallet.id },
      data: { balance: { decrement: amount } },
    });

    // 5. Credit recipient
    await tx.wallet.update({
      where: { id: recipient.wallet.id },
      data: { balance: { increment: amount } },
    });

    // 6. Create debit transaction record
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

    // 7. Create credit transaction record
    await tx.transaction.create({
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
      newBalance: senderBalance - amount,
    };
  });

  logger.info('P2P transfer completed', {
    senderId,
    recipientPhone,
    amount,
    reference,
  });

  // TODO: Emit socket wallet:balance:updated to both sender and recipient
  // TODO: Queue push notification to recipient

  return result;
};

/**
 * Withdraw to bank account — atomic debit + queue disbursement.
 *
 * FLOW:
 * 1. Deduct wallet balance immediately (atomic)
 * 2. Queue Monnify disbursement job
 * 3. Worker processes the bank transfer
 * 4. On Monnify success: transaction stays COMPLETED
 * 5. On Monnify failure: refund is queued
 */
const withdrawToBank = async (userId, { bankCode, accountNumber, amount }) => {
  const reference = `WIT-${uuidv4()}`;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');
    if (wallet.isLocked) throw AppError.forbidden('Wallet is frozen');

    const balance = Number(wallet.balance);
    if (balance < amount) throw AppError.insufficientBalance();

    // Debit wallet
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    // Create pending withdrawal transaction
    const transaction = await tx.transaction.create({
      data: {
        reference,
        type: 'WITHDRAWAL',
        status: 'PROCESSING',
        amount,
        description: `Withdrawal to ${bankCode} - ${accountNumber}`,
        debitWalletId: wallet.id,
        merchant: 'MONNIFY',
        metadata: { bankCode, accountNumber },
        balanceBefore: balance,
        balanceAfter: balance - amount,
      },
    });

    return {
      transactionRef: reference,
      amount,
      newBalance: balance - amount,
      status: 'PROCESSING',
    };
  });

  // TODO: Queue Monnify disbursement job
  // paymentQueue.add(PAYMENT_JOBS.PROCESS_WITHDRAWAL, {
  //   transactionId: reference, bankCode, accountNumber, amount
  // });

  logger.info('Withdrawal initiated', { userId, amount, reference });

  return result;
};

/**
 * Process wallet funding from Monnify webhook.
 * Uses reference-based idempotency — safe to call multiple times.
 */
const fundWallet = async ({ accountNumber, amount, reference, metadata }) => {
  // Idempotency check
  const existing = await prisma.transaction.findUnique({
    where: { reference },
  });
  if (existing) {
    logger.warn('Duplicate funding attempt', { reference });
    return existing;
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { virtualAccountNumber: accountNumber },
    });

    if (!wallet) {
      throw AppError.notFound('Wallet not found for account number');
    }

    const currentBalance = Number(wallet.balance);

    // Credit wallet
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    // Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        reference,
        type: 'WALLET_FUNDING',
        status: 'COMPLETED',
        amount,
        description: 'Wallet funding via bank transfer',
        creditWalletId: wallet.id,
        merchant: 'MONNIFY',
        merchantRef: reference,
        metadata,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + amount,
      },
    });

    return transaction;
  });

  logger.info('Wallet funded', { accountNumber, amount, reference });

  // TODO: Emit socket wallet:balance:updated
  // TODO: Queue push notification

  return result;
};

/**
 * Get paginated transaction history for a user.
 */
const getTransactionHistory = async (userId, { page, limit, type, startDate, endDate }) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw AppError.notFound('Wallet not found');

  const where = {
    OR: [
      { debitWalletId: wallet.id },
      { creditWalletId: wallet.id },
    ],
    ...(type && { type }),
    ...(startDate && endDate && {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    }),
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

module.exports = {
  getWallet,
  transfer,
  withdrawToBank,
  fundWallet,
  getTransactionHistory,
};
