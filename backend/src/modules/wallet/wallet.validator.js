/**
 * Wallet module — Zod validation schemas.
 */

const { z } = require('zod');

// Money amount: positive, capped, and at most 2 decimals (kobo) — the ledger is
// Decimal(15,2), so sub-kobo or absurd values must be rejected before they hit
// it. The epsilon keeps legitimate kobo amounts from tripping float rounding.
const amountField = z.coerce
  .number()
  .positive('Amount must be greater than 0')
  .max(100_000_000, 'Amount exceeds the maximum allowed')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Amount cannot have more than 2 decimal places');

const withdrawSchema = z.object({
  bankCode: z.string().min(3).max(10),
  bankName: z.string().min(1).max(80).optional(),
  accountNumber: z.string().length(10),
  accountName: z.string().min(1).max(120).optional(),
  amount: amountField,
  pin: z.string().length(6),
});

// A transfer is a bank disbursement — same payload as a withdrawal (we route it
// to the same rail in the service). Kept as a named export so the route reads
// intentionally even though the shape is identical to withdrawSchema today.
const transferSchema = withdrawSchema;

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
    'UTILITY_PAYMENT',
    'REFUND',
    'ESCROW_HOLD',
    'ESCROW_RELEASE',
    'ESCROW_REFUND',
    'PLATFORM_EARNING',
    'RIDER_EARNING',
    'MERCHANT_EARNING',
  ]).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  q: z.string().trim().min(1).max(80).optional(),
});

module.exports = {
  transferSchema,
  withdrawSchema,
  verifyAccountSchema,
  transactionHistorySchema,
};
