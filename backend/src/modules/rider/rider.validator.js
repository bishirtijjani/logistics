/**
 * Rider module — Zod validation schemas.
 */

const { z } = require('zod');

const riderRegistrationSchema = z.object({
  vehicleType: z.enum(['MOTORCYCLE', 'BICYCLE', 'CAR', 'VAN']),
  plateNumber: z.string().min(3).max(15),
  vehicleColor: z.string().max(30).optional(),
  ninNumber: z.string().length(11).regex(/^\d{11}$/, 'NIN must be 11 digits').optional(),
});

const updateAvailabilitySchema = z.object({
  availability: z.enum(['ONLINE', 'OFFLINE']),
});

const updateLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const acceptJobSchema = z.object({
  orderId: z.string().uuid(),
});

module.exports = {
  riderRegistrationSchema,
  updateAvailabilitySchema,
  updateLocationSchema,
  acceptJobSchema,
};
