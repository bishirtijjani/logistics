# Logistics Platform
## Development Proposal & Project Scope

*A complete mobile super-app for *

| | |
|---|---|
| **Prepared by** | Bishir Tijjani |
| **Prepared for** | Muhammad Umar Lawal |
| **Date** | March 2026 |
| **Version** | 1.0 - For Review |

> **CONFIDENTIAL** - Prepared exclusively for Muhammad Umar Lawal

---

## 1. What We Are Building

This proposal covers the design, development, and deployment of Logistics Platform - a mobile super-app for Android and iOS targeting users across . The platform brings three essential services together under a single app, eliminating the need for residents to use multiple separate applications.

| Module | What It Does | Powered By |
|---|---|---|
| **Digital Wallet** | Each user gets a unique Nigerian bank account number. Fund your wallet by transferring to it from any bank app. Send money to other users, withdraw to your bank, or use your balance to pay for everything else in the app. | KatPay |
| **Utility Payments** | Buy airtime and data bundles for MTN, Airtel, Glo, and 9mobile. Pay electricity bills for any DISCO merchant across Nigeria. Everything is instant and paid from your wallet balance. | AlRahuz |
| **Delivery & Logistics** | Request pickup and dropoff of any item within . A registered rider accepts the job, collects the item, and delivers it while you track them live on a map. Payment is automatic from your wallet on delivery. | Google Maps + In-house |

The platform consists of two mobile applications - a **Customer App** for end users and a **Rider App** for delivery personnel - both connected to the same backend system.

---

## 2. How the System is Structured

The Customer App and Rider App each communicate with a shared backend server over a secure connection. The backend handles all business logic and connects to external merchants for payments, utilities, maps, and notifications. Users never interact with these merchants directly - everything goes through the app.

### 2.1 Wallet Money Flow

Every way money moves inside the platform flows through the wallet - from top-up via bank transfer, through peer-to-peer sends, utility payments, delivery charges, and out via bank withdrawal.

### 2.2 Delivery Request Flow

A delivery moves through seven stages from the moment a customer places a request to the moment payment is settled: request placed → rider matched → rider en route → item picked up → in transit → delivered → payment settled.

### 2.3 Technology Summary

| Component | Technology | Why |
|---|---|---|
| **Mobile Apps** | React Native | One codebase builds both Android and iOS versions of both apps simultaneously. Reduces cost and development time significantly. |
| **Backend Server** | Node.js + Express | Handles all transactions, delivery logic, and user management. Designed to handle many users at the same time reliably. |
| **Database** | PostgreSQL | A financial-grade database. Every wallet transaction is recorded with full accuracy - no rounding errors, no data loss. |
| **Real-Time Tracking** | Socket.io | Streams the rider's live GPS location to the customer's map every 3 seconds during an active delivery. |
| **Payments** | KatPay | A licensed Nigerian payments provider that issues per-user virtual accounts, processes wallet funding via bank transfer, and handles bank disbursements (withdrawals). |
| **Utility Bills** | AlRahuz | A Nigerian VTU/bill-payment aggregator supporting airtime, data, electricity, cable TV, and education pins. |
| **Maps & Navigation** | Google Maps Platform | Powers address search, distance calculation, fare estimation, and the live tracking map. |
| **Notifications** | Firebase FCM | Delivers push notifications to both apps for delivery updates, payment confirmations, and money transfers. |

---

## 3. Full Feature Scope - Version 1

The following tables define every feature included in Version 1 of the platform. This is the agreed scope of work. Anything not listed here is not included in this engagement.

### 3.1 Registration & Identity Verification

| Feature | Description |
|---|---|
| **Phone Number Registration** | Users sign up using their Nigerian phone number. A one-time OTP code is sent via SMS to verify the number. |
| **BVN Verification** | Before a wallet is activated, the user's Bank Verification Number (BVN) is verified. This is a CBN requirement for any platform handling virtual accounts. The BVN is verified but never stored in readable form. |
| **Transaction PIN** | A 6-digit PIN is set during registration and is required to authorise every financial action - transfers, payments, and withdrawals. |
| **Rider Identity Check** | Riders are required to upload a government-issued ID and a vehicle photo. Their account is reviewed and approved by the platform administrator before they can go live. |
| **Password Reset** | Users can reset their password via an OTP sent to their registered phone number. |

### 3.2 Wallet & Financial Features

| Feature | Description |
|---|---|
| **Personal Virtual Account** | Every verified user receives a unique Nigerian bank account number (issued via KatPay). This account is used exclusively to fund their wallet from any bank app. |
| **Wallet Balance & Dashboard** | The home screen displays the user's current wallet balance with the option to hide or show it. |
| **Wallet Top-Up** | User transfers any amount to their virtual account from their bank. The wallet balance updates automatically within seconds via a webhook notification from KatPay. |
| **Send Money (P2P)** | Users can send money to any other registered user by entering their phone number. Both parties receive instant balance updates and push notifications. No bank transfer occurs - this is an internal ledger movement. |
| **Withdraw to Bank** | Users can withdraw their wallet balance to any Nigerian bank account. The app verifies the account name before confirmation. Transfer is processed via KatPay's disbursement service. |
| **Transaction History** | A chronological list of all wallet activity - top-ups, transfers sent and received, utility payments, delivery charges, and withdrawals - with full details and status. |
| **Saved Beneficiaries** | Users can save frequently used account numbers and phone numbers for quick access during transfers. |

### 3.3 Utility Payments

| Feature | Description |
|---|---|
| **Airtime Top-Up** | Purchase airtime for any of the four major Nigerian networks (MTN, Airtel, Glo, 9mobile) for yourself or any phone number. |
| **Data Bundle Purchase** | Browse and purchase data bundles for all four networks. Packages are fetched live from AlRahuz to ensure they are always up to date. |
| **Electricity Token** | Pay electricity bills for any DISCO merchant across Nigeria by entering the meter number. The payment token is delivered in the app and via SMS to the registered number. |
| **Bill Purchase History** | A separate log of all utility purchases with merchant, beneficiary, amount, reference number, and status. |

### 3.4 Delivery & Logistics - Customer Features

| Feature | Description |
|---|---|
| **Delivery Request** | Customer enters a pickup address, dropoff address, and a brief description of the item. Both addresses are selected on a map for precision. |
| **Price Estimate** | Before confirming, the customer sees the exact delivery fee calculated based on distance. There are no hidden charges. |
| **Rider Matching** | Once confirmed, the job is broadcast to all available riders in the area. The first rider to accept is assigned to the delivery. |
| **Live Rider Tracking** | After a rider accepts, the customer can open a live map showing the rider's exact location, updating every 3 seconds. |
| **Delivery Status Updates** | Push notifications are sent at every key stage: rider accepted, item picked up, item delivered. |
| **Automatic Payment** | The delivery fee is deducted from the customer's wallet automatically upon delivery completion. No manual payment step required. |
| **Cancellation** | Customers can cancel a delivery request before a rider has accepted it. Cancellation terms after acceptance to be defined by the client. |
| **Rider Rating** | After each completed delivery, the customer is prompted to rate the rider out of 5 stars. |
| **Delivery History** | A record of all past deliveries with route details, cost, rider, and status. |

### 3.5 Rider Application

| Feature | Description |
|---|---|
| **Rider Registration** | Separate onboarding for riders including NIN, vehicle type, plate number, ID upload, and profile photo. Subject to admin approval. |
| **Availability Toggle** | Riders set themselves as Available or Offline from the home screen. Only available riders receive job notifications. |
| **Job Notification** | When a nearby delivery job is posted, the rider receives a full-screen notification showing pickup location, dropoff location, distance, and estimated earnings. They have 60 seconds to accept or reject. |
| **In-App Navigation** | After accepting, the rider gets Google Maps turn-by-turn navigation to the pickup address, then to the dropoff address. |
| **Delivery Actions** | The rider taps to mark the item as Picked Up at the sender's location and Delivered at the recipient's location. |
| **Earnings Dashboard** | Riders can see their earnings for the current day, the current week, and their total accumulated balance. |
| **Rider Wallet & Withdrawal** | Delivery earnings are credited to the rider's in-app wallet. Riders can withdraw to their linked bank account at any time via KatPay. |
| **Delivery History** | A log of all completed deliveries with payout per job and cumulative totals. |

### 3.6 What Is Not Included in Version 1

The following are explicitly excluded from this engagement. They may be considered for a future version after launch.

| Excluded Feature | Note |
|---|---|
| Food / Restaurant Ordering | Menu-based food ordering is a separate product type. Not in V1. |
| Scheduled Future Deliveries | All deliveries are on-demand only. No advance booking in V1. |
| In-App Business Accounts | Individual user accounts only. Merchant accounts are a future feature. |
| Surge or Dynamic Pricing | Flat distance-based pricing in V1. |
| Cable TV / Betting Payments | Utility module is limited to airtime, data, and electricity in V1. |
| Referral or Loyalty Program | No referral rewards or points system in V1. |
| Web Application | Mobile apps only. A web version is a separate engagement. |
| Insurance on Deliveries | No item coverage or insurance product in V1. |

---

## 4. Development Timeline

The project is structured across seven milestones over an estimated **19 weeks (approximately 5 months)**. Each milestone ends with a working, testable deliverable that must be reviewed and signed off before the next milestone begins.

| Milestone | What Is Delivered | Duration | Weeks |
|---|---|---|---|
| **1 - Foundation & Authentication** | Project setup, database, user registration, OTP verification, BVN KYC, transaction PIN, and secure session management. | 2 weeks | 1–2 |
| **2 - Wallet & Transfers** | KatPay virtual account setup per user, wallet top-up via bank transfer, peer-to-peer transfers, bank withdrawals, and full transaction history. | 3 weeks | 3–5 |
| **3 - Utility Payments** | AlRahuz integration for airtime, data bundles, and electricity tokens. Bill history and saved beneficiaries. | 2 weeks | 6–7 |
| **4 - Delivery Module (Customer)** | Full delivery request flow, Google Maps integration, fare calculation, rider matching engine, push notifications, delivery history, and ratings. | 4 weeks | 8–11 |
| **5 - Live Tracking** | Real-time GPS tracking via WebSocket. Rider location streams to customer map. Full delivery status event pipeline. | 2 weeks | 12–13 |
| **6 - Rider Application** | Complete Rider App: onboarding, availability, job notifications, navigation, delivery actions, earnings dashboard, and rider withdrawals. | 3 weeks | 14–16 |
| **7 - Testing & Launch** | End-to-end testing, bug fixes, performance checks, Google Play Store and Apple App Store submissions, production deployment, and full documentation handover. | 3 weeks | 17–19 |

> **Total Duration: 19 weeks - approximately 5 months from project kickoff to live app on both stores.**
>
> Timeline assumes the client provides required API credentials (KatPay, AlRahuz, Google Maps) within the first week. Each milestone must be signed off before the following milestone begins. Delays in sign-off extend the timeline proportionally.

---

## 5. Investment

The total fixed price for the complete Version 1 platform as described in this document is:

### ₦1,500,000
**Fixed Price - Full V1 Scope**

This is a fixed price engagement. The total does not change regardless of how long any individual milestone takes, as long as the agreed scope remains unchanged. Payment is split across the seven milestones as follows:

| Milestone | Due | % of Total | Amount |
|---|---|---|---|
| Project Kickoff | Week 1–2 | 20% | ₦300,000 |
| Wallet & Transfers Complete | Week 3–5 | 15% | ₦225,000 |
| Utility Payments Complete | Week 6–7 | 10% | ₦150,000 |
| Delivery Module Complete | Week 8–11 | 20% | ₦300,000 |
| Live Tracking Complete | Week 12–13 | 10% | ₦150,000 |
| Rider App Complete | Week 14–16 | 15% | ₦225,000 |
| Final Launch & Handover | Week 17–19 | 10% | ₦150,000 |

> **Payment Rules**
> - The first payment (₦300,000) is due before any development work begins.
> - Each subsequent milestone payment is due within 5 business days of milestone sign-off.
> - Work on the next milestone begins only after the current milestone payment is received.
> - All payments to be made via bank transfer to the developer's account provided at agreement signing.

### 5.1 What Is Included in This Price

- Both mobile applications - Customer App and Rider App - for Android and iOS.
- The complete backend API, database, and real-time tracking infrastructure.
- All third-party API integrations: KatPay, AlRahuz, Google Maps, Firebase, and Termii.
- A basic admin dashboard for rider approvals and transaction oversight.
- Google Play Store and Apple App Store submission of both apps.
- Full source code transferred to the client on final payment.
- API documentation and deployment runbook.
- 30 days of post-launch bug fixing for defects in delivered code.

### 5.2 What Is Not Included

- Third-party account fees: KatPay merchant onboarding, Google Maps billing, AlRahuz merchant account, Apple Developer Account (₦150,000/year equivalent), Google Play Developer Account (one-time ~₦25,000 equivalent).
- Monthly infrastructure hosting costs after deployment (estimated ₦20,000–₦40,000/month depending on scale).
- Rider recruitment - the client is responsible for recruiting and onboarding initial riders before launch.
- Any feature not listed in Section 3 of this document.
- Ongoing maintenance, new features, or support beyond the 30-day warranty period. These are a separate engagement.

---

## 6. Deliverables

The following items will be formally handed over to the client upon receipt of the final milestone payment:

| Deliverable | Description |
|---|---|
| **Customer Mobile App** | Production-ready app published on Google Play Store (Android) and submitted to Apple App Store (iOS). |
| **Rider Mobile App** | Production-ready app published on Google Play Store (Android) and submitted to Apple App Store (iOS). |
| **Backend API** | Live Node.js server deployed on production infrastructure with all integrations active and tested. |
| **Admin Dashboard** | Web-based admin panel for rider account approvals, transaction monitoring, and basic platform management. |
| **Source Code** | Full GitHub repository access transferred to the client. Includes all frontend and backend code. |
| **API Documentation** | Postman collection covering all backend endpoints with example requests and responses. |
| **Deployment Runbook** | Step-by-step documentation for infrastructure setup, environment configuration, and how to redeploy. |

---

## 7. Terms & Conditions

| Term | Detail |
|---|---|
| **Intellectual Property** | All intellectual property and source code transfers fully to the client upon receipt of the final milestone payment. The developer retains no rights to the codebase after handover. |
| **Scope Changes** | Any feature additions or modifications to the agreed scope during development will be separately scoped, quoted, and approved in writing before any additional work begins. Verbal agreements do not constitute scope changes. |
| **Client Responsibilities** | The client agrees to: provide all required API credentials (KatPay, AlRahuz, Google Maps) within the first week; review and sign off on each milestone within 5 business days of delivery; provide feedback on designs within 48 hours. |
| **Warranty** | The developer provides a 30-day post-launch warranty covering bug fixes for code defects in the delivered work. This does not cover third-party API changes, server outages, or new feature requests. |
| **Cancellation** | Payments for completed and signed-off milestones are non-refundable. If the client cancels mid-milestone, work completed up to the point of cancellation will be invoiced at the prorated milestone value. |
| **Confidentiality** | Both parties agree to treat all business logic, pricing, user data, and technical specifications shared under this engagement as confidential. |
| **Governing Terms** | This agreement is between Bishir Tijjani (Developer) and Muhammad Umar Lawal (Client). Any disputes will be resolved first through direct negotiation in good faith. |

---

## 8. Next Steps

To proceed with this engagement, complete the following steps in order:

1. Client reviews this document and raises any questions or requested changes.
2. Both parties agree on terms and sign a brief service agreement.
3. Client initiates account registrations for KatPay, AlRahuz, and Google Maps Platform (these can take a few days to process - they should not wait until development begins).
4. First milestone payment of **₦300,000** is received by the developer.
5. Development begins on Milestone 1 immediately.

---

**Bishir Tijjani**  
Mobile & Full-Stack Developer  
March 2026

---

> *Prepared exclusively for Muhammad Umar Lawal. This document is confidential and intended solely for the named recipient. Sharing this proposal with third parties without the developer's written consent is not permitted.*
