/**
 * Request validator schemas
 * Unified request validation for all request types (FOOD, GROCERY, PHARMACY, PACKAGE)
 */

const { z } = require('zod');

// ============================================================
// Request Type Enum
// ============================================================

const REQUEST_TYPES = ['FOOD', 'GROCERY', 'PHARMACY', 'PACKAGE'];
const REQUEST_STATUSES = [
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
];

// ============================================================
// Create Request Schema
// ============================================================

const createRequestSchema = z.object({
  type: z.enum(REQUEST_TYPES),
  
  // Provider (required for FOOD/GROCERY/PHARMACY, optional for PACKAGE)
  providerId: z.string().uuid().optional(),
  
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
    description: z.string().min(1, 'Package description is required'),
    size: z.enum(['SMALL', 'MEDIUM', 'LARGE']),
    weight: z.number().optional(),
    senderName: z.string().min(1, 'Sender name is required'),
    senderPhone: z.string().min(10, 'Valid sender phone is required'),
    recipientName: z.string().min(1, 'Recipient name is required'),
    recipientPhone: z.string().min(10, 'Valid recipient phone is required'),
    instructions: z.string().optional(),
  }).optional(),
  
  // Special instructions
  specialInstructions: z.string().optional(),
  
  // Payment method
  paymentMethod: z.enum(['WALLET', 'CASH', 'CARD']).default('WALLET'),
}).refine((data) => {
  // Validation: If type is PACKAGE, providerId should be null
  if (data.type === 'PACKAGE' && data.providerId) {
    return false;
  }
  // Validation: If type is FOOD/GROCERY/PHARMACY, providerId is required
  if (['FOOD', 'GROCERY', 'PHARMACY'].includes(data.type) && !data.providerId) {
    return false;
  }
  // Validation: If type is PACKAGE, package details are required
  if (data.type === 'PACKAGE' && !data.package) {
    return false;
  }
  // Validation: If type is FOOD/GROCERY/PHARMACY, items are required
  if (['FOOD', 'GROCERY', 'PHARMACY'].includes(data.type) && !data.items || data.items.length === 0) {
    return false;
  }
  return true;
}, {
  message: 'Invalid request configuration for the specified type',
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
  status: z.enum(REQUEST_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Rate Request Schema
// ============================================================

const rateRequestSchema = z.object({
  providerScore: z.number().int().min(1).max(5).optional(),
  providerComment: z.string().optional(),
  riderScore: z.number().int().min(1).max(5).optional(),
  riderComment: z.string().optional(),
}).refine((data) => {
  // At least one score must be provided
  if (!data.providerScore && !data.riderScore) {
    return false;
  }
  return true;
}, {
  message: 'At least one score (provider or rider) must be provided',
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
