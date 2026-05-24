/**
 * Contact-form validator — marketing-site "Send us a message" form.
 */

const { z } = require('zod');

const createContactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(160),
  message: z.string().trim().min(10, 'Please write at least a short message').max(5000),
  source: z.string().trim().max(255).optional(),
});

module.exports = { createContactMessageSchema };
