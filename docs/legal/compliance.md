# iPrime Compliance Statement

**Effective date:** 2026-05-22  
**Last updated:** {{TODAY}}

---

## 1. Purpose

This page sets out how **MH Prime** ("**iPrime**", "**we**",
"**us**") complies with the laws and regulations that apply to a
Nigerian platform handling personal data, financial transactions, and
last-mile logistics. MH Prime is a business registered with the
Corporate Affairs Commission of Nigeria under business name number
**9518859**, with its registered office at **2, Liyafa Street, Katsina,
Katsina State, Nigeria**.

This page is written for users, partners, journalists, and regulators
alike — and is deliberately specific so you can verify each claim
against the source.

If you're a regulator or compliance counterparty and need formal
attestations, contact **contact@iprime.ng**.

---

## 2. Regulatory framework

iPrime operates inside a stack of Nigerian and international regulations.
This section names every one we hold ourselves to.

### 2.1 Data protection

- **Nigeria Data Protection Act 2023 (NDPA)** — the primary data
  protection statute. We treat user data as the property of the user,
  process it only for the purposes disclosed in the [Privacy
  Policy](/legal/privacy), and respond to data-subject rights requests
  within the statutory timeline.
- **Nigeria Data Protection Regulation (NDPR)** — the implementing
  regulation under the NDPA. We register annually with the **Nigeria Data
  Protection Commission (NDPC)** as a Data Controller of Major
  Importance once we cross the relevant processing thresholds.
- **Data Protection Officer (DPO)** — appointed and reachable at
  **contact@iprime.ng**. The DPO is empowered to halt any processing
  activity they assess as non-compliant.

### 2.2 Financial services

- **Central Bank of Nigeria (CBN)** — wallet, virtual-account, and
  payment functionality is delivered through one or more CBN-licensed
  Payment Service Providers. iPrime does not hold customer funds
  directly; balances are held in segregated accounts at the partner
  institution.
- **NIBSS rules** — instant transfers in and out of the iPrime wallet
  use the NIBSS Instant Payment (NIP) rail through our partner. We
  follow NIBSS reconciliation timelines and abide by their failed-transfer
  reversal rules.
- **Anti-Money Laundering (AML) and Counter-Terrorism Financing (CFT)** —
  every wallet holder is BVN-verified before they can hold a balance.
  Transactions are monitored for thresholds set out under the **Money
  Laundering (Prevention and Prohibition) Act 2022** and reported to the
  **Nigeria Financial Intelligence Unit (NFIU)** where required.
- **Cash-out and bank withdrawal limits** — set in line with our payment
  partner's tiered KYC rules.

### 2.3 Consumer protection

- **Federal Competition and Consumer Protection Act 2018 (FCCPA)** —
  customers have the rights it grants regardless of anything written in
  the [Terms of Service](/legal/terms) or this page. The
  [Refund Policy](/legal/refund) reflects those rights.

### 2.4 Logistics & licensing

- **NIPOST courier licence** — we maintain (or operate under a partner
  who maintains) a courier licence under the **NIPOST Act** for
  inter-city parcel delivery.
- **State transport authority compliance** — our riders operate in line
  with Katsina State motorcycle / dispatch transport requirements,
  including helmet rules and route restrictions where applicable.

---

## 3. Data security

We take a defence-in-depth approach. The following controls are in
place at the time of writing.

| Control | Implementation |
|---|---|
| **Encryption in transit** | All client-to-server and server-to-server traffic uses TLS 1.2 or higher. |
| **Encryption at rest** | Database storage is encrypted at the disk level by our cloud provider; sensitive fields (passwords, PINs, BVN) are stored only as one-way hashes — we cannot read them, even internally. |
| **Secrets management** | Production credentials are stored in a secrets manager, rotated periodically, and never committed to source control. |
| **Access control** | Engineering access to production systems is single-sign-on, requires hardware-key 2FA, and is logged. Customer-facing support tools never expose PINs, BVN, or full card details. |
| **Audit logging** | Every privileged action (admin access, KYC override, manual ledger adjustment) is logged to an append-only audit trail retained for at least 7 years. |
| **Backup & recovery** | Production data is backed up automatically with point-in-time recovery for the last 7 days, and snapshot retention beyond that. |
| **Incident response** | A documented incident playbook covers detection, containment, regulator notification (NDPC within 72 hours where required), and user communication. |
| **Penetration testing** | We engage an independent firm to test the platform at least annually and after any major architectural change. |

---

## 4. KYC and identity verification

Wallet activation requires:

1. **Phone number verification** via OTP.
2. **BVN match** against the National Identity Management Commission /
   NIBSS-backed BVN registry.
3. **NIN match** for tier upgrades that raise transaction limits.
4. **Document upload** (driver's licence, voter's card, or international
   passport) for rider onboarding.
5. **Liveness check** on rider sign-up to prevent identity theft.

We do not store raw BVN or NIN values. Verification happens through
our payment partner and we retain only a match result + a hashed
reference for audit purposes.

---

## 5. AML and transaction monitoring

We screen every wallet operation in real time. Triggers include but are
not limited to:

- Velocity anomalies (e.g. a sudden 10× increase in P2P volume).
- Round-tripping patterns (funds moving in and out in equal amounts).
- KYC-tier mismatches (transactions exceeding the tier's limits).
- Sanctioned-jurisdiction touchpoints.

Flagged transactions are held pending review and, where indicated,
reported to the NFIU under the prescribed Suspicious Transaction Report
template. We do not warn the customer when a report is filed, in line
with the statutory "tipping-off" prohibition.

---

## 6. User rights

The following rights apply to every iPrime user, and we provide
self-service or human-assisted ways to exercise each one:

| Right | How to exercise it |
|---|---|
| **Access your data** | Profile → Settings → "Download my data" (or email **contact@iprime.ng**) |
| **Correct your data** | Profile → Edit details, for fields you can change yourself; via support for KYC-locked fields |
| **Delete your account** | Profile → Settings → "Delete account" (with a 30-day grace period for fraud-related holds) |
| **Object to processing** | Email **contact@iprime.ng** describing the processing you object to |
| **Lodge a complaint with the regulator** | NDPC at https://ndpc.gov.ng |

Statutory response time is **30 days** under the NDPA; we aim for **7
business days** for routine requests.

---

## 7. Vendor & partner due diligence

Any third party that touches user data goes through a documented
assessment. The minimum bar:

- Active relevant licence(s) where regulated (CBN, NDPC, etc.).
- Data-processing agreement signed before any data is shared.
- Demonstrable security posture (we ask for security questionnaires, SOC
  reports, or independent audit summaries where available).
- A named accountable owner on their side.

This applies equally to our payment partners, our analytics providers,
our SMS and push-notification gateways, and our cloud infrastructure
provider. The full vendor list is available on request to
**contact@iprime.ng**.

---

## 8. Disclosure to authorities

We will share user data with law-enforcement or regulatory authorities
only when:

1. A valid Nigerian court order, properly served, requires us to; **or**
2. A law-enforcement request meets the standards laid down in the NDPA
   for lawful processing without a court order (typically a written
   request from a senior officer for a specific, ongoing investigation); **or**
3. We have a good-faith belief that an immediate, specific threat to a
   person's life or physical safety requires it.

We push back on requests that are overbroad or that don't meet the
above bar, and we keep a record of every request received and our
response.

---

## 9. Reporting concerns

If you believe iPrime is not living up to the standards on this page —
whether you're a user, a partner, a regulator, or an employee:

- **General compliance concerns:** email **contact@iprime.ng**.
- **Data protection concerns:** email **contact@iprime.ng**, or contact the
  NDPC directly.
- **Anonymous whistleblowing:** use the contact form on the homepage
  (free text, no account required) and start the message with the word
  *"COMPLIANCE"* — it routes directly to the compliance lead.

Retaliation against anyone reporting a compliance concern in good faith
is itself a disciplinary offence under our internal policy.

---

## 10. Changes to this statement

This is a living document. We update it when the law changes, when our
controls change, or when a partner changes. Material updates are
announced at least 14 days in advance via the in-app inbox and the
**Last updated** date above will reflect the change.
