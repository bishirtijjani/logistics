/**
 * Merchant validator schemas
 */

const { z } = require('zod');

const MERCHANT_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REJECTED'];

// ============================================================
// Create Merchant Schema
// ============================================================

const createMerchantSchema = z.object({
  categoryId: z.string().uuid('categoryId must be a valid UUID'),
  name: z.string().min(2, 'Merchant name is required'),
  description: z.string().optional(),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Valid email is required').optional(),
  address: z.string().min(5, 'Address is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format').default('08:00'),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format').default('22:00'),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  commissionRate: z.number().min(0).max(50).default(15),
});

// ============================================================
// Update Merchant Schema
// ============================================================

const updateMerchantSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  address: z.string().min(5).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  isOpen: z.boolean().optional(),
});

// ============================================================
// List Merchants Schema
// ============================================================

const listMerchantsSchema = z.object({
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().min(1).optional(),
  status: z.enum(MERCHANT_STATUSES).optional(),
  // Query strings arrive as strings, so coerce numbers and preprocess the
  // boolean. Bare z.number()/z.boolean() reject "12.34"/"true" and 400 out.
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.1).max(50).default(10),
  openNow: z
    .preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Toggle Merchant Status Schema
// ============================================================

const toggleMerchantStatusSchema = z.object({
  isOpen: z.boolean(),
});

// ============================================================
// Update Commission Schema
// ============================================================

const updateCommissionSchema = z.object({
  commissionRate: z.number().min(0).max(50),
});

// ============================================================
// Merchant Dashboard Schemas
// ============================================================

const updateMerchantProfileSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  address: z.string().min(5).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  isOpen: z.boolean().optional(),
});

const merchantOrdersSchema = z.object({
  status: z.enum([
    'REQUESTED', 'ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP',
    'RIDER_ASSIGNED', 'RIDER_EN_ROUTE', 'PICKED_UP', 'IN_TRANSIT',
    'DELIVERED', 'CANCELLED'
  ]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const rejectOrderSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'READY_FOR_PICKUP']),
});

// Withdrawals draw on the bank account already saved to the merchant's wallet,
// so the request body only carries the amount.
const requestWithdrawalSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
});

// Save / update the merchant's payout bank account. KatPay has no name-enquiry
// endpoint, so accountName is supplied by the user and stored as given.
const saveBankAccountSchema = z.object({
  bankCode: z.string().min(2, 'Bank is required'),
  accountNumber: z.string().length(10, 'Account number must be 10 digits'),
  accountName: z.string().min(2, 'Account name is required'),
});

const merchantProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ------------------------------------------------------------
// Variants & Option Groups
// ------------------------------------------------------------

const PACK_UNITS = ['ML','L','G','KG','TABLET','CAPSULE','PIECE','PAIR','PACK','BOTTLE','SACHET','CARTON'];
const SELECTION_RULES = ['REQUIRED_ONE','OPTIONAL_ONE','REQUIRED_MULTIPLE','OPTIONAL_MULTIPLE'];

// Each selection rule fixes how minSelect/maxSelect may be set. The dashboards
// couple these in the UI; this is the matching server-side guard so a
// contradictory group (e.g. REQUIRED_ONE with maxSelect 5) can never be
// persisted regardless of which client sent it. Returns a human-readable error
// string, or null when the (rule, min, max) triple is internally consistent.
const optionGroupRuleError = ({ selectionRule, minSelect, maxSelect }) => {
  switch (selectionRule) {
    case 'REQUIRED_ONE':
      return minSelect === 1 && maxSelect === 1
        ? null : 'A "pick exactly one" group must require exactly one selection';
    case 'OPTIONAL_ONE':
      return minSelect === 0 && maxSelect === 1
        ? null : 'A "pick at most one" group must allow zero or one selection';
    case 'REQUIRED_MULTIPLE':
      if (minSelect < 1) return 'A required multi-pick group must ask for at least one selection';
      if (maxSelect < minSelect) return 'Max picks must be greater than or equal to min picks';
      return null;
    case 'OPTIONAL_MULTIPLE':
      if (minSelect !== 0) return 'An optional multi-pick group must have a minimum of zero';
      if (maxSelect < 1) return 'An optional multi-pick group must allow at least one selection';
      return null;
    default:
      return 'Unknown selection rule';
  }
};

// Canonical min/max for a rule, used to fill in bounds a caller didn't pin so
// the rule and its bounds always agree (matches ruleDefaults in the dashboards).
const ruleDefaults = (selectionRule) => {
  switch (selectionRule) {
    case 'REQUIRED_ONE':      return { minSelect: 1, maxSelect: 1 };
    case 'OPTIONAL_ONE':      return { minSelect: 0, maxSelect: 1 };
    case 'REQUIRED_MULTIPLE': return { minSelect: 1, maxSelect: 2 };
    case 'OPTIONAL_MULTIPLE': return { minSelect: 0, maxSelect: 2 };
    default:                  return { minSelect: 0, maxSelect: 1 };
  }
};

const variantInputSchema = z.object({
  sku: z.string().optional(),
  attributes: z.record(z.any()).optional(),
  packSize: z.number().positive().optional(),
  packUnit: z.enum(PACK_UNITS).optional(),
  packLabel: z.string().max(60).optional(),
  price: z.number().nonnegative(),
  stock: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().default(true),
});

const optionItemInputSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  priceDelta: z.number().default(0),
  imageUrl: z.string().url().optional(),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

const optionGroupInputSchema = z.object({
  name: z.string().min(1).max(80),
  selectionRule: z.enum(SELECTION_RULES),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).default(0),
  items: z.array(optionItemInputSchema).default([]),
}).transform((d) => {
  // Derive canonical min/max from the rule when the caller didn't pin them, so
  // the rule and its bounds always stay in agreement.
  const fallback = ruleDefaults(d.selectionRule);
  return {
    ...d,
    minSelect: d.minSelect ?? fallback.minSelect,
    maxSelect: d.maxSelect ?? fallback.maxSelect,
  };
}).superRefine((d, ctx) => {
  const ruleErr = optionGroupRuleError(d);
  if (ruleErr) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: ruleErr, path: ['maxSelect'] });
  }
  // A populated group must be satisfiable - it can't ask for more picks than it
  // offers. Empty groups are allowed: the dashboard creates the group first and
  // the merchant adds items afterwards.
  if (d.items.length > 0 && d.minSelect > d.items.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `This group asks for ${d.minSelect} pick(s) but only has ${d.items.length} item(s)`,
      path: ['minSelect'],
    });
  }
});

const createProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  basePrice: z.number().nonnegative('Price must be non-negative'),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().default(true),
  stock: z.number().int().min(0).default(0),
  requiresPrescription: z.boolean().default(false),
  dosage: z.string().max(120).optional(),

  /// Optional inline variant + option-group setup. When omitted, a default
  /// single variant is created from basePrice/stock.
  variants: z.array(variantInputSchema).optional(),
  optionGroups: z.array(optionGroupInputSchema).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  basePrice: z.number().nonnegative().optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().optional(),
  stock: z.number().int().min(0).optional(),
  requiresPrescription: z.boolean().optional(),
  dosage: z.string().max(120).optional(),
});

const toggleProductAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

const updateVariantSchema = variantInputSchema.partial();

const optionGroupUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  selectionRule: z.enum(SELECTION_RULES).optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const optionItemUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(200).nullable().optional(),
  priceDelta: z.number().optional(),
  imageUrl: z.string().url().nullable().optional(),
  isDefault: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const merchantAnalyticsSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('7d'),
});

const merchantOrderHistorySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

module.exports = {
  createMerchantSchema,
  updateMerchantSchema,
  listMerchantsSchema,
  toggleMerchantStatusSchema,
  updateCommissionSchema,
  MERCHANT_STATUSES,
  // Merchant dashboard schemas
  updateMerchantProfileSchema,
  merchantOrdersSchema,
  rejectOrderSchema,
  updateOrderStatusSchema,
  requestWithdrawalSchema,
  saveBankAccountSchema,
  merchantProductsSchema,
  createProductSchema,
  updateProductSchema,
  toggleProductAvailabilitySchema,
  merchantAnalyticsSchema,
  merchantOrderHistorySchema,
  // variants + option groups
  variantInputSchema,
  updateVariantSchema,
  optionGroupInputSchema,
  optionGroupUpdateSchema,
  optionItemInputSchema,
  optionItemUpdateSchema,
  PACK_UNITS,
  SELECTION_RULES,
  optionGroupRuleError,
};
