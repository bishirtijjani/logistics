# iPrime Privacy Policy

**Effective date:** {{EFFECTIVE_DATE}}  
**Last updated:** {{LAST_UPDATED_DATE}}

> **Placeholders in this draft** (replace before publishing):  
> `{{LEGAL_ENTITY}}` — registered company name (e.g. "iPrime Logistics Limited")  
> `{{CAC_RC_NUMBER}}` — CAC RC/BN registration number  
> `{{REGISTERED_ADDRESS}}` — full registered address  
> `{{SUPPORT_EMAIL}}` — user-facing support inbox  
> `{{DPO_EMAIL}}` — Data Protection Officer contact (NDPR §2.6 requires one for any controller processing >2,000 NG data subjects/year — likely you)  
> `{{EFFECTIVE_DATE}}` / `{{LAST_UPDATED_DATE}}` — set on publish

---

## 1. Who we are

iPrime ("**iPrime**", "**we**", "**us**", "**our**") is a logistics, payments,
and digital-services platform operated by **{{LEGAL_ENTITY}}**, a company
registered in Nigeria under CAC number **{{CAC_RC_NUMBER}}**, with its
registered office at **{{REGISTERED_ADDRESS}}**.

We are the **data controller** for personal data you provide while using
the iPrime customer app, iPrime rider app, or merchant tools. This policy
explains what we collect, why, how long we keep it, who we share it with,
and the rights you have under the **Nigeria Data Protection Act, 2023
(NDPA)** and the **NDPR** (its implementing regulation).

If you only want a summary: we collect what we need to run logistics
deliveries, hold a wallet for you, and verify your identity for financial
transactions — and nothing else.

---

## 2. The data we collect

### 2.1 Information you give us directly

| Category | Examples | Why we need it |
|---|---|---|
| **Account & profile** | First name, last name, email, phone number, password (stored hashed only), profile photo | To create and secure your account; to display your name to merchants and riders during a delivery |
| **Identity (KYC)** | Bank Verification Number (BVN — stored hashed only), date of birth, residential address | Required by the Central Bank of Nigeria (CBN) and our payment partners before we can provision a wallet or process transfers |
| **Transaction PIN** | Your 6-digit PIN (stored hashed only) | Confirms financial actions; we never see the plain PIN, even internally |
| **Delivery & address details** | Saved addresses (label, street, GPS coordinates), recipient names/phones you enter for package deliveries | To match riders, calculate fares, and complete deliveries |
| **Order contents** | Items in your cart, prescriptions you upload at pharmacy checkout, special instructions you send merchants | To fulfill the order; prescriptions are stored encrypted in our image host and accessible only by the assigned pharmacist + you |
| **Support messages** | Tickets you raise, photos you attach, messages with riders/merchants in a request thread | To respond to support requests and resolve disputes |

### 2.2 Information we collect automatically

| Category | Examples | Why |
|---|---|---|
| **Device & session** | Device model, OS version, app version, IP address, login timestamps, language preference | To secure your account against takeovers; to debug technical issues |
| **Location** | While the customer app is open and you're selecting a delivery address: your current GPS position. For riders: continuous GPS while a trip is active | To show your location on the map, route deliveries, and let customers track riders |
| **Usage analytics** | Screens visited, taps, time spent, error events | To find bugs, fix slow screens, and decide what to build next. Aggregated and anonymized where possible |
| **Push notification token** | Firebase Cloud Messaging (FCM) token | To deliver order updates, OTP messages, and rider chats |

### 2.3 Riders only — additional data

Riders go through stricter KYC because they handle other people's money and
goods. In addition to the above, we collect:

- Driving licence number and a photo of the licence
- Vehicle registration details and a photo of the vehicle papers
- Insurance and roadworthiness certificates (where applicable)
- Vehicle plate number and photos of the vehicle
- Live GPS during every active trip (stored for 30 days after the trip ends, then deleted)

### 2.4 What we do **NOT** collect

- We do not access your contacts, SMS messages, call logs, or camera roll
  beyond images you explicitly upload.
- We do not run background GPS tracking when no trip is active for riders,
  and never for customers.
- We do not collect biometric data (fingerprints, face scans). On iOS we
  use Face ID / Touch ID *only* through Apple's local authentication API,
  which never sends biometric data off-device to anyone.
- We do not buy data from third-party brokers about you.

---

## 3. Why we process your data ("lawful basis" under NDPA)

Each processing activity needs a lawful basis. Ours:

| Activity | Lawful basis under NDPA §25 |
|---|---|
| Creating your account, fulfilling deliveries, holding your wallet | **Performance of a contract** with you (Terms of Service) |
| KYC verification (BVN, identity) | **Legal obligation** — CBN regulations and AML/CFT requirements |
| Sending order-status push notifications and OTPs | **Performance of contract** |
| Sending marketing emails or in-app promotions | **Consent** — opt-in, and you can revoke at any time |
| Detecting and preventing fraud, chargebacks, and abuse | **Legitimate interest** — protecting the platform and other users |
| Crash and error reporting | **Legitimate interest** — keeping the app working |

---

## 4. Who we share data with

We share only the minimum data needed, and only with parties bound by
contract or by Nigerian law.

### 4.1 Other users on the platform

To complete a delivery:
- **Merchants** see your name, the items you ordered, and any special
  instructions — but not your phone number or address until you confirm.
- **Riders** see the pickup and dropoff addresses, your first name, and a
  masked phone number for in-app calls. The masking is done via our
  telephony partner so the rider never sees your real number.

### 4.2 Service providers

We work with regulated, contracted vendors. Each only sees what their
function strictly requires:

| Provider | Data shared | Purpose |
|---|---|---|
| **KatPay** | BVN hash, name, account details | NUBAN wallet provisioning, bank transfers, settlement |
| **Termii** | Phone number, OTP code | Sending SMS verification codes |
| **Cloudinary** | Profile photos, prescription images, support attachments | Image hosting (uploads are signed, time-limited) |
| **Google Maps Platform** | GPS coordinates, addresses you search | Geocoding, route calculation, distance & ETA |
| **Firebase Cloud Messaging (Google)** | FCM token, notification payload | Push notification delivery |
| **Sentry** | Error stack traces, request IDs (PII stripped before send) | Crash reporting |
| **Posthog / Firebase Analytics** | Anonymized event data | Product analytics |
| **AlRahuz** *(if used)* | Limited transaction metadata | Specific payment rails |

### 4.3 Legal disclosure

We may share data when required to:
- Comply with a court order, regulatory request, or other legal process
- Cooperate with law enforcement on suspected fraud, money laundering, or terror financing
- Defend the platform in legal proceedings

We will not voluntarily hand over your data without one of the above.

### 4.4 What we never do

- We do not sell your data.
- We do not lease, rent, or trade your data.
- We do not share your contacts, messages, or chat content with advertisers.

---

## 5. How long we keep your data ("retention")

| Data | Retention |
|---|---|
| Account profile | While your account is active + 90 days after deletion request |
| Wallet transactions, escrow records, refunds | **5 years** after the transaction (CBN / AML retention requirement) |
| KYC documents (BVN hash, ID copies) | **5 years** after account closure (CBN / AML) |
| Support tickets and dispute records | 5 years after resolution |
| Trip GPS history (riders) | 30 days after the trip ends, then deleted |
| Security logs (sessions, login IPs) | 90 days |
| Crash reports and analytics | 90 days (Sentry / Posthog defaults) |
| Push tokens | Until you log out on that device, or until invalidated by the OS |

Where regulation forces a longer retention period than you'd otherwise
prefer (e.g. AML), we minimize what we keep and segregate it from active
systems.

---

## 6. Where your data is stored

Our application servers and databases run in cloud infrastructure
(`{{CLOUD_REGION}}`). Some service providers (Google Maps, Firebase,
Cloudinary, Sentry) may process data outside Nigeria. When data is
transferred outside Nigeria, we rely on:

- Contractual safeguards (Data Processing Addenda with each vendor), and
- Adequacy decisions or other transfer mechanisms recognized by the NDPC.

---

## 7. Your rights under the NDPA

You have the right to:

- **Access** the personal data we hold about you
- **Correct** data that is wrong or incomplete
- **Delete** your account and the personal data associated with it (subject
  to the retention limits in §5 — we cannot delete records the law forces
  us to keep)
- **Restrict** processing in specific situations
- **Object** to processing based on legitimate interest
- **Port** your data to another service in a structured, machine-readable format
- **Withdraw consent** to marketing or optional features at any time
- **Lodge a complaint** with the **Nigeria Data Protection Commission (NDPC)** at https://ndpc.gov.ng

To exercise any of these rights, email **{{DPO_EMAIL}}**. We respond within
30 days as required by the NDPA. Identity verification may be required for
sensitive requests to prevent account takeover.

---

## 8. Security

We protect your data with:

- Passwords and PINs stored as bcrypt hashes — never recoverable in plaintext, even by us
- BVN stored as a one-way hash — never recoverable
- TLS 1.2+ for all data in transit (app ↔ server, server ↔ partners)
- HMAC-signed payment tokens to prevent tampering
- Per-user rate limits, abuse heuristics, and device-fingerprinted sessions
- Crash-report PII scrubbing before data leaves the device
- Annual third-party security audit (planned for V1 release year)

No system is perfectly secure. If we ever suffer a breach affecting your
personal data, we will notify you and the NDPC within the timelines
required by the NDPA (currently 72 hours for high-risk breaches).

---

## 9. Children's privacy

iPrime is not intended for users under **18**. CBN regulations also
require account holders to be of legal age. If we learn we have collected
data from a minor, we delete it.

---

## 10. Changes to this policy

We may update this policy. Material changes will be announced in the app
and (where you've given us your email) by email at least 30 days before
they take effect. The "Last updated" date at the top is authoritative.

---

## 11. Contact us

- **General support:** {{SUPPORT_EMAIL}}
- **Data Protection Officer (DPO):** {{DPO_EMAIL}}
- **Postal:** {{LEGAL_ENTITY}}, {{REGISTERED_ADDRESS}}
- **NDPC:** https://ndpc.gov.ng — if you believe we have not handled your data correctly

---

*This policy is published in English and Hausa. Where there is a conflict
between versions, the English version controls.*
