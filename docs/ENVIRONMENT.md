# Environment Variables

All variables required to run the backend. Copy `.env.example` to `.env` and fill in your values.

> **NEVER commit `.env` files to Git. Only `.env.example` is tracked.**

---

## Application

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Environment: `development`, `staging`, `production` |
| `PORT` | Yes | `3000` | HTTP server port |
| `APP_NAME` | No | `iPrime` | Application name (used in logs) |

## Database (PostgreSQL)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Full PostgreSQL connection string. Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public` |

## Redis

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | Yes | `localhost` | Redis server hostname |
| `REDIS_PORT` | Yes | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | — | Redis auth password (if configured) |

## Authentication (JWT)

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | Yes | — | Secret for signing access tokens. Min 32 characters. |
| `JWT_REFRESH_SECRET` | Yes | — | Secret for signing refresh tokens. Min 32 characters. Must differ from access secret. |
| `JWT_ACCESS_EXPIRY` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token lifetime |

## KatPay (Wallet Funding, Virtual Accounts & Withdrawals)

Sole payment provider — issues NUBAN virtual accounts per user, processes inbound funding via webhook, and handles bank disbursements (withdrawals).

| Variable | Required | Default | Description |
|---|---|---|---|
| `KATPAY_BASE_URL` | No | `https://api.katpay.co` | KatPay API base URL |
| `KATPAY_API_SECRET` | Prod | — | KatPay API secret key |
| `KATPAY_PUBLIC_KEY` | Prod | — | KatPay public key |
| `KATPAY_MERCHANT_ID` | Prod | — | KatPay merchant ID |
| `KATPAY_CALLBACK_URL` | Prod | `http://localhost:3000/api/webhooks/katpay` | Webhook callback URL for payment events |

## AlRahuz (Utility Payments)

Nigerian VTU provider for airtime, data bundles, electricity, and cable TV.

| Variable | Required | Description |
|---|---|---|
| `ALRAHUZ_TOKEN` | Prod | API token from alrahuzdata.com.ng. See `docs/providers/alrahuz.md` for full API reference. |

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

## Termii (SMS/OTP)

| Variable | Required | Default | Description |
|---|---|---|---|
| `TERMII_BASE_URL` | No | `https://api.ng.termii.com` | Termii API base URL |
| `TERMII_API_KEY` | Prod | — | Termii API key |
| `TERMII_SECRET_KEY` | Prod | — | Termii secret key |
| `TERMII_SENDER_ID` | Prod | — | Registered sender ID for SMS |

## Email (SMTP)

Transactional email for merchant approvals, withdrawal receipts, etc.

| Variable | Required | Description |
|---|---|---|
| `SMTP_USER` | Yes | SMTP account email address |
| `SMTP_PASS` | Yes | SMTP account password or app password |
| `SMTP_FROM_NAME` | No | Display name for outgoing emails (default: `iPrime`) |

## Cloudinary (Image Uploads)

Used for merchant logos, cover images, product photos, and prescription uploads.

| Variable | Required | Description |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Prod | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Prod | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Prod | Cloudinary API secret |

## Delivery Pricing

These defaults can also be managed at runtime via the admin settings panel (`/api/settings`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `DELIVERY_BASE_FARE` | No | `200` | Base fare in Naira for any delivery |
| `DELIVERY_PER_KM_RATE` | No | `100` | Additional cost per kilometer |
| `DELIVERY_PLATFORM_FEE_PERCENT` | No | `10` | Platform fee as percentage of fare |

---

> **Note:** Variables marked **Prod** are optional in `development` mode (the server starts with empty defaults) but are required in `staging` and `production`. Missing required production variables cause the server to exit immediately at startup with a descriptive error.
