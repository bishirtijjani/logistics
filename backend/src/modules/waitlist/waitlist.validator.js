/**
 * Waitlist validator schemas - pre-launch sign-ups from the marketing site.
 */

const { z } = require('zod');

const WAITLIST_ROLES = ['CUSTOMER', 'RIDER', 'UNKNOWN'];
const WAITLIST_PLATFORMS = ['IOS', 'ANDROID', 'UNKNOWN'];

// Loose phone validation - the form is public and we'd rather capture a lead
// with a slightly malformed number than reject it. Trim and require ≥7 digits
// once non-digits are stripped.
const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Please enter a valid phone number')
  .max(20, 'Phone number is too long')
  .refine((v) => (v.match(/\d/g) || []).length >= 7, 'Please enter a valid phone number');

const createWaitlistEntrySchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .email('Please enter a valid email')
    .max(160)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  city: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  role: z.enum(WAITLIST_ROLES).optional().default('UNKNOWN'),
  platform: z.enum(WAITLIST_PLATFORMS).optional().default('UNKNOWN'),
  source: z.string().trim().max(255).optional(),
  // Honeypot - hidden in the UI. See contact.validator for the full rationale.
  website: z.string().max(200).optional().default(''),
});

const listWaitlistQuerySchema = z.object({
  role: z.enum(WAITLIST_ROLES).optional(),
  platform: z.enum(WAITLIST_PLATFORMS).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

module.exports = {
  WAITLIST_ROLES,
  WAITLIST_PLATFORMS,
  createWaitlistEntrySchema,
  listWaitlistQuerySchema,
};
