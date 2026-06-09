const { z } = require('zod');

const phone = z.string().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number');
const network = z.enum(['MTN', 'AIRTEL', 'GLO', 'NINEMOBILE']);

const initiateSchema = z.object({
  network,
  senderPhone: phone,
  amount: z.coerce.number().int().min(500).max(20000),
});

const verifySchema = z.object({
  transactionId: z.string().uuid(),
  otp: z.string().min(4).max(8),
});

const submitSchema = z.object({
  transactionId: z.string().uuid(),
  // Network-level SIM transfer PIN (e.g. MTN's default 0000 or user-set 4-digit).
  // NOT the iPrime wallet PIN - that's not required for inbound airtime-to-cash.
  simPin: z.string().min(4).max(6),
});

const historySchema = z.object({
  status: z
    .enum([
      'AWAITING_OTP',
      'OTP_VERIFIED',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'NEEDS_RECONCILIATION',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  initiateSchema,
  verifySchema,
  submitSchema,
  historySchema,
};
