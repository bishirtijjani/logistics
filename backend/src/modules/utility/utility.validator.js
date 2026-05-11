const { z } = require('zod');

const phone = z.string().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number');
const pin = z.string().length(6);

const getPlansSchema = z.object({
  type: z.enum(['AIRTIME', 'DATA', 'CABLE', 'ELECTRICITY']).optional(),
  networkId: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().default(true),
});

const buyAirtimeSchema = z.object({
  phone,
  networkId: z.coerce.number().int().min(1),
  amount: z.coerce.number().int().min(50).max(50000),
  pin,
});

const buyDataSchema = z.object({
  phone,
  planId: z.string().uuid(),
  pin,
});

const buyCableSchema = z.object({
  smartCardNumber: z.string().min(4),
  planId: z.string().uuid(),
  pin,
});

const payElectricitySchema = z.object({
  meterNumber: z.string().min(11).max(15),
  discoId: z.coerce.number().int().min(1),
  meterType: z.enum(['PREPAID', 'POSTPAID']),
  amount: z.coerce.number().int().min(500),
  phone,
  pin,
});

const validateIucSchema = z.object({
  smartCardNumber: z.string().min(4),
  cableNameId: z.coerce.number().int().min(1),
});

const validateMeterSchema = z.object({
  meterNumber: z.string().min(11).max(15),
  discoId: z.coerce.number().int().min(1),
  meterType: z.enum(['PREPAID', 'POSTPAID']),
});

const billHistorySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE', 'EDUCATION_PIN']).optional(),
});

module.exports = {
  getPlansSchema,
  buyAirtimeSchema,
  buyDataSchema,
  buyCableSchema,
  payElectricitySchema,
  validateIucSchema,
  validateMeterSchema,
  billHistorySchema,
};
