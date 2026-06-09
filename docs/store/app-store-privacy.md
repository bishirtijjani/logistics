# App Store Connect - Privacy Questionnaire

The answers below are derived from the actual data model (see
`backend/prisma/schema.prisma`) and the third-party services in
`docs/legal/privacy-policy.md`. Use these to fill in App Store Connect
→ App Privacy when submitting the customer app.

> **Same answers apply to the rider app** unless explicitly flagged
> "rider only" below.

---

## Data Types - what we collect

Apple's questionnaire is keyed on canonical data types. For each, three
follow-ups: (a) **is it linked to the user**, (b) **is it used for
tracking**, (c) **what purposes do we use it for**.

| Apple data type | Collected? | Linked to user? | Tracking? | Purposes |
|---|---|---|---|---|
| **Contact Info - Name** | Yes | Yes | No | App Functionality, Product Personalization |
| **Contact Info - Email** | Yes | Yes | No | App Functionality, Account, Customer Support |
| **Contact Info - Phone Number** | Yes | Yes | No | App Functionality (OTP, masked calls between user + rider) |
| **Contact Info - Physical Address** | Yes | Yes | No | App Functionality (KYC, delivery dropoff) |
| **Contact Info - Other User Contact Info** | No | - | - | - |
| **Health & Fitness** | No | - | - | - |
| **Financial Info - Payment Info** | Yes | Yes | No | App Functionality (wallet balance, transactions, NUBAN account number). We do NOT store card or bank login credentials - wallet funding is via NUBAN bank transfer, not card-on-file. |
| **Financial Info - Credit Info** | No | - | - | - |
| **Financial Info - Other Financial Info** | Yes | Yes | No | KYC: hashed BVN. We do not collect plaintext BVN. |
| **Location - Precise Location** | Yes | Yes | No | App Functionality - delivery dispatch, live tracking. **Rider only - continuous during active trips. Customer - only when actively picking a delivery location.** |
| **Location - Coarse Location** | Yes | Yes | No | App Functionality - show nearby merchants |
| **Sensitive Info** | No | - | - | - |
| **Contacts** | No | - | - | - |
| **User Content - Emails or Text Messages** | Yes | Yes | No | App Functionality - in-app chat between customer, rider, merchant, and support |
| **User Content - Photos or Videos** | Yes | Yes | No | App Functionality - profile photo, prescription images, dispute evidence, proof of delivery |
| **User Content - Audio Data** | No | - | - | - |
| **User Content - Customer Support** | Yes | Yes | No | Customer Support - support tickets + dispute messages |
| **User Content - Other User Content** | Yes | Yes | No | App Functionality - order item special instructions, address labels |
| **Browsing History** | No | - | - | - |
| **Search History** | Yes | No | No | Analytics - query terms for merchant + product search, anonymized via Posthog |
| **Identifiers - User ID** | Yes | Yes | No | App Functionality, Analytics |
| **Identifiers - Device ID** | Yes | Yes | No | Security (device-tied sessions, push targeting via FCM token) |
| **Purchases - Purchase History** | Yes | Yes | No | App Functionality (order history) |
| **Usage Data - Product Interaction** | Yes | No | No | Analytics - screen views, taps (Posthog, anonymized aggregations) |
| **Usage Data - Advertising Data** | No | - | - | - |
| **Usage Data - Other Usage Data** | Yes | No | No | Analytics |
| **Diagnostics - Crash Data** | Yes | No | No | App Functionality (Sentry - PII stripped before send via `beforeSend`) |
| **Diagnostics - Performance Data** | Yes | No | No | Analytics (Sentry traces, sampled) |
| **Diagnostics - Other Diagnostic Data** | Yes | No | No | Analytics |
| **Other Data Types** | No | - | - | - |

---

## Tracking declaration

**Do we use any data for tracking across other companies' apps and websites?**

**No.**

We do not share user identifiers, device identifiers, or behavioural data
with any third party for the purpose of cross-app/site tracking,
attribution, or advertising. We do not embed any ad SDK or tracker SDK
in the apps.

This means **no AppTrackingTransparency prompt is required** for V1.

---

## Privacy Policy URL

```
https://iprime.ng/legal/privacy
```

(This URL must resolve and contain the document at submission time -
see `docs/store/legal-hosting.md` / Phase 10 #5.3, already deployed.)

---

## Data Use Purposes (Apple's enum)

For reference - Apple defines exactly these purposes; every "Yes" row
above must map to at least one:

- **Third-Party Advertising** - ✗ NEVER selected for any iPrime data
- **Developer's Advertising or Marketing** - ✗ NEVER selected
- **Analytics** - ✓ used for Usage Data, Diagnostics, Search History
- **Product Personalization** - ✓ used for Name (greeting), home tile ordering
- **App Functionality** - ✓ used for almost everything else (the core uses)
- **Other Purposes** - ✗ not used

---

## What changes if we add ads/marketing later

If a future version adds:
- A referral/loyalty program → may need to flip "Product Personalization" for some data types
- Push marketing campaigns → declare "Developer's Advertising or Marketing" for Phone + Email
- Third-party SDK with cross-app identifiers → triggers AppTrackingTransparency, separate dialog flow

None of this is in V1 scope (per `CUSTOMER_APP_ROADMAP.md` Out-of-Scope).
