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

// Phase 8 - grocery substitution preference per line item.
const SUBSTITUTION_PREFERENCES = ['NONE', 'MERCHANT_PICK', 'CONTACT_ME'];

// ============================================================
// Create Request Schema
// ============================================================

const createRequestSchema = z.object({
  // Optional - server can infer from payload (merchantId present => MERCHANT_ORDER, else PACKAGE).
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
  
  // Items (for MERCHANT_ORDER). Server resolves `unitPrice`/`lineTotal` from
  // the variant + option group price deltas - clients never set prices.
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    /// Customer's option selections per group. Server validates against the live
    /// option-group config and snapshots into RequestItem.selectedOptions.
    selectedOptions: z.array(z.object({
      groupId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()).default([]),
    })).optional(),
    specialInstructions: z.string().max(200).optional(),
    /// Phase 8 - grocery substitution preference. Persisted as-is on the
    /// line so the merchant ticket and tracking timeline can render it.
    substitution: z.enum(SUBSTITUTION_PREFERENCES).optional(),
  })).optional(),

  /// Phase 8 - pharmacy prescription document. Cloudinary URL captured at
  /// checkout via the signed-upload endpoint. Service enforces presence when
  /// any line product is flagged `requiresPrescription`.
  prescriptionUrl: z.string().url().max(1024).optional(),
  
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

  // Payment method. WALLET (default) debits the customer wallet into escrow.
  // CASH is pay-the-rider-on-delivery and is restricted to PACKAGE below.
  paymentMethod: z.enum(['WALLET', 'CASH']).default('WALLET'),

  // Signed quote token from POST /requests/quote.
  // Server re-verifies signature + TTL + locked numbers before persisting.
  quoteToken: z.string().min(20),
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
}).refine((data) => {
  // Cash is pay-the-rider-on-delivery and only the courier (PACKAGE) flow
  // supports it. Merchant orders front item cost the merchant must be paid for,
  // so they stay wallet-only.
  if (data.paymentMethod !== 'CASH') return true;
  const inferredType = data.type || (data.merchantId ? 'MERCHANT_ORDER' : 'PACKAGE');
  return inferredType === 'PACKAGE';
}, {
  message: 'Cash payment is only available for package deliveries.',
  path: ['paymentMethod'],
});

// ============================================================
// Update Status Schema
// ============================================================

const updateStatusSchema = z.object({
  status: z.enum(REQUEST_STATUSES),
  reason: z.string().optional(),
  // Phase 5 - Proof of Delivery payload, supplied on DELIVERED transition
  // when the platform requires it. Validated in `request.service.updateStatus`
  // against `delivery.requirePodPhoto`, `delivery.requireSignature`, and
  // `delivery.podOtpThresholdNgn`. URLs are server-verified against the
  // Cloudinary cloud configured for this environment.
  podPhotoUrl: z.string().url().max(1024).optional(),
  podSignatureUrl: z.string().url().max(1024).optional(),
  podDeliveryOtp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits').optional(),
});

// Phase 5 - body shape for `POST /requests/:id/pod-otp/generate`.
// The endpoint takes no request body, but we declare a schema for the
// idempotency middleware's body-hash to be deterministic.
const podOtpGenerateSchema = z.object({}).passthrough();

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
  // Optional signed token from the most recent /cancel-quote response.
  // When present the server uses the locked fee from the token instead of
  // re-reading the platform setting - closes the preview/charge race.
  cancelToken: z.string().min(20).optional(),
});

// ============================================================
// Quote Schema - server-truth pricing preview without persisting an order.
// ============================================================

const quoteRequestSchema = z.object({
  type: z.enum(REQUEST_TYPES).optional(),
  merchantId: z.string().uuid().optional(),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().min(1),
    selectedOptions: z.array(z.object({
      groupId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()).default([]),
    })).optional(),
  })).optional(),
  package: z.object({
    size: z.enum(['SMALL', 'MEDIUM', 'LARGE']).default('SMALL'),
    weight: z.number().optional(),
  }).optional(),
});

// ============================================================
// Messaging Schemas
// ============================================================

const postMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(1000),
});

const listMessagesSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ============================================================
// Rider-initiated cancellation - Phase 4.
// Riders cancel for operational reasons (customer unreachable, wrong address,
// vehicle issue). No fee is charged to the rider; the customer is fully
// refunded. PIN-protected, idempotent.
// ============================================================

const RIDER_CANCEL_REASONS = [
  'CUSTOMER_NOT_REACHABLE',
  'WRONG_ADDRESS',
  'VEHICLE_ISSUE',
  'OTHER',
];

const riderCancelSchema = z.object({
  reason: z.enum(RIDER_CANCEL_REASONS),
  note: z.string().trim().max(500).optional(),
  pin: z.string().length(6),
});

// ============================================================
// Address correction - Phase 4 (BLK-AddressCorrection).
// Rider flags a stage's address as wrong and supplies a corrected location
// + note. Persists as an AuditLog row and notifies merchant + admin so
// dispatch can act on it without changing the trip flow.
// ============================================================

const addressCorrectionSchema = z.object({
  stage: z.enum(['pickup', 'dropoff']),
  note: z.string().trim().min(3, 'Tell us what the issue is').max(500),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

module.exports = {
  createRequestSchema,
  updateStatusSchema,
  listRequestsSchema,
  rateRequestSchema,
  cancelRequestSchema,
  quoteRequestSchema,
  postMessageSchema,
  listMessagesSchema,
  riderCancelSchema,
  addressCorrectionSchema,
  podOtpGenerateSchema,
  REQUEST_TYPES,
  REQUEST_STATUSES,
  SUBSTITUTION_PREFERENCES,
  RIDER_CANCEL_REASONS,
};
