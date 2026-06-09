/**
 * Rider module - Zod validation schemas.
 */

const { z } = require('zod');

// Document URLs/dates are sent with the mobile app's field names (American
// spelling); rider.service maps them onto the Rider columns (British spelling).
// Expiry + DOB arrive as 'YYYY-MM-DD' strings from the app's date pickers, so
// we coerce them to Date here.
const riderRegistrationSchema = z.object({
  vehicleType: z.enum(['MOTORCYCLE', 'BICYCLE', 'CAR', 'VAN']),
  plateNumber: z.string().min(3).max(15),
  vehicleColor: z.string().max(30).optional(),

  // Identity
  ninNumber: z.string().length(11).regex(/^\d{11}$/, 'NIN must be 11 digits').optional(),
  idDocumentUrl: z.string().url().max(1024).optional(),
  vehiclePhotoUrl: z.string().url().max(1024).optional(),

  // Driver's licence
  driverLicenseNumber: z.string().min(3).max(50).optional(),
  driverLicenseUrl: z.string().url().max(1024).optional(),
  driverLicenseExpiresAt: z.coerce.date().optional(),

  // Vehicle registration
  vehicleRegistrationUrl: z.string().url().max(1024).optional(),
  vehicleRegistrationExpiresAt: z.coerce.date().optional(),

  // Insurance
  insuranceCertificateUrl: z.string().url().max(1024).optional(),
  insuranceExpiresAt: z.coerce.date().optional(),

  // Personal - persisted on the User record
  dateOfBirth: z.coerce.date().optional(),
  address: z.string().max(255).optional(),
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

// Phase 7 - document re-upload + offer decline.
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
