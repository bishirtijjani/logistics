/**
 * Custom places - admin-managed map locations (campus buildings, estates,
 * villages) that Google doesn't know about. They merge into maps autocomplete
 * and render as labelled markers on the customer/rider maps.
 */

const { z } = require('zod');

const placeName = z.string().trim().min(1, 'Name is required').max(200);

const createCustomPlaceSchema = z.object({
  name: placeName,
  aliases: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  type: z.string().trim().max(60).optional().nullable(),
  lga: z.string().trim().max(100).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  address: z.string().trim().max(500).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

const updateCustomPlaceSchema = createCustomPlaceSchema.partial();

const listCustomPlacesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().trim().max(200).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

module.exports = {
  createCustomPlaceSchema,
  updateCustomPlaceSchema,
  listCustomPlacesSchema,
};
