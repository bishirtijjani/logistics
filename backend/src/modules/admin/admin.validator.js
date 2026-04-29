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

// Admin request management schemas
const listAllRequestsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['FOOD', 'GROCERY', 'PHARMACY', 'PACKAGE']).optional(),
  status: z.enum([
    'REQUESTED',
    'ACCEPTED',
    'PROCESSING',
    'READY_FOR_PICKUP',
    'RIDER_ASSIGNED',
    'RIDER_EN_ROUTE',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
    'SETTLED',
    'CANCELLED',
  ]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const reassignRiderSchema = z.object({
  newRiderId: z.string().uuid(),
});

const forceCancelRequestSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

const adminUpdateRequestStatusSchema = z.object({
  status: z.enum([
    'REQUESTED',
    'ACCEPTED',
    'PROCESSING',
    'READY_FOR_PICKUP',
    'RIDER_ASSIGNED',
    'RIDER_EN_ROUTE',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
    'SETTLED',
    'CANCELLED',
  ]),
  reason: z.string().optional(),
});

// Admin merchant management schemas
const listAllMerchantsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['FOOD', 'GROCERY', 'PHARMACY']).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED']).optional(),
});

const approveMerchantSchema = z.object({});

const rejectMerchantSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

const suspendMerchantSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

const unsuspendMerchantSchema = z.object({});

const updateMerchantCommissionSchema = z.object({
  commissionRate: z.number().min(0).max(100),
});

// Admin rider management schemas
const listAllRidersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REJECTED']).optional(),
  availability: z.enum(['ONLINE', 'OFFLINE', 'ON_DELIVERY']).optional(),
});

const getRiderEarningsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Platform settings schemas
const updatePlatformSettingsSchema = z.object({
  deliveryBaseFare: z.number().min(0).optional(),
  deliveryPerKmRate: z.number().min(0).optional(),
  deliveryPlatformFeePercent: z.number().min(0).max(100).optional(),
  itemPlatformFeePercent: z.number().min(0).max(100).optional(),
});

module.exports = {
  reviewRiderSchema,
  updateUserStatusSchema,
  listPendingRidersSchema,
  transactionOverviewSchema,
  listAllRequestsSchema,
  reassignRiderSchema,
  forceCancelRequestSchema,
  adminUpdateRequestStatusSchema,
  listAllMerchantsSchema,
  approveMerchantSchema,
  rejectMerchantSchema,
  suspendMerchantSchema,
  unsuspendMerchantSchema,
  updateMerchantCommissionSchema,
  listAllRidersSchema,
  getRiderEarningsSchema,
  updatePlatformSettingsSchema,
};
