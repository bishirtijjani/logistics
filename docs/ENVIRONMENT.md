# Environment Variables

All variables required to run the backend. Copy `.env.example` to `.env` and fill in your values.

> **NEVER commit `.env` files to Git. Only `.env.example` is tracked.**

---

## Application

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Environment: `development`, `staging`, `production` |
| `PORT` | Yes | `3000` | HTTP server port |
| `APP_NAME` | No | `VTU-Logistics` | Application name (used in logs) |

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

## Monnify (Payments)

| Variable | Required | Description |
|---|---|---|
| `MONNIFY_BASE_URL` | Yes | API base. Sandbox: `https://sandbox.monnify.com`. Live: `https://api.monnify.com` |
| `MONNIFY_API_KEY` | Yes | Monnify API key from dashboard |
| `MONNIFY_SECRET_KEY` | Yes | Monnify secret key from dashboard |
| `MONNIFY_CONTRACT_CODE` | Yes | Contract code for virtual account creation |
| `MONNIFY_WEBHOOK_SECRET` | Yes | Secret for verifying webhook signatures (HMAC-SHA512) |

## VTPass (Utility Payments)

| Variable | Required | Description |
|---|---|---|
| `VTPASS_BASE_URL` | Yes | API base. Sandbox: `https://sandbox.vtpass.com/api`. Live: `https://vtpass.com/api` |
| `VTPASS_USERNAME` | Yes | VTPass API username |
| `VTPASS_PASSWORD` | Yes | VTPass API password |

## Google Maps

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps Platform API key. Must have: Distance Matrix, Geocoding, Directions APIs enabled. |

## Firebase (Push Notifications)

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Yes | Service account private key (include `\n` for line breaks) |
| `FIREBASE_CLIENT_EMAIL` | Yes | Service account email |

## Termii (SMS/OTP)

| Variable | Required | Description |
|---|---|---|
| `TERMII_BASE_URL` | Yes | `https://api.ng.termii.com` |
| `TERMII_API_KEY` | Yes | Termii API key |
| `TERMII_SENDER_ID` | Yes | Registered sender ID for SMS |

## Delivery Pricing

| Variable | Required | Default | Description |
|---|---|---|---|
| `DELIVERY_BASE_FARE` | No | `200` | Base fare in Naira for any delivery |
| `DELIVERY_PER_KM_RATE` | No | `100` | Additional cost per kilometer |
| `DELIVERY_PLATFORM_FEE_PERCENT` | No | `10` | Platform fee as percentage of fare |
