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
    'UTILITY_PAYMENT',
    'REFUND',
    'ESCROW_HOLD',
    'ESCROW_RELEASE',
    'ESCROW_REFUND',
    'PLATFORM_EARNING',
    'RIDER_EARNING',
    'MERCHANT_EARNING',
  ]).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
});

// Admin request management schemas
const listAllRequestsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['MERCHANT_ORDER', 'PACKAGE']).optional(),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().min(1).optional(),
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

const customerRequestsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
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
});

const customerTransactionsSchema = z.object({
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
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
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
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().min(1).optional(),
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REJECTED']).optional(),
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
  reason: z.string().max(500).optional(),
});

const updateMerchantProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional(),
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().min(5).max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  adminActiveOverride: z.boolean().optional(),
});

const setWithdrawalHoldSchema = z.object({
  held: z.boolean(),
  reason: z.string().max(500).optional(),
});

const bulkApproveWithdrawalsSchema = z.object({
  withdrawalIds: z.array(z.string().uuid()).min(1).max(50),
});

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  category: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(100).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  category: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

const setMerchantTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

// Merchant category schemas
//
// `attributeSchema` is an admin-managed JSON hint that tells the merchant app
// which axes (size, color, strength, …) and pack units the category uses, plus
// some category-specific extras (sizeSystem, etc.). The DB does not enforce it —
// the merchant product form reads it to render the right inputs. Validation here
// is loose on purpose (categories can be added without code changes); we only
// constrain the shape of well-known fields.
const attributeSchemaSchema = z.object({
  axes: z.array(z.string().min(1).max(40)).max(10).optional(),
  pack: z.boolean().optional(),
  packUnits: z.array(z.enum(['ML','L','G','KG','TABLET','CAPSULE','PIECE','PAIR','PACK','BOTTLE','SACHET','CARTON'])).optional(),
  sizeSystem: z.string().max(20).optional(),
}).passthrough();

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  hasPreparation: z.boolean().optional(),
  attributeSchema: attributeSchemaSchema.optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  hasPreparation: z.boolean().optional(),
  isActive: z.boolean().optional(),
  attributeSchema: attributeSchemaSchema.nullable().optional(),
});

const updateAttributeSchemaSchema = z.object({
  attributeSchema: attributeSchemaSchema.nullable(),
});

const listCategoriesSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  isActive: z.enum(['true', 'false']).optional(),
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
  customerRequestsSchema,
  customerTransactionsSchema,
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
  updateMerchantProfileSchema,
  setWithdrawalHoldSchema,
  bulkApproveWithdrawalsSchema,
  createTagSchema,
  updateTagSchema,
  setMerchantTagsSchema,
  createCategorySchema,
  updateCategorySchema,
  updateAttributeSchemaSchema,
  listCategoriesSchema,
  listAllRidersSchema,
  getRiderEarningsSchema,
  updatePlatformSettingsSchema,
};
