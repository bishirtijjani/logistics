/**
 * Contact-form validator — marketing-site "Send us a message" form.
 */

const { z } = require('zod');

const createContactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(160),
  message: z.string().trim().min(10, 'Please write at least a short message').max(5000),
  source: z.string().trim().max(255).optional(),
  // Honeypot — hidden in the UI (CSS off-screen + aria-hidden). Real users
  // never see it. Bots fill every input they find, so a non-empty value is
  // a near-certain bot signal. We don't reject loudly (the bot would retry
  // with a different fill heuristic) — the controller silently no-ops.
  website: z.string().max(200).optional().default(''),
});

module.exports = { createContactMessageSchema };
