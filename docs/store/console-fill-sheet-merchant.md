# Console fill sheet - iPrime Merchant

Everything you have to type into **App Store Connect** and **Google Play
Console**, in the order the consoles ask for it, with the exact value to
paste. Copy from here; don't retype.

Companion docs (deeper detail, not needed at the keyboard):
- Listing copy (EN + HA) - `docs/store/listing-merchant-app.md`
- App privacy questionnaire - `docs/store/app-store-privacy.md`
- Data safety form - `docs/store/play-data-safety.md`
- Screenshot storyboard - `docs/store/screenshot-plan.md`

Values that are **yours to supply** are marked `TODO:`.

---

## 0. Create the app records first (one-time)

You can't fill either form until the app record exists.

### Google Play Console
`All apps → Create app`
| Field | Value |
|---|---|
| App name | `iPrime Merchant` |
| Default language | `English (United States)` |
| App or game | `App` |
| Free or paid | `Free` |
| Declarations (2 checkboxes) | tick both (Play policies + US export laws) |

### App Store Connect
`My Apps → + → New App`
| Field | Value |
|---|---|
| Platform | `iOS` |
| Name | `iPrime Merchant` |
| Primary language | `English (U.S.)` |
| Bundle ID | `ng.iprime.merchant` (must match `app.json`) |
| SKU | `NGIPRIMEMERCHANT01` (internal only, never shown, can't be changed) |
| User Access | `Full Access` |

---

## 1. Google Play Console

### 1.1 Store settings
| Field | Value |
|---|---|
| App category | `Business` |
| Tags | `Business`, `Productivity`, `Finance` |
| Contact email | TODO: (e.g. `support@iprime.ng`) |
| Contact phone | TODO: |
| Website | `https://iprime.ng` |
| Countries/regions | `Nigeria` (add more later if you want) |

### 1.2 Main store listing
| Field | Limit | Value |
|---|---|---|
| App name | 30 | `iPrime Merchant` *(15)* |
| Short description | 80 | `Run your shop on iPrime. Take orders, track sales, get paid fast.` *(65)* |
| Full description | 4000 | *(the EN full description in `listing-merchant-app.md`)* |
| App icon | 512×512 PNG | `store-assets/merchant/icon-512.png` |
| Feature graphic | 1024×500 | `store-assets/merchant/feature-graphic.png` |
| Phone screenshots | 2–8 | `playstore-merchant-phone-*` (see §3) |
| 7" tablet screenshots | ≤8 | `playstore-merchant-tablet-7-*` |
| 10" tablet screenshots | ≤8 | `playstore-merchant-tablet-10-*` |

Optional: add Hausa under `Translations → Manage translations → Hausa`
for the name-adjacent text (short + full description from the HA block).

### 1.3 App content (the long left-hand list - do all of these)
| Section | Answer |
|---|---|
| **Privacy policy** | `https://iprime.ng/legal/privacy` |
| **App access** | *"All or some functionality is restricted"* → **Add instructions** → paste the §4 block (demo merchant login) |
| **Ads** | `No, my app does not contain ads` |
| **Content rating** | Start questionnaire → category `Utility, Productivity, Communication, or Other` → see §1.4 |
| **Target audience** | Age groups: **`18 and over`** only. Do NOT tick any under-18 band. |
| **News app** | `No` |
| **Data safety** | Fill from `play-data-safety.md` (merchant deltas block). See §1.5. |
| **Government apps** | `No` |
| **Financial features** | `Yes` *(wallet, payments, withdrawals)* |
| **Health apps** | `No` |
| **COVID-19 contact tracing** | `No` |
| **Data deletion** | Provide `https://iprime.ng/legal/account-deletion` (or the account-deletion URL the legal site serves) + DPO email |

### 1.4 Content rating questionnaire (IARC)
Category: `Utility, Productivity, Communication, or Other`

| Question | Answer |
|---|---|
| Violence / blood / sexual / nudity / language | `No` to all |
| Controlled substances | `No` |
| Gambling - real-money | `No` |
| Gambling - simulated | `No` |
| User-generated content / users can interact | `Yes` |
| Users can share location | `Yes` |
| Digital purchases | `No` |
| Miscellaneous: does the app allow users to communicate? | `Yes` |

IARC assigns the final rating from these (expect Teen / Mature-class).
The merchant/rider/customer apps all land in the same band.

### 1.5 Data safety (summary of the form)
- Collects/shares data: **Yes**
- Encrypted in transit: **Yes** (TLS 1.2+)
- Deletion request method: **Yes** (in-app + DPO email)
- Families policy: **No**
- Per data type: use the tables in `play-data-safety.md`.
  Merchant-relevant: Location (pickup point only), Financial info
  (wallet/earnings/NUBAN), Photos (product/store images), UGC
  (listings, support), Purchase history (incoming orders). Sharing
  column: all **No** (processors under DPA ≠ sharing).

### 1.6 Production / release
- Upload the `.aab` (from `eas build --profile production --platform android`).
- Start on **Internal testing** → add testers → promote.
- Let **Play App Signing** be managed by EAS (default).

---

## 2. App Store Connect

### 2.1 App Information
| Field | Value |
|---|---|
| Name | `iPrime Merchant` |
| Subtitle | `Manage orders, get paid fast` *(28)* |
| Primary category | `Business` |
| Secondary category | `Finance` *(optional)* |
| Content Rights | `No, it does not contain third-party content` |
| Age Rating | See §2.4 |

### 2.2 Pricing and Availability
| Field | Value |
|---|---|
| Price | `Free` |
| Availability | `Nigeria` (add territories later) |
| App Distribution / Phased Release | enable later, at release |

### 2.3 iOS App - version 1.0.0
| Field | Limit | Value |
|---|---|---|
| Promotional text | 170 | *(the EN promotional text in `listing-merchant-app.md`)* |
| Description | 4000 | *(the EN full description)* |
| Keywords | 100 | `merchant,seller,vendor,shop,business,orders,store,Katsina,Nigeria,wallet,earnings,inventory` |
| Support URL | - | `https://iprime.ng/support` (TODO: confirm it resolves) |
| Marketing URL | - | `https://iprime.ng` *(optional)* |
| Privacy Policy URL | - | `https://iprime.ng/legal/privacy` |
| Version | - | `1.0.0` |
| Copyright | - | `TODO: 2026 <COMPANY LEGAL NAME>` |
| What's New | - | `First release. For shop owners and vendors on iPrime in Katsina: accept orders, manage your shop, and get paid - wherever your shop is.` |
| Screenshots iPhone (required slot) | 3–10 | `appstore-merchant-iphone-*` |
| Screenshots 13" iPad | 3–10 | `appstore-merchant-ipad-*` |
| App icon 1024 | 1024×1024 | `store-assets/merchant/icon-1024.png` (no alpha) |

### 2.4 Age Rating
Answer the questionnaire with `No` everywhere except:
| Question | Answer |
|---|---|
| Unrestricted Web Access | **`Yes`** *(the WebView surface)* - this alone pushes the rating up |
| User-Generated Content | **`Yes`** |
| Users can share location | `Yes` |

Result: **17+**. `webView`/UGC + financial features justify it.

### 2.5 App Privacy
Use `app-store-privacy.md` (merchant deltas block). Key answers:
- Data collected: **Yes** (Contact, Financial, Location, UGC, IDs,
  Usage, Diagnostics - per table)
- Tracking across other apps/sites: **No** → no ATT prompt needed
- Purposes: App Functionality / Analytics / Product Personalization
  only; never Third-Party Advertising

### 2.6 Export compliance (encryption)
| Field | Value |
|---|---|
| Uses encryption? | `Yes` - standard HTTPS/TLS only |
| Non-exempt encryption | **`No`** |

Make this permanent in the binary so ASC stops asking you each build -
add to `mobile/merchant-app/app.json`:
```json
"ios": { "config": { "usesNonExemptEncryption": false } }
```
(re-run `eas build` for it to take effect; until then answer the
prompt manually.)

### 2.7 App Review Information
| Field | Value |
|---|---|
| Sign-in required | **`Yes`** |
| Demo account | TODO: seeded merchant phone + password (see §4) |
| Contact first/last name | TODO: |
| Contact phone | TODO: |
| Contact email | TODO: |
| Notes | paste the §4 block as-is |

---

## 3. Asset → upload slot map

All files live in `store-assets/merchant/`. Upload order below = the
order the shots should appear in the listing.

Recommended order (both stores): `orders`, `order-detail`, `products`,
`earnings`, `store-status`, `analytics`, `bills`.

| Slot | Store | Files |
|---|---|---|
| App icon | Play (512) | `icon-512.png` |
| App icon | App Store (1024) | `icon-1024.png` |
| Feature graphic | Play only | `feature-graphic.png` |
| Phone screenshots | Play | `playstore-merchant-phone-{orders,order-detail,products,earnings,store-status,analytics,bills}.png` |
| 7" tablet screenshots | Play | `playstore-merchant-tablet-7-*.png` |
| 10" tablet screenshots | Play | `playstore-merchant-tablet-10-*.png` |
| iPhone screenshots (required slot) | App Store (required) | `appstore-merchant-iphone-*.png` (1206×2622) |
| iPad 13" screenshots | App Store (required) | `appstore-merchant-ipad-*.png` (2064×2752) |

App Store only needs the required iPhone set + the 13" iPad set - Apple
scales them down to every smaller device. Play needs each size uploaded
separately. Apple's required iPhone size changed in Oct 2026 to the
"Dynamic Island, medium" display (1206×2622 or 1179×2556); the old 6.9"
1320×2868 set is optional-only.

---

## 4. Review-notes / app-access block (copy-paste)

Run `npm run db:seed:merchant` against PROD first, then paste this into
**both** stores. The credentials below are the script defaults - rotate
the password to a dedicated review value before you seed.

```
iPrime Merchant is the seller-facing app for shops on the iPrime
marketplace (Katsina, Nigeria). Native features: email/password login,
biometric app lock, a live order queue, and push notifications with
inline Accept / Reject action buttons (a merchant can act on a new
order from the notification tray without opening the app), plus native
Settings. The embedded web view is used only for the management
long-tail - catalogue, analytics, bills.

Sign in with this approved demo merchant:
  Email:    merchant.review@iprime.ng
  Password: MerchantReview123!
  PIN:      335577  (needed for wallet withdrawal)

The demo store is pre-approved and open, and ships with two products,
a wallet balance, and order history. Payments are real Nigerian NUBAN
bank transfers; no card or bank-login credentials are stored.

Note: the marketplace is local to Katsina, Nigeria. Registration and
delivery are geo-fenced to that area - use the demo login above rather
than registering. Questions: support@iprime.ng
```

---

## 5. Character-count quick table

| Field | Limit | Value length |
|---|---|---|
| App name | 30 | 15 |
| Apple subtitle | 30 | 28 |
| Play short description | 80 | 65 |
| Apple keywords | 100 | 96 |
| Apple promotional text | 170 | 159 |

---

## 6. Before submit - both stores

- [ ] App records created (§0)
- [ ] Demo merchant seeded to PROD, creds pasted into §4 in both stores
- [ ] `https://iprime.ng/legal/privacy`, `/legal/terms`,
      `/legal/account-deletion` all resolve
- [ ] Support URL + contact email/phone decided
- [ ] Company legal name + copyright line decided
- [ ] `ios.config.usesNonExemptEncryption: false` added to `app.json`
      (or answer the export prompt manually)
- [ ] `REPLACE_WITH_APPLE_TEAM_ID` + `REPLACE_WITH_APP_STORE_CONNECT_APP_ID`
      filled in `eas.json` (or passed via `eas submit --id`)
- [ ] Builds uploaded: `.aab` → Play internal, `.ipa` → TestFlight
