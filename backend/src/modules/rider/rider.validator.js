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

// Phase 7 — document re-upload + offer decline.
const reuploadDocumentSchema = z.object({
  kind: z.enum(['ID_DOC', 'DRIVER_LICENCE', 'VEHICLE_PHOTO', 'VEHICLE_REG', 'INSURANCE']),
  url: z.string().url().max(1024),
  // Optional for VEHICLE_PHOTO (no expiry); the service enforces presence
  // for kinds that require one.
  expiresAt: z.string().datetime().optional(),
});

const declineOfferSchema = z.object({
  requestId: z.string().uuid(),
});

module.exports = {
  riderRegistrationSchema,
  updateAvailabilitySchema,
  updateLocationSchema,
  acceptJobSchema,
  reuploadDocumentSchema,
  declineOfferSchema,
};
