/**
 * Request validator schemas
 * Unified request validation. type=MERCHANT_ORDER covers any merchant-fulfilled order
 * (food, grocery, pharmacy, retail, etc.); type=PACKAGE is pure courier with no merchant.
 */

const { z } = require('zod');
const { ALL_STATUSES } = require('../../utils/status');

// ============================================================
// Request Type Enum
// ============================================================

const REQUEST_TYPES = ['MERCHANT_ORDER', 'PACKAGE'];
const REQUEST_STATUSES = ALL_STATUSES;

// ============================================================
// Create Request Schema
// ============================================================

const createRequestSchema = z.object({
  // Optional — server can infer from payload (merchantId present => MERCHANT_ORDER, else PACKAGE).
  type: z.enum(REQUEST_TYPES).optional(),

  // Merchant (required for MERCHANT_ORDER, forbidden for PACKAGE)
  merchantId: z.string().uuid().optional(),
  
  // Locations (required for all types)
  pickupAddress: z.string().min(5, 'Pickup address is required'),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  pickupName: z.string().optional(),
  
  dropoffAddress: z.string().min(5, 'Dropoff address is required'),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  dropoffName: z.string().optional(),
  
  // Items (for FOOD/GROCERY/PHARMACY)
  items: z.array(z.object({
    productId: z.string().uuid().optional(),
    name: z.string().min(1, 'Item name is required'),
    description: z.string().optional(),
    unitPrice: z.number().positive('Unit price must be positive'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    variations: z.any().optional(),
  })).optional(),
  
  // Package details (for PACKAGE type only)
  package: z.object({
    description: z.string().optional(),
    size: z.enum(['SMALL', 'MEDIUM', 'LARGE']).default('SMALL'),
    weight: z.number().optional(),
    fragile: z.boolean().optional(),
    senderName: z.string().optional(),
    senderPhone: z.string().optional(),
    recipientName: z.string().optional(),
    recipientPhone: z.string().optional(),
    instructions: z.string().optional(),
  }).optional(),

  // Special instructions
  specialInstructions: z.string().optional(),

  // Transaction PIN (required for wallet deduction)
  pin: z.string().length(6).optional(),

  // Payment method
  paymentMethod: z.enum(['WALLET', 'CASH', 'CARD']).default('WALLET'),
}).refine((data) => {
  // Server infers type from payload shape when client doesn't send it.
  const inferredType = data.type || (data.merchantId ? 'MERCHANT_ORDER' : 'PACKAGE');

  if (inferredType === 'PACKAGE') {
    // PACKAGE: no merchant, no items, package details required.
    if (data.merchantId) return false;
    if (data.items && data.items.length > 0) return false;
    if (!data.package) return false;
    return true;
  }

  // MERCHANT_ORDER: merchantId + non-empty items required.
  if (!data.merchantId) return false;
  if (!data.items || data.items.length === 0) return false;
  return true;
}, {
  message: 'Invalid request payload: PACKAGE needs package details only; MERCHANT_ORDER needs merchantId and items.',
});

// ============================================================
// Update Status Schema
// ============================================================

const updateStatusSchema = z.object({
  status: z.enum(REQUEST_STATUSES),
  reason: z.string().optional(),
});

// ============================================================
// List Requests Schema
// ============================================================

const listRequestsSchema = z.object({
  type: z.enum(REQUEST_TYPES).optional(),
  status: z.string().optional(), // comma-separated statuses allowed
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Rate Request Schema
// ============================================================

const rateRequestSchema = z.object({
  merchantScore: z.number().int().min(1).max(5).optional(),
  merchantComment: z.string().optional(),
  riderScore: z.number().int().min(1).max(5).optional(),
  riderComment: z.string().optional(),
}).refine((data) => {
  // At least one score must be provided
  if (!data.merchantScore && !data.riderScore) {
    return false;
  }
  return true;
}, {
  message: 'At least one score (merchant or rider) must be provided',
});

// ============================================================
// Cancel Request Schema
// ============================================================

const cancelRequestSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

module.exports = {
  createRequestSchema,
  updateStatusSchema,
  listRequestsSchema,
  rateRequestSchema,
  cancelRequestSchema,
  REQUEST_TYPES,
  REQUEST_STATUSES,
};
