/**
 * Validation schemas for maps endpoints.
 */

const { z } = require("zod");

const autocompleteSchema = z.object({
  query: z.string().min(2).max(200),
  sessionToken: z.string().optional(),
});

const placeDetailsSchema = z.object({
  placeId: z.string().min(1),
  sessionToken: z.string().optional(),
});

const reverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const customPlacesSchema = z.object({
  north: z.coerce.number().min(-90).max(90),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  west: z.coerce.number().min(-180).max(180),
});

module.exports = {
  autocompleteSchema,
  placeDetailsSchema,
  reverseGeocodeSchema,
  customPlacesSchema,
};
