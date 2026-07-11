const { z } = require('zod');

const createMerchantDiscountSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(20).regex(/^[A-Z0-9]+$/, 'Code must be alphanumeric'),
  type: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().positive('Discount value must be positive'),
  minOrder: z.coerce.number().nonnegative().default(0),
  maxDiscount: z.coerce.number().positive().optional().nullable(),
  usageLimit: z.coerce.number().int().positive().default(100),
  startDate: z.string().datetime().or(z.date()).optional().nullable(),
  endDate: z.string().datetime().or(z.date()).optional().nullable(),
});

const createMerchantCampaignSchema = z.object({
  name: z.string().trim().min(3, 'Campaign name must be at least 3 characters'),
  type: z.enum(['promotion', 'announcement', 'survey']).default('promotion'),
  description: z.string().optional().nullable(),
  startDate: z.string().datetime().or(z.date()).optional().nullable(),
  endDate: z.string().datetime().or(z.date()).optional().nullable(),
  budget: z.coerce.number().positive('Budget must be positive'),
  targetAudience: z.string().default('all'),
});

module.exports = {
  createMerchantDiscountSchema,
  createMerchantCampaignSchema,
};
