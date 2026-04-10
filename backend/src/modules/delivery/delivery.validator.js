/**
 * Delivery module — Zod validation schemas.
 */

const { z } = require('zod');

const createOrderSchema = z.object({
  pickupAddress: z.string().min(5).max(500),
  pickupLat: z.coerce.number().min(-90).max(90),
  pickupLng: z.coerce.number().min(-180).max(180),
  dropoffAddress: z.string().min(5).max(500),
  dropoffLat: z.coerce.number().min(-90).max(90),
  dropoffLng: z.coerce.number().min(-180).max(180),
  itemDescription: z.string().max(300).optional(),
  packageSize: z.enum(['small', 'medium', 'large']).optional(),
});

const estimateFareSchema = z.object({
  pickupLat: z.coerce.number().min(-90).max(90),
  pickupLng: z.coerce.number().min(-180).max(180),
  dropoffLat: z.coerce.number().min(-90).max(90),
  dropoffLng: z.coerce.number().min(-180).max(180),
});

const updateStatusSchema = z.object({
  status: z.enum([
    'RIDER_EN_ROUTE',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
    'CANCELLED',
  ]),
  cancellationReason: z.string().max(300).optional(),
});

const rateDeliverySchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

const listOrdersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum([
    'REQUESTED', 'MATCHED', 'RIDER_EN_ROUTE', 'PICKED_UP',
    'IN_TRANSIT', 'DELIVERED', 'SETTLED', 'CANCELLED',
  ]).optional(),
});

module.exports = {
  createOrderSchema,
  estimateFareSchema,
  updateStatusSchema,
  rateDeliverySchema,
  listOrdersSchema,
};
