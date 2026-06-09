# Known errors - support action library

Every AppError code the backend emits, paired with: what the user sees,
what it actually means, and what support should do.

This is the contract between the backend error catalog
(`backend/src/utils/error-codes.js`), the mobile i18n strings
(`mobile/customer-app/src/i18n/{en,ha}.json` under `errors.*`), and
the human responding to the support ticket.

When the schema changes (new code, removed code, changed semantics), update
all three at once and bump the "Last verified" date below.

**Last verified:** 2026-05-20 against commit on `main`.

---

## Auth

| Code | User sees (EN) | What it means | Support action |
|---|---|---|---|
| `EMAIL_TAKEN` | "That email is already registered. Sign in instead." | The email exists in `users`. | Suggest sign-in; if user insists it's not theirs, manual ID check before account-recovery (could be a takeover attempt). |
| `PHONE_TAKEN` | "That phone number is already on another account." | Same as above for `phone`. | Same. |
| `INVALID_CREDENTIALS` | "Email or password is incorrect." | bcrypt comparison failed. | Suggest password reset. Don't reveal which field (email vs password) is wrong. |
| `INCORRECT_PASSWORD` | "Password is incorrect." | Used when the email is already validated (e.g. password change flow). | Suggest reset. |
| `PASSWORD_REQUIRED` | "Please set a password." | Account exists (e.g. social signup) but no password is set. | Walk through the "create password" flow. |
| `ACCOUNT_NOT_FOUND` | "No account with that email." | Email isn't in the DB. | Suggest sign-up. |
| `ACCOUNT_SUSPENDED` | "Your account has been suspended. Contact support." | `User.status = SUSPENDED`. | Check `BvnVerificationLog` + recent disputes; this is a Tier-2 escalation (don't unsuspend casually). |
| `ACCOUNT_DEACTIVATED` | "This account has been closed." | User self-closed via Delete Account. | Reactivation is manual: requires re-KYC. |
| `OTP_EXPIRED` | "Code expired - please request a new one." | 10-min Redis TTL on the OTP elapsed. | Tell user to tap Resend OTP. |
| `INVALID_OTP` | "That code didn't match. Try again." | OTP mismatch. | If user has burned 3 attempts, the limiter is now blocking - wait 5 minutes. |
| `REFRESH_TOKEN_INVALID` | "Session expired - please sign in again." | Refresh-token rotation failed (stolen, revoked, or genuinely expired after 7 days). | If recurring for one user: revoke all their sessions, force fresh login. Investigate `Session` rows. |
| `SESSION_NOT_FOUND` | "Session not found." | Session row deleted (e.g. user logged out on another device). | Sign in again. |
| `PIN_NOT_SET` | "Set a PIN to continue." | Trying to confirm a money action without `transactionPin` set. | Walk user to Profile → Security → Set PIN. |
| `PIN_ALREADY_SET` | "You already have a PIN." | Trying to set PIN when one exists. | Use Change PIN instead. |
| `INVALID_PIN` | "Wrong PIN. Try again." | bcrypt mismatch on PIN. | After 6 wrong attempts the service-level lockout kicks in (30 min). The user has to wait. Don't manually unlock. |
| `KYC_INCOMPLETE` | "Complete KYC to use this feature." | Action requires KYC tier above current. | Walk through BVN verification. |
| `BVN_ALREADY_VERIFIED` | "Your BVN is already verified." | User trying to re-verify. | Confirm - usually a misunderstanding. |
| `BVN_MISMATCH` | "BVN doesn't match the details on your bank." | BVN's first-name/last-name/DOB doesn't match what user typed. | Tell user to check spelling against their bank records. If it persists, the bank's BVN record may be stale - they should contact their bank to update. |

---

## Wallet / money path

| Code | User sees (EN) | What it means | Support action |
|---|---|---|---|
| `INSUFFICIENT_BALANCE` | "Your wallet balance is too low for this." | Wallet balance < requested amount. | Suggest funding the wallet. No support work needed. |
| `DUPLICATE_TRANSACTION` | "Looks like you already made this transaction." | Idempotency hit - same Idempotency-Key replayed within window. | Usually the user tapped twice on a slow network - the first one succeeded; show them the receipt. |
| `RECIPIENT_NOT_FOUND` | "We couldn't find an iPrime user at that phone/email." | The transfer recipient lookup returned 0 rows. | If user is sure the recipient is on iPrime, double-check the phone formatting (no country code prefix is allowed in our input; `08012345678`, not `+2348012345678`). |
| `TRANSFER_TO_SELF` | "You can't send money to yourself." | Recipient `userId === sender userId`. | n/a; explain the rule. |
| `AMOUNT_TOO_LOW` | "Amount is below the minimum for this." | Action below platform-setting floor. | Confirm the minimum in the relevant utility/wallet screen; not a bug. |
| `AMOUNT_TOO_HIGH` | "Amount exceeds the maximum allowed." | Action above platform-setting ceiling, or above user's KYC tier limit. | If a legit business case, escalate for KYC-tier review. |

---

## Request / order lifecycle

| Code | User sees (EN) | What it means | Support action |
|---|---|---|---|
| `QUOTE_EXPIRED` | "Your quote expired. Please refresh and try again." | 5-min `quoteToken` TTL elapsed. | Tell user to refresh the cart/checkout screen. Common during slow merchant browsing. |
| `QUOTE_INVALID` | "Couldn't verify your quote. Try refreshing." | `quoteToken` HMAC verification failed (tampering OR stale build sending an old key). | If a single user: ask them to update the app. If many users at once: secret rotated incorrectly - check `QUOTE_TOKEN_SECRET` env. |
| `QUOTE_MISMATCH` | "Your cart changed. Please refresh." | Cart items between quote and create-request don't match what the token locked. | Common when a customer revisits the cart after a long pause; the merchant's price changed mid-session. Refresh fixes it. |
| `INVALID_TRANSITION` | "That action isn't allowed right now." | FSM rejected the status change (e.g. merchant tried to set `DELIVERED` when the rider hasn't picked up). | Check the request's current status in the admin tool; the caller may be racing. |
| `REQUEST_NOT_FOUND` | "We couldn't find that order." | Either bad ID or row was hard-deleted (we don't hard-delete in V1). | Check the ID; for any persistent occurrence, treat as a data-integrity bug. |
| `ALREADY_RATED` | "You've already rated this trip." | Customer trying to rate twice. | n/a; user error. |
| `PRESCRIPTION_REQUIRED` | "One or more items need a valid prescription. Upload it at checkout to continue." | Cart contains a `requiresPrescription` product without a `prescriptionUrl`. | Walk user through the checkout prescription-upload step. |
| `INVALID_PRESCRIPTION_URL` | "We couldn't accept that prescription image. Re-upload." | Uploaded URL isn't from our Cloudinary cloud, or is too large. | Tell user to retake via the in-app upload UI (not paste a random URL). |

---

## Validation & generic

| Code | User sees (EN) | What it means | Support action |
|---|---|---|---|
| `VALIDATION_FAILED` | "Please check the highlighted fields." | Zod schema rejection - most often missing required field or wrong shape. | The mobile client should highlight specific fields; if it doesn't, this is a UI bug (the field highlights logic is per-screen). |
| `NETWORK_ERROR` | "Network error. Please check your connection and try again." | Client synthesized - no HTTP response received (timeout, DNS, offline). | Confirm phone has data/wifi; check our status page. |
| `BAD_REQUEST` | "Something about that request is wrong." (fallback) | Status-derived; specific code wasn't set. | Inspect server logs for that request ID (`x-request-id` header). |
| `UNAUTHORIZED` | "Please sign in." | Status-derived 401. | Re-login. |
| `FORBIDDEN` | "You don't have permission for that." | Status-derived 403. Usually role-mismatch (e.g. CUSTOMER trying a MERCHANT endpoint). | Audit the role check - if a user with the correct role hits this, file a bug. |
| `NOT_FOUND` | "We couldn't find that." | Status-derived 404. Generic fallback when no `code` was set. | Inspect the URL and DB. |
| `CONFLICT` | "That conflicts with something." | Status-derived 409. | Usually a constraint violation (unique key). Inspect logs. |
| `TOO_MANY_REQUESTS` | "Too many requests. Please slow down." | Status-derived 429 from a rate limiter. | Tell user the wait window; for chronic flagging on one IP, investigate (legit shared NAT vs scraper). |
| `INTERNAL_ERROR` | "Something went wrong on our side." | Server 5xx fallback. | Look in Sentry by request ID. Real bug. |
| `SERVICE_UNAVAILABLE` | "Service temporarily unavailable. Try again shortly." | 503; usually a third-party dependency is down. | Check status of KatPay, Termii, Google Maps as applicable. Add a status-page note. |
| `UNKNOWN_ERROR` | "Something went wrong. Please try again." | Catchall when nothing else matches. | Sentry by request ID - this is a tell that we missed adding a specific code. File a backlog ticket to add one. |

---

## Workflow for new error codes

When a new code is added in `backend/src/utils/error-codes.js`:

1. Add a row to this file (under the right section)
2. Add the EN string to `en.json` → `errors.<CODE>`
3. Add the HA string to `ha.json` → `errors.<CODE>` (parity check: the
   project's i18n parity test will fail otherwise)
4. If the user-facing copy needs a specific support action (not just
   "n/a; user error"), note it in the "Support action" column

If you remove a code: leave the row here with a strikethrough + "REMOVED in <commit>", and remove the i18n keys.

---

## Pattern: errors with a recurring root cause

If you see one error code dominating support volume:

| Pattern | What it means | Fix |
|---|---|---|
| `OTP_EXPIRED` spike across users | SMS delivery delay from Termii | Switch to email-OTP fallback flow; raise it with Termii |
| `QUOTE_MISMATCH` spike on Fridays | Merchant changes prices on Friday evenings | Add a merchant warning that price changes invalidate active carts |
| `INSUFFICIENT_BALANCE` correlated with successful funding | Funding hit Sentry's "5xx then succeeded" path | Inspect the webhook idempotency dedupe |
| `BVN_MISMATCH` for users whose names contain hyphens or accents | Backend strips diacritics differently from KatPay | Normalize names the same way before sending |

A pattern like this is a product/eng signal - escalate, don't keep
papering over with the canned support reply.
