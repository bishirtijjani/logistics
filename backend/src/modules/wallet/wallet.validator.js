/**
 * Wallet module — Zod validation schemas.
 */

const { z } = require('zod');

const transferSchema = z.object({
  recipientPhone: z
    .string()
    .regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  description: z.string().max(200).optional(),
  pin: z.string().length(6),
});

const withdrawSchema = z.object({
  bankCode: z.string().min(3).max(10),
  accountNumber: z.string().length(10),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  pin: z.string().length(6),
});

const verifyAccountSchema = z.object({
  bankCode: z.string().min(3).max(10),
  accountNumber: z.string().length(10),
});

const transactionHistorySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum([
    'WALLET_FUNDING',
    'P2P_TRANSFER_SENT',
    'P2P_TRANSFER_RECEIVED',
    'WITHDRAWAL',
    'DELIVERY_PAYMENT',
    'DELIVERY_EARNING',
    'UTILITY_PAYMENT',
    'REFUND',
  ]).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

module.exports = {
  transferSchema,
  withdrawSchema,
  verifyAccountSchema,
  transactionHistorySchema,
};
