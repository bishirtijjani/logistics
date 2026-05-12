const { z } = require('zod');

const addressBody = z.object({
  label: z.string().trim().min(1, 'Label is required').max(60),
  address: z.string().trim().min(3, 'Address is required').max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeId: z.string().trim().max(200).optional(),
  isDefault: z.boolean().optional(),
});

const updateAddressBody = addressBody.partial();

module.exports = {
  createAddressSchema: addressBody,
  updateAddressSchema: updateAddressBody,
};
