# Google Play Console - Data Safety Form

The answers below are the source-of-truth for Play Console → Data
safety, derived from `backend/prisma/schema.prisma` + the third-party
inventory in `docs/legal/privacy-policy.md`.

> Same answers apply to both customer and rider apps unless flagged
> "rider only".

> **Merchant app deltas** (the `mobile/merchant-app` binary):
> - **Location**: approximate + precise collected **only to set the
>   store's pickup point** (one-off, not continuous, no background
>   location). Not the rider "continuous during trips" case.
> - **Financial info**: merchant wallet balance, pending/available
>   earnings, transaction history, and settlement bank account number for
>   withdrawals.
> - **Photos**: product/store images and support attachments.
> - **Other user-generated content**: product listings, store details,
>   support messages.
> - **Purchase history**: the merchant's incoming orders/earnings.
>
> All other rows (identifiers, web & app activity, app info &
> performance) are identical - same backend and SDK inventory.

---

## Section 1 - Data collection & security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** - TLS 1.2+ on all client ↔ server traffic |
| Do you provide a way for users to request that their data be deleted? | **Yes** - Profile → Account → Delete Account, plus DPO email per privacy policy |

---

## Section 2 - Data types collected

Play groups data into **categories**, each with sub-types. For each
sub-type, we declare: (a) is it **collected**, (b) is it **shared**
with third parties, (c) is collection **optional or required**, (d)
the **purpose**.

For iPrime, **"shared"** means **transferred to a third party**, NOT
"used by our service providers under DPA". Per Play's definitions, our
service providers (KatPay, Termii, Cloudinary, Sentry, etc.) count as
data-processing partners, not data sharers, when they only process on
our behalf.

### Personal info

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Name | ✓ | - | Required | Account management; merchant + rider see your name on a trip |
| Email address | ✓ | - | Required | Account management, OTP delivery |
| Phone number | ✓ | - | Required | Account management, OTP, masked phone calls during deliveries |
| Address | ✓ | - | Required | KYC, delivery dropoff |
| Other personal info | ✓ | - | Required | Hashed BVN for KYC; date of birth |

### Financial info

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| User payment info | ✓ | - | Required | Wallet balance, NUBAN account number, transaction history |
| Purchase history | ✓ | - | Required | Order history, receipts |
| Credit score | - | - | - | - |
| Other financial info | ✓ | - | Required | Hashed BVN for KYC compliance |

### Location

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Approximate location | ✓ | - | Required | Show merchants near user; rider–customer matching |
| Precise location | ✓ | - | Required | **Customer:** while picking a delivery address. **Rider only:** continuous during active trips, deleted after 30 days. Documented in privacy policy. |

### Personal identifiers

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| User IDs | ✓ | - | Required | Account management |
| Device or other IDs | ✓ | - | Required | Session security, push notification targeting (FCM token) |

### Web & app activity

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| App interactions | ✓ | - | Optional | Analytics - Posthog, anonymized aggregations |
| In-app search history | ✓ | - | Optional | Analytics - merchant/product search queries |
| Installed apps | - | - | - | - |
| Other user-generated content | ✓ | - | Required | In-app chat (customer/rider/merchant/support), prescription uploads, dispute evidence, order special instructions |
| Other actions | - | - | - | - |

### App info & performance

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Crash logs | ✓ | - | Required | App functionality (Sentry - PII stripped before send) |
| Diagnostics | ✓ | - | Required | App functionality (Sentry traces, perf metrics) |
| Other app performance data | ✓ | - | Optional | Analytics |

### Photos & videos

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Photos | ✓ | - | Optional | Profile photo, prescription image, dispute evidence, proof of delivery |
| Videos | - | - | - | - |

### Messages

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Emails | - | - | - | We send transactional email but do not store inbound emails on user behalf |
| SMS or MMS | - | - | - | OTPs are sent via Termii; we do not read user SMS |
| Other in-app messages | ✓ | - | Required | In-app chat in support tickets and during trips |

### Files & docs

| Sub-type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Files and docs | ✓ | - | Optional | Prescription images, KYC document scans (rider only) |

### Health & fitness, contacts, calendar, audio, navigation/browsing history

**None collected.**

---

## Section 3 - Security practices

| Item | Answer | Notes |
|---|---|---|
| Data is encrypted in transit | **Yes** | TLS 1.2+ everywhere |
| You provide a way to request deletion | **Yes** | In-app + DPO email |
| You follow the [Families Policy](https://play.google.com/about/families/) | **No** | Not targeted at children; 18+ |
| Independent security review | **Planned** | First annual third-party audit planned for V1 release year - disclose honestly here; do not claim a review we haven't done |

---

## Section 4 - Data sharing (NOT processing)

**No data is "shared" in the Play Console sense.** The vendors we use
(KatPay, Termii, Cloudinary, Google Maps Platform, Firebase Cloud
Messaging, Sentry, Posthog) are data-processing partners contracted
under Data Processing Addenda - they only process data on iPrime's
instructions for the stated purposes. Per Google's definitions, this is
not "sharing" and should NOT be declared in the sharing column.

If the form's framing makes this ambiguous, the canonical reference is
[Google's "data sharing" guidance](https://support.google.com/googleplay/android-developer/answer/10787469#zippy=%2Cdata-collection-and-data-sharing).

---

## Section 5 - Privacy Policy URL

```
https://iprime.ng/legal/privacy
```

(Must resolve at the time of review - deployed via Phase 10 #5.3.)

---

## Form vs. Apple parity check

Most rows mirror the Apple privacy questionnaire (see
`docs/store/app-store-privacy.md`). Differences worth noting:

- Google groups KYC data under **Personal info → Other personal info**;
  Apple groups it under **Financial info → Other financial info**. We
  declare it under both per each platform's framing.
- Google has a separate **"Required" vs "Optional"** flag per sub-type;
  Apple doesn't. We mark fields required if removing them blocks the
  account-creation flow, optional otherwise.
- Apple has a tracking declaration; Google does not.

The "what changes if we add ads/marketing later" caveat from the Apple
doc applies equally here - adding any cross-app tracking, third-party
ad SDK, or behavioural advertising would require an update to this
form within 90 days of the change going live.
