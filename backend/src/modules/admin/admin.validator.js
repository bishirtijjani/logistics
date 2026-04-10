/**
 * Admin module — Zod validation schemas.
 */

const { z } = require('zod');

const reviewRiderSchema = z.object({
  decision: z.enum(['approve', 'reject']),
});

const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
});

const listPendingRidersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const transactionOverviewSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
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
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
});

module.exports = {
  reviewRiderSchema,
  updateUserStatusSchema,
  listPendingRidersSchema,
  transactionOverviewSchema,
};
