/**
 * Provider validator schemas
 */

const { z } = require('zod');

const PROVIDER_TYPES = ['RESTAURANT', 'GROCERY', 'PHARMACY'];
const PROVIDER_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REJECTED'];

// ============================================================
// Create Provider Schema
// ============================================================

const createProviderSchema = z.object({
  type: z.enum(PROVIDER_TYPES),
  name: z.string().min(2, 'Provider name is required'),
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
// Update Provider Schema
// ============================================================

const updateProviderSchema = z.object({
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
// List Providers Schema
// ============================================================

const listProvidersSchema = z.object({
  type: z.enum(PROVIDER_TYPES).optional(),
  status: z.enum(PROVIDER_STATUSES).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radius: z.number().min(0.1).max(50).default(10),
  openNow: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Toggle Provider Status Schema
// ============================================================

const toggleProviderStatusSchema = z.object({
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

const requestWithdrawalSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  bankAccount: z.object({
    bankName: z.string().min(2),
    accountNumber: z.string().min(10),
    accountName: z.string().min(2),
  }),
});

const merchantProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().default(true),
  stock: z.number().int().min(0).default(0),
});

const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().optional(),
  stock: z.number().int().min(0).optional(),
});

const toggleProductAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
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
  createProviderSchema,
  updateProviderSchema,
  listProvidersSchema,
  toggleProviderStatusSchema,
  updateCommissionSchema,
  PROVIDER_TYPES,
  PROVIDER_STATUSES,
  // Merchant dashboard schemas
  updateMerchantProfileSchema,
  merchantOrdersSchema,
  rejectOrderSchema,
  updateOrderStatusSchema,
  requestWithdrawalSchema,
  merchantProductsSchema,
  createProductSchema,
  updateProductSchema,
  toggleProductAvailabilitySchema,
  merchantAnalyticsSchema,
  merchantOrderHistorySchema,
};
