/**
 * Configuration loader — validates all environment variables at startup.
 * If any required variable is missing, the server will NOT start.
 *
 * External service keys are optional in development mode.
 * They become required in staging/production.
 */

const { z } = require('zod');
require('dotenv').config();

const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_NAME: z.string().default('iPrime'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // JWT — always required
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // AlRahuz Data — Nigerian VTU provider
  ALRAHUZ_TOKEN: isDev ? z.string().default('') : z.string().min(1),

  // AirtimeToCash Automation — customer sells airtime → wallet credit
  AIRTIMETOCASH_TOKEN: isDev ? z.string().default('') : z.string().min(1),

  // Google Maps — required in production, optional in dev
  GOOGLE_MAPS_API_KEY: isDev ? z.string().default('') : z.string().min(1),

  // Firebase — required in production, optional in dev
  FIREBASE_PROJECT_ID: isDev ? z.string().default('') : z.string().min(1),
  FIREBASE_PRIVATE_KEY: isDev ? z.string().default('') : z.string().min(1),
  FIREBASE_CLIENT_EMAIL: isDev ? z.string().default('') : z.string().email(),

  // Cloudinary — required in production, optional in dev
  CLOUDINARY_CLOUD_NAME: isDev ? z.string().default('') : z.string().min(1),
  CLOUDINARY_API_KEY: isDev ? z.string().default('') : z.string().min(1),
  CLOUDINARY_API_SECRET: isDev ? z.string().default('') : z.string().min(1),

  // Termii — required in production, optional in dev
  TERMII_BASE_URL: isDev ? z.string().default('https://api.ng.termii.com') : z.string().url(),
  TERMII_API_KEY: isDev ? z.string().default('') : z.string().min(1),
  TERMII_SECRET_KEY: isDev ? z.string().default('') : z.string().min(1),
  TERMII_SENDER_ID: isDev ? z.string().default('') : z.string().min(1),

  // Temporary bypass for KYC phone-OTP. Set to 'true' while Termii sender ID
  // approval is pending so users can verify BVN without proving phone
  // ownership. Trust-based — DO NOT leave on in steady-state production.
  SKIP_KYC_PHONE_OTP: z
    .string()
    .optional()
    .transform((v) => v === 'true')
    .default('false'),

  // Email (SMTP) — required in production, optional in dev so a fresh clone
  // boots even before transactional mail is wired up. Outbound mail attempts
  // fail at request time with a clear error rather than blocking startup.
  SMTP_USER: isDev ? z.string().optional().default('') : z.string().email(),
  SMTP_PASS: isDev ? z.string().optional().default('') : z.string().min(1),
  SMTP_FROM_NAME: z.string().default('iPrime'),

  // KatPay — required in production, optional in dev
  KATPAY_BASE_URL: z.string().default('https://api.katpay.co'),
  KATPAY_API_SECRET: isDev ? z.string().default('') : z.string().min(1),
  KATPAY_PUBLIC_KEY: isDev ? z.string().default('') : z.string().min(1),
  KATPAY_MERCHANT_ID: isDev ? z.string().default('') : z.string().min(1),
  KATPAY_CALLBACK_URL: isDev ? z.string().default('http://localhost:3000/api/webhooks/katpay') : z.string().url(),

  // Delivery Pricing
  DELIVERY_BASE_FARE: z.coerce.number().default(200),
  DELIVERY_PER_KM_RATE: z.coerce.number().default(100),
  DELIVERY_PLATFORM_FEE_PERCENT: z.coerce.number().default(10),

  // Sentry — DSN is optional everywhere; when absent the SDK no-ops, so
  // dev + CI never need an account. Set SENTRY_DSN in staging/production.
  // The release tag (commit SHA, build id) lets Sentry group errors per
  // deploy; SENTRY_ENVIRONMENT distinguishes staging from production
  // when both point at the same project.
  SENTRY_DSN: z.string().optional().default(''),
  SENTRY_ENVIRONMENT: z.string().optional().default(''),
  SENTRY_RELEASE: z.string().optional().default(''),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // CORS — comma-separated list of allowed Origins. In dev this defaults to
  // '*' so Expo / web dashboards on any local port keep working. In staging
  // and production it MUST be an explicit list; setting '*' there is a hard
  // misconfiguration (browsers don't even honor it with credentials).
  //
  // Example: CORS_ALLOWED_ORIGINS=https://app.iprime.ng,https://admin.iprime.ng
  CORS_ALLOWED_ORIGINS: isDev
    ? z.string().optional().default('*')
    : z.string().min(1, 'CORS_ALLOWED_ORIGINS must be set in non-dev'),
});

let config;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:');
  console.error(error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = { config };
