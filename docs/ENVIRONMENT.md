# Environment Variables

All variables required to run the backend. Copy `.env.example` to `.env` and fill in your values.

> **NEVER commit `.env` files to Git. Only `.env.example` is tracked.**

---

## Application

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Environment: `development`, `staging`, `production` |
| `PORT` | Yes | `3000` | HTTP server port |
| `APP_NAME` | No | `Logistics Platform` | Application name (used in logs) |

## Database (PostgreSQL)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Full PostgreSQL connection string. Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public` |

## Redis

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | Yes | `localhost` | Redis server hostname |
| `REDIS_PORT` | Yes | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | - | Redis auth password (if configured) |

## Authentication (JWT)

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | Yes | - | Secret for signing access tokens. Min 32 characters. |
| `JWT_REFRESH_SECRET` | Yes | - | Secret for signing refresh tokens. Min 32 characters. Must differ from access secret. |
| `JWT_ACCESS_EXPIRY` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token lifetime |

## KatPay (Wallet Funding, Virtual Accounts & Withdrawals)

Sole payment provider - issues NUBAN virtual accounts per user, processes inbound funding via webhook, and handles bank disbursements (withdrawals).

| Variable | Required | Default | Description |
|---|---|---|---|
| `KATPAY_BASE_URL` | No | `https://api.katpay.co` | KatPay API base URL |
| `KATPAY_API_SECRET` | Prod | - | KatPay API secret key |
| `KATPAY_PUBLIC_KEY` | Prod | - | KatPay public key |
| `KATPAY_MERCHANT_ID` | Prod | - | KatPay merchant ID |
| `KATPAY_CALLBACK_URL` | Prod | `http://localhost:3000/webhooks/katpay` | Webhook callback URL for payment events |

## BilalSadaSub (Utility Payments)

Nigerian VTU provider for airtime, data bundles, electricity, and cable TV.

Auth: provide **username + password** (preferred) and the adapter generates the
`Authorization: Token` value from them via Basic auth on `POST /api/user` (the
same call powers the admin balance card). Or paste a `TOKEN` from the dashboard
to skip generation. In non-dev, at least one method is required. See
`docs/providers/bilalsada.md`.

| Variable | Required | Description |
|---|---|---|
| `BILALSADASUB_USERNAME` | Prod\* | Dashboard username. Used to mint the API token + read the wallet balance. |
| `BILALSADASUB_PASSWORD` | Prod\* | Dashboard password. Paired with the username. |
| `BILALSADASUB_TOKEN` | Optional | Pre-generated token from the dashboard; an alternative to username/password (but then the balance card stays "Not configured"). |

\* Provide **either** `USERNAME` + `PASSWORD` **or** `TOKEN`; boot fails in non-dev if neither is set.

## Google Maps

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Prod | Google Maps Platform API key. Must have: Distance Matrix, Geocoding, Directions, Places APIs enabled. |

## Firebase (Push Notifications)

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Prod | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Prod | Service account private key (include `\n` for line breaks) |
| `FIREBASE_CLIENT_EMAIL` | Prod | Service account email |

## OTP Provider

Selects which channel delivers one-time passcodes (signup, password reset, KYC phone proof, phone-change confirmation). WhatsApp is the default - cheaper per message, no NCC sender-ID approval needed. Termii stays in the codebase as a dormant fallback so flipping back is a one-variable change (no redeploy).

| Variable | Required | Default | Description |
|---|---|---|---|
| `OTP_PROVIDER` | No | `whatsapp` | `whatsapp` or `termii`. Active provider's credentials are required in prod; the other channel can be left unconfigured. |

Transactional (non-OTP) SMS - electricity-token delivery, KYC welcome, phone-change security notices - always tries Termii regardless of this flag. WhatsApp Cloud API requires a separately approved utility template per message type, which is out of scope here. If Termii is unconfigured those messages skip with a warning rather than failing the request.

## WhatsApp Cloud API (Default OTP Provider)

Sends OTPs via an approved authentication template. Requires a Meta Business Account + WhatsApp Business Account with a registered phone number and an approved auth template.

| Variable | Required | Default | Description |
|---|---|---|---|
| `WHATSAPP_API_VERSION` | No | `v21.0` | Graph API version |
| `WHATSAPP_PHONE_NUMBER_ID` | Prod (when active) | - | Phone Number ID from WhatsApp Manager → Phone Numbers |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | No | - | WABA ID - informational, used in logs |
| `WHATSAPP_ACCESS_TOKEN` | Prod (when active) | - | Long-lived System User access token (NOT a User token - those expire in 60 days) |
| `WHATSAPP_AUTH_TEMPLATE_NAME` | No | `logistics_otp` | Name of the approved authentication template |
| `WHATSAPP_AUTH_TEMPLATE_LANGUAGE` | No | `en_US` | Template language code |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | No | - | Shared secret echoed back to Meta on the GET handshake at `/webhooks/whatsapp` |
| `WHATSAPP_APP_SECRET` | No | - | Meta App secret used to verify `X-Hub-Signature-256` on inbound webhook POSTs |

### One-time Meta setup

1. **Meta Business account** - business.facebook.com, registered under your business name (CAC must match)
2. **Business verification** - upload CAC certificate, proof of business address (≤ 90 days old)
3. **Add a phone number** to the WhatsApp Business Account (fresh number, or use the 2024 Coexistence flow to keep an existing consumer-WhatsApp number)
4. **Display name approval** - must match registered brand
5. **Authentication template** - submit a template like:
   `"{{1}} is your Logistics Platform verification code. For your security, do not share this code."` with a "Copy code" button. Use the OTP / authentication category, not utility/marketing.
6. **System User access token** - under Meta Business Settings → System Users → generate token with `whatsapp_business_messaging` + `whatsapp_business_management` scopes. Pick "Never" for expiration.
7. **Webhook** - configure the production URL `https://<host>/webhooks/whatsapp`, subscribe to `messages` field, set Verify Token to whatever you've put in `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

## Termii (Dormant OTP Fallback + Transactional SMS)

Required in prod **only** when `OTP_PROVIDER=termii`. When WhatsApp is active, Termii is dormant: it still handles transactional SMS (electricity tokens, security notices) if configured, and silently no-ops with a warning if not. Flipping `OTP_PROVIDER` back to `termii` requires no code deploy.

| Variable | Required | Default | Description |
|---|---|---|---|
| `TERMII_BASE_URL` | No | `https://api.ng.termii.com` | Termii API base URL |
| `TERMII_API_KEY` | Prod (if active) | - | Termii API key |
| `TERMII_SECRET_KEY` | Prod (if active) | - | Termii secret key |
| `TERMII_SENDER_ID` | Prod (if active) | - | Registered sender ID for SMS |

**Parking transactional SMS:** to turn transactional SMS off without a code change, leave `TERMII_API_KEY` empty (or under 10 chars). `sendSms` then skips with a warning instead of calling Termii, and the welcome/electricity-token/security-notice messages fall back to in-app + push only. Note: if `TERMII_API_KEY` is set but `TERMII_SENDER_ID` is not an approved sender on the Termii account, Termii rejects every send with `ApplicationSenderId not found for senderName` - either approve the sender ID or clear the key to park the channel.

## Email (SMTP)

Transactional email for merchant approvals, withdrawal receipts, etc.

| Variable | Required | Description |
|---|---|---|
| `SMTP_USER` | Yes | SMTP account email address |
| `SMTP_PASS` | Yes | SMTP account password or app password |
| `SMTP_FROM_NAME` | No | Display name for outgoing emails (default: `Logistics Platform`) |
| `CONTACT_INBOX_EMAIL` | No | Inbox that receives marketing-site contact-form submissions (default: `hello@`) |

## Cloudinary (Image Uploads)

Used for merchant logos, cover images, product photos, and prescription uploads.

| Variable | Required | Description |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Prod | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Prod | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Prod | Cloudinary API secret |

## Delivery Pricing

These defaults can also be managed at runtime via the admin settings panel (`/settings`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `DELIVERY_BASE_FARE` | No | `200` | Base fare in Naira for any delivery |
| `DELIVERY_PER_KM_RATE` | No | `100` | Additional cost per kilometer |
| `DELIVERY_PLATFORM_FEE_PERCENT` | No | `10` | Platform fee as percentage of fare |

---

> **Note:** Variables marked **Prod** are optional in `development` mode (the server starts with empty defaults) but are required in `staging` and `production`. Missing required production variables cause the server to exit immediately at startup with a descriptive error.
