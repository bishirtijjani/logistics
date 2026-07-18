/**
 * Configuration loader - validates all environment variables at startup.
 * If any required variable is missing, the server will NOT start.
 *
 * External service keys are optional in development mode.
 * They become required in staging/production.
 */

const { z } = require("zod");
require("dotenv").config();

const isDev =
  process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "staging";

const envSchema = z
  .object({
    // Application
    NODE_ENV: z
      .enum(["development", "staging", "production"])
      .default("development"),
    PORT: z.coerce.number().default(3000),
    APP_NAME: z.string().default("iPrime"),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // JWT - always required
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRY: z.string().default("15m"),
    JWT_REFRESH_EXPIRY: z.string().default("7d"),

    // BilalSadaSub - Nigerian VTU/bills provider. Auth (per their docs): the
    // purchase token (`Authorization: Token <...>`) is generated from your
    // username + password via Basic auth on GET /api/user, which also returns the
    // wallet balance. Preferred: set USERNAME + PASSWORD and the adapter mints +
    // caches the token (and powers the admin balance card). Alternatively paste a
    // TOKEN copied from the dashboard to skip generation. Fields are optional so a
    // dev clone boots bare; in non-dev at least one auth method is required (see
    // the superRefine after this object).
    BILALSADASUB_TOKEN: z.string().optional().default(""),
    BILALSADASUB_USERNAME: z.string().optional().default(""),
    BILALSADASUB_PASSWORD: z.string().optional().default(""),
    // Optional shared secret for the BilalSada purchase callback (POST
    // /webhooks/bilalsada). The webhook is a pure accelerator: the synchronous
    // buy response + poll + reconcile sweep already settle every payment without
    // it. Left unset, the endpoint stays dormant (every delivery is rejected,
    // unverified), so the system behaves exactly as it does today. Set it (and
    // configure the same secret in the BilalSada dashboard) to let verified
    // callbacks settle payments faster.
    BILALSADASUB_WEBHOOK_SECRET: z.string().optional().default(""),

    // AlRahuz Data - the secondary VTU/bills provider. Used as the failover
    // target: when admin runs in "both" mode and a BilalSada purchase would
    // otherwise be refunded, we re-attempt it on AlRahuz before crediting the
    // wallet back. Auth is a single static API token (`Authorization: Token
    // <ALRAHUZ_TOKEN>`). Optional so a clone boots bare; only required when the
    // active provider mode includes AlRahuz (asserted lazily in the adapter).
    ALRAHUZ_TOKEN: z.string().optional().default(""),

    // AirtimeToCash Automation - customer sells airtime → wallet credit
    AIRTIMETOCASH_TOKEN: isDev ? z.string().default("") : z.string().min(1),

    // Google Maps - required in production, optional in dev
    GOOGLE_MAPS_API_KEY: isDev ? z.string().default("") : z.string().min(1),

    // Firebase - required in production, optional in dev
    FIREBASE_PROJECT_ID: isDev ? z.string().default("") : z.string().min(1),
    FIREBASE_PRIVATE_KEY: isDev ? z.string().default("") : z.string().min(1),
    FIREBASE_CLIENT_EMAIL: isDev ? z.string().default("") : z.string().email(),

    // Web Push (VAPID) - browser/PWA push notifications. Optional EVERYWHERE:
    // when unset, the web-push channel no-ops (native FCM still works), so a
    // fresh clone boots without keys. Generate a pair with
    // `npx web-push generate-vapid-keys` and put them in the runtime .env.
    // VAPID_SUBJECT must be a mailto: or https: URL identifying the sender.
    VAPID_PUBLIC_KEY: z.string().optional().default(""),
    VAPID_PRIVATE_KEY: z.string().optional().default(""),
    VAPID_SUBJECT: z.string().optional().default("mailto:hello@iprime.ng"),

    // Cloudinary - required in production, optional in dev
    CLOUDINARY_CLOUD_NAME: isDev ? z.string().default("") : z.string().min(1),
    CLOUDINARY_API_KEY: isDev ? z.string().default("") : z.string().min(1),
    CLOUDINARY_API_SECRET: isDev ? z.string().default("") : z.string().min(1),

    // OTP provider - selects which channel sends one-time passcodes. WhatsApp
    // is the default (cheaper, no NCC sender-ID dance). Termii is kept dormant
    // - code paths still exist so flipping back is one env-var change without
    // a redeploy. Transactional (non-OTP) SMS always tries Termii; if Termii
    // isn't configured those messages no-op with a warning rather than blocking.
    OTP_PROVIDER: z.enum(["whatsapp", "termii", "email"]).default("whatsapp"),

    // Termii - fully optional. Required only if OTP_PROVIDER=termii in prod
    // (asserted at boot inside termii.service). When OTP_PROVIDER=whatsapp,
    // Termii is the dormant transactional-SMS channel: configured → it works,
    // unconfigured → those messages skip with a warning.
    TERMII_BASE_URL: z.string().default("https://api.ng.termii.com"),
    TERMII_API_KEY: z.string().optional().default(""),
    TERMII_SECRET_KEY: z.string().optional().default(""),
    TERMII_SENDER_ID: z.string().optional().default(""),

    // WhatsApp Cloud API - required in prod when OTP_PROVIDER=whatsapp.
    // Asserted at boot inside whatsapp.service. The auth template must be
    // pre-approved in Meta Business Manager before it can be used.
    WHATSAPP_API_VERSION: z.string().default("v21.0"),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
    WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().default(""),
    WHATSAPP_ACCESS_TOKEN: z.string().optional().default(""),
    WHATSAPP_AUTH_TEMPLATE_NAME: z.string().default("iprime_otp"),
    WHATSAPP_AUTH_TEMPLATE_LANGUAGE: z.string().default("en_US"),
    // Webhook security - verify token is shown in Meta's UI during webhook
    // setup; app secret is used to validate X-Hub-Signature-256 on each event.
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
    WHATSAPP_APP_SECRET: z.string().optional().default(""),

    // Temporary bypass for KYC phone-OTP. Set to 'true' while Termii sender ID
    // approval is pending so users can verify BVN without proving phone
    // ownership. Trust-based - DO NOT leave on in steady-state production.
    SKIP_KYC_PHONE_OTP: z
      .string()
      .optional()
      .transform((v) => v === "true")
      .default("false"),

    // Email (Brevo SMTP relay) - required in production, optional in dev so a
    // fresh clone boots even before transactional mail is wired up. Outbound
    // mail attempts fail at request time with a clear error rather than
    // blocking startup. SMTP_USER is the Brevo SMTP login (not a mailbox), so
    // the visible "From" address is tracked separately via SMTP_FROM_EMAIL.
    SMTP_USER: isDev ? z.string().optional().default("") : z.string().min(1),
    SMTP_PASS: isDev ? z.string().optional().default("") : z.string().min(1),
    SMTP_FROM_NAME: z.string().default("iPrime"),
    SMTP_FROM_EMAIL: isDev
      ? z.string().optional().default("")
      : z.string().email(),
    // Inbox that receives marketing-site contact-form submissions. Defaults
    // to the public support address; override to route to a shared inbox.
    CONTACT_INBOX_EMAIL: z.string().email().default("hello@iprime.ng"),
    // Operational alerts (e.g. a utility payment HELD for manual review because
    // the provider outcome was indeterminate). Empty → falls back to SMTP_FROM_EMAIL.
    ALERT_EMAIL: z.string().default(""),

    // KatPay - required in production, optional in dev
    KATPAY_BASE_URL: z.string().default("https://api.katpay.co"),
    KATPAY_API_SECRET: isDev ? z.string().default("") : z.string().min(1),
    KATPAY_PUBLIC_KEY: isDev ? z.string().default("") : z.string().min(1),
    KATPAY_MERCHANT_ID: isDev ? z.string().default("") : z.string().min(1),
    KATPAY_CALLBACK_URL: isDev
      ? z.string().default("http://localhost:3000/webhooks/katpay")
      : z.string().url(),

    // Paystack - used ONLY for bank-account name verification (resolve account).
    // Optional everywhere: when unset, verification is skipped and the account
    // name is taken as typed. Payouts always go through KatPay, never Paystack.
    PAYSTACK_BASE_URL: z.string().default("https://api.paystack.co"),
    PAYSTACK_SECRET_KEY: z.string().default(""),
    PAYSTACK_PUBLIC_KEY: z.string().default(""),

    // Delivery Pricing
    DELIVERY_BASE_FARE: z.coerce.number().default(200),
    DELIVERY_PER_KM_RATE: z.coerce.number().default(100),
    DELIVERY_PLATFORM_FEE_PERCENT: z.coerce.number().default(10),

    // Sentry - DSN is optional everywhere; when absent the SDK no-ops, so
    // dev + CI never need an account. Set SENTRY_DSN in staging/production.
    // The release tag (commit SHA, build id) lets Sentry group errors per
    // deploy; SENTRY_ENVIRONMENT distinguishes staging from production
    // when both point at the same project.
    SENTRY_DSN: z.string().optional().default(""),
    SENTRY_ENVIRONMENT: z.string().optional().default(""),
    SENTRY_RELEASE: z.string().optional().default(""),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

    // CORS - comma-separated list of allowed Origins. In dev this defaults to
    // '*' so Expo / web dashboards on any local port keep working. In staging
    // and production it MUST be an explicit list; setting '*' there is a hard
    // misconfiguration (browsers don't even honor it with credentials).
    //
    // Example: CORS_ALLOWED_ORIGINS=https://app.iprime.ng,https://admin.iprime.ng
    CORS_ALLOWED_ORIGINS: isDev
      ? z.string().optional().default("*")
      : z.string().min(1, "CORS_ALLOWED_ORIGINS must be set in non-dev"),
  })
  .superRefine((data, ctx) => {
    // BilalSada needs SOME way to authenticate in non-dev: either the username +
    // password (preferred - the adapter generates the token) or a pasted token.
    const inProd =
      data.NODE_ENV === "production" || data.NODE_ENV === "staging";
    const hasToken = !!data.BILALSADASUB_TOKEN;
    const hasBasic = !!(
      data.BILALSADASUB_USERNAME && data.BILALSADASUB_PASSWORD
    );
    if (inProd && !hasToken && !hasBasic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BILALSADASUB_TOKEN"],
        message:
          "Set BILALSADASUB_USERNAME + BILALSADASUB_PASSWORD (or BILALSADASUB_TOKEN)",
      });
    }
  });

let config;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  console.error("❌ Invalid environment variables:");
  console.error(error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = { config };
