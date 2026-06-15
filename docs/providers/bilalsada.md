# BilalSadaSub VTU API

VTU / bills provider for airtime, data, electricity, cable, exam pins.
Replaces AlRahuz (switched 2026-06-15).

- Base URL: `https://bilalsadasub.com`
- Adapter: `backend/src/services/bilalsada.service.js`
- Auth: purchase endpoints use `Authorization: Token <AccessToken>`. Per the
  vendor docs the AccessToken is obtained from `POST /api/user` (empty body)
  using HTTP Basic auth (`base64(username:password)`), which also returns the
  wallet balance. NB: it must be POST - a GET returns HTTP 500 "contact admin".
  - The adapter generates the token from `BILALSADASUB_USERNAME` +
    `BILALSADASUB_PASSWORD` on first use and caches it (it's the account's
    stable token). On a `401` it regenerates once and retries.
  - `BILALSADASUB_TOKEN` may be set instead (token pasted from the dashboard) to
    skip generation; with no username/password the balance card is unavailable.

## Provider IDs (differ from AlRahuz)

| Network | ID |  | Cable | ID |  | Disco | ID |
|---|---|---|---|---|---|---|---|
| MTN | 1 |  | GOTV | 1 |  | Ikeja | 1 |
| AIRTEL | 2 |  | DSTV | 2 |  | Eko | 2 |
| GLO | 3 |  | STARTIME | 3 |  | Kano | 3 |
| 9MOBILE | 4 |  |  |  |  | Port Harcourt | 4 |
|  |  |  |  |  |  | Jos | 5 |
|  |  |  |  |  |  | Ibadan | 6 |
|  |  |  |  |  |  | Kaduna | 7 |
|  |  |  |  |  |  | Abuja | 8 |
|  |  |  |  |  |  | Benin | 9 |
|  |  |  |  |  |  | Enugu | 10 |
|  |  |  |  |  |  | Yola | 11 |

`meter_type` is sent as the lowercase string `prepaid` / `postpaid` (AlRahuz used 1/2).

## Endpoints

| Operation | Method | Path | Body / params |
|---|---|---|---|
| Balance / token | POST | `/api/user` | Basic auth, empty body |
| Airtime | POST | `/api/topup` | `network, phone, amount, plan_type:'VTU', bypass, request-id` |
| Data | POST | `/api/data` | `network, phone, data_plan, bypass, request-id` |
| Electricity | POST | `/api/bill` | `disco, meter_type, meter_number, amount, bypass, request-id` |
| Cable | POST | `/api/cable` | `cable, cable_plan, iuc, bypass, request-id` |
| Exam pin | POST | `/api/exam` | `exam, quantity, request-id` |
| Validate IUC | GET | `/api/cable/cable-validation` | `?iuc=&cable=` |
| Validate meter | GET | `/api/bill/bill-validation` | `?meter_number=&disco=&meter_type=` |

Success responses carry `status: "success"`. `request-id` is required and must be
unique per transaction; we send our wallet reference (`AIR-…`, `DATA-…`, etc.),
which also makes BullMQ retries idempotent on the provider side.

## Known gaps / cutover notes

1. **No transaction query endpoint and webhook is non-operational.** The provider
   settles synchronously, so `queryTransaction` is a no-op (returns null). A
   payment that ever lands PENDING (or whose buy we couldn't confirm inline) is
   refunded after the ~5-minute poll window rather than polled to completion.
2. **No SMILE network** (dropped vs AlRahuz).

## Catalogue (prices / plans)

Plans + provider IDs live in the DB (`vtu_networks`, `vtu_plans`), edited from the
admin dashboard. Source of truth for the initial load is `pricing_tables.md`:

- `node scripts/build-vtu-catalogue.js` → regenerates
  `prisma/data/bilalsada-plans.json` (208 data + 59 cable, ~5% markup rounded up
  to ₦10).
- `node scripts/seed-vtu-catalogue.js` → wipes & reloads `vtu_networks` +
  `vtu_plans` from that JSON. Safe to run in production; touches nothing else.
