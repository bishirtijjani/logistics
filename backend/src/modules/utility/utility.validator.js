/**
 * Utility module — Zod validation schemas.
 */

const { z } = require('zod');

const buyAirtimeSchema = z.object({
  phone: z.string().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number'),
  amount: z.coerce.number().int().min(50).max(50000),
  provider: z.enum(['MTN', 'AIRTEL', 'GLO', '9MOBILE']),
  pin: z.string().length(6),
});

const buyDataSchema = z.object({
  phone: z.string().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number'),
  provider: z.enum(['MTN', 'AIRTEL', 'GLO', '9MOBILE']),
  planCode: z.string().min(1),
  amount: z.coerce.number().positive(),
  pin: z.string().length(6),
});

const payElectricitySchema = z.object({
  meterNumber: z.string().min(11).max(15),
  disco: z.string().min(2),
  meterType: z.enum(['prepaid', 'postpaid']),
  amount: z.coerce.number().int().min(500),
  pin: z.string().length(6),
});

const billHistorySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['AIRTIME', 'DATA', 'ELECTRICITY']).optional(),
});

module.exports = {
  buyAirtimeSchema,
  buyDataSchema,
  payElectricitySchema,
  billHistorySchema,
};
