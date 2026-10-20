# Store screenshots - capture plan

Both stores require multiple sets of screenshots in specific dimensions.
This file is the script for capturing them - what to shoot, on which
device size, in which language, in which order.

The goal: at the end of this exercise you should have **two folders per
app** (one EN, one HA), each containing the exact files the store
listing forms ask for.

## Required dimensions

### Apple App Store

| Device class | Pixels | Status | Notes |
|---|---|---|---|
| **iPhone** (Dynamic Island, medium) | **1206 × 2622** or **1179 × 2556** portrait | **Required** | Apple's required iPhone slot since the Oct 2026 spec change; all other iPhone sizes auto-derive from this set |
| iPhone (Dynamic Island, large) | 1320 × 2868 portrait | Optional | 6.9"/6.7" class - no longer the required size |
| iPad 13" | 2064 × 2752 portrait | Required IF you check "iPad" support in app.json | `"supportsTablet": true` is set, so yes |

You can upload up to **10** screenshots per device class. We use **7**.

> The merchant sets are generated at exact pixel sizes by
> `store-assets/generator/render.mjs` (see its README) rather than captured
> from a simulator - `appstore-merchant-iphone-*` is 1206 × 2622 and
> `appstore-merchant-ipad-*` is 2064 × 2752. The capture-from-simulator
> instructions below still apply to the customer/rider apps.

### Google Play Store

| Device class | Pixels | Status |
|---|---|---|
| **Phone** | minimum 320 px on shorter side, **9:16** or **16:9** ratio | **Required**, min 2, recommended 4–8 |
| 7-inch tablet | 1024 × 600 / 600 × 1024 | Optional |
| 10-inch tablet | 1280 × 800 / 800 × 1280 | Optional |
| **Feature graphic** | **1024 × 500** | **Required** - banner above screenshots in Play listing |

Captures from the required iPhone form factor (1206 × 2622) sit at the
right aspect ratio to be cropped down to Play's 9:16 requirement - so you
can shoot once on iOS simulator and crop down for Android.

---

## The 6 frames per app (story order)

The order users see the screenshots matters more than the content of
any one frame. Build a 6-frame story arc.

### Customer app - story order

| # | Frame | What's shown | Why this frame |
|---|---|---|---|
| 1 | **Home** | iPhone home with full tile grid (Food, Package, Pharmacy, Grocery, Retail, VTU), active order banner at top, wallet balance visible | Establishes scope - "this is a real super-app, not a single-purpose tool" |
| 2 | **Wallet + NUBAN** | Wallet screen with funded balance, dedicated NUBAN account number, recent transactions list | The financial product - most users come for this |
| 3 | **Ordering food** | A merchant page with product photos, variant picker, item in cart | Shows commerce is real, not just delivery |
| 4 | **Live delivery tracking** | RequestTracking screen with rider on map, ETA, masked phone-call button, in-app chat | The defining UX of a delivery app - has to look polished |
| 5 | **VTU airtime** | Airtime screen with operator detected, amount entered, recent recipient | Shows the utility/VTU side and that it's fast |
| 6 | **Order history + receipt** | Orders list + a delivered receipt with all the line items, fees, rider name, timestamp | Closes the loop - proves the system tracks everything |

### Rider app - story order

| # | Frame | What's shown | Why |
|---|---|---|---|
| 1 | **Online toggle + earnings** | Home screen with "Online" toggle on, today's earnings, current GPS location | First impression - "this is a job, here's how much I make" |
| 2 | **Job offer** | JobOfferScreen modal - pickup, dropoff, fare, accept/skip CTAs | The core interaction - what a rider does most often |
| 3 | **Trip cockpit** | Active trip with map, turn-by-turn step, customer info, status action button | The work itself - looks competent, not stressful |
| 4 | **Earnings dashboard** | Weekly bar chart with daily breakdown, total earnings, trip count | The money story - what keeps riders coming back |
| 5 | **Wallet withdraw** | Withdraw screen with available balance, beneficiary chip, "Withdraw" button | Confidence that the money is real and accessible |
| 6 | **Performance** | Performance screen - acceptance rate, completion rate, customer rating, badges if applicable | Pride + visibility into how they're doing |

### Merchant app - story order

| # | Frame | What's shown | Why |
|---|---|---|---|
| 1 | **Orders queue** | Native Orders screen with incoming orders, status chips, and inline Accept/Reject CTAs | The core job - what a merchant opens the app for |
| 2 | **Order detail** | A single order: line items, customer note, delivery address, assigned rider | Shows the app tracks everything end-to-end |
| 3 | **Push with actions** | Lock screen notification with inline **Accept** / **Reject** buttons | The headline native capability (strong App Store 4.2 signal) |
| 4 | **Products** | Catalogue management with product rows, prices, stock | Proves the management long-tail is real, not a stub |
| 5 | **Earnings + wallet** | Available/pending balance, recent transactions, Withdraw chip | The money story - why merchants stay |
| 6 | **Store open/close + pickup point** | Store status toggle and pickup-point map | The everyday switch merchants touch daily |

---

## Caption strategy (text overlaid on the screenshot)

Most successful store screenshots have a **headline overlaid above the
phone frame**. Keep these short - 4–7 words. Suggested set:

### Customer app

| Frame | EN caption | HA caption |
|---|---|---|
| 1 | "Everything you need, one app." | "Komai ku ke bukata, app ɗaya." |
| 2 | "Your free NUBAN wallet." | "Walat ku na NUBAN, kyauta." |
| 3 | "Order from real local shops." | "Yi oda daga shaguna kusa." |
| 4 | "Track your rider live." | "Bibiya rider ku kai tsaye." |
| 5 | "Airtime, data, bills - instant." | "Caji, data, biyan kuɗi - nan da nan." |
| 6 | "Every order, receipted." | "Kowace oda, da rasid." |

### Rider app

| Frame | EN caption | HA caption |
|---|---|---|
| 1 | "Go online, start earning." | "Shiga aiki, fara samun kuɗi." |
| 2 | "Accept jobs near you." | "Karɓi ayyuka kusa da ku." |
| 3 | "Turn-by-turn to every drop." | "Jagora kai tsaye zuwa kowane wuri." |
| 4 | "See your earnings, daily." | "Duba kuɗin ku, kullum." |
| 5 | "Cash out to any Nigerian bank." | "Cire kuɗi zuwa kowane banki." |
| 6 | "Watch your stats climb." | "Duba yadda ku ke ci gaba." |

### Merchant app

| Frame | EN caption | HA caption |
|---|---|---|
| 1 | "Every order, in one place." | "Kowace oda, wuri ɗaya." |
| 2 | "See the whole order." | "Ga dukan odar." |
| 3 | "Accept right from the tray." | "Karɓa kai tsaye daga sanarwa." |
| 4 | "Manage your products." | "Sarrafa kayayyakinka." |
| 5 | "Get paid, withdraw fast." | "Sami biya, cire da wuri." |
| 6 | "Open for business in a tap." | "Buɗe shago da taɓawa ɗaya." |

---

## How to capture (recommended approach)

1. **Use the iOS simulator** for the canonical captures.
   - Open the **iPhone 16 Pro Max** simulator (1290 × 2796).
   - Run `npx expo start --ios` from `mobile/customer-app`.
   - `⌘+S` saves a PNG of the simulator window to the desktop.
   - Same workflow for rider app from `mobile/rider-app` and merchant app
     from `mobile/merchant-app`.

2. **Seed realistic demo data** before capturing.
   - Use a fresh test account so balances/orders/ratings look believable but not staged.
   - Suggested seed values:
     - Wallet: ₦12,400 funded
     - Orders: at least 2 delivered, 1 in-flight
     - Rider performance: 95% acceptance, 98% completion, 4.8★, ~120 trips total
     - NUBAN: any realistic-looking 10-digit number
   - Avoid lorem-ipsum or "Test User" - viewers spot it instantly.

3. **Capture in both locales.**
   - Toggle to Hausa in Profile → language toggle.
   - Re-shoot the same 6 frames.
   - End up with `customer-en/01-home.png` … `customer-en/06-receipt.png` and `customer-ha/01-home.png` … same.

4. **Caption overlays.**
   - Use Figma or any image editor.
   - White headline, ~64pt, bold, top 15% of the frame.
   - Solid colour band behind the caption (brand orange `#EA580C` works) - pure overlay text on the screenshot reads poorly.
   - Keep the bottom 85% as the unaltered phone capture.

5. **Crop for Android.**
   - The 1290 × 2796 captures are 9:19.5. Play accepts up to 9:16, so
     crop down by trimming ~430 px from the bottom (or split the home-
     bar area off).
   - Save as `customer-en-android/01.png` … etc.

6. **Feature graphic** (Play Store only).
   - 1024 × 500 banner.
   - The simplest version: brand-orange background, the iPrime logo lockup centered, tagline below ("Wallet, deliveries, bills - Katsina.").
   - Avoid putting screenshots inside the feature graphic - they get tiny.

---

## File output expected

```
docs/store/screenshots/
├── customer/
│   ├── ios/
│   │   ├── en/
│   │   │   ├── 01-home.png             (1290×2796)
│   │   │   ├── 02-wallet.png
│   │   │   ├── 03-merchant.png
│   │   │   ├── 04-tracking.png
│   │   │   ├── 05-airtime.png
│   │   │   └── 06-receipt.png
│   │   └── ha/
│   │       └── (same 6 files)
│   ├── android/
│   │   ├── en/
│   │   │   └── (same 6 files, cropped to 9:16)
│   │   └── ha/
│   │       └── (same 6 files)
│   └── feature-graphic.png             (1024×500)
├── rider/
│   ├── ios/
│   │   ├── en/  (6 files)
│   │   └── ha/  (6 files)
│   ├── android/
│   │   ├── en/  (6 files)
│   │   └── ha/  (6 files)
│   └── feature-graphic.png
└── merchant/
    ├── ios/
    │   ├── en/  (6 files)
    │   └── ha/  (6 files)
    ├── android/
    │   ├── en/  (6 files)
    │   └── ha/  (6 files)
    └── feature-graphic.png
```

26 files per app × 3 apps = 78 image assets total.

---

## Time estimate

- Seeding demo data: 30 min per app
- Capturing the 12 frames (6 EN + 6 HA): 60 min per app
- Caption overlay + export: 90 min per app
- Android crops: 30 min per app
- Feature graphic: 30 min per app

**Total: ~8 hours.** Faster with a designer who can build a Figma frame
template; slower if you re-shoot for tweaks.

---

## Anti-patterns to avoid

- ❌ Marketing copy that isn't visible in the actual app
- ❌ Heavy gradients / drop shadows around the phone frame (looks like a 2014 store listing)
- ❌ Real customer phone numbers or BVNs (you cannot un-publish a screenshot once it's live in the store)
- ❌ Inconsistent status-bar time across frames (set it to 9:41 on every frame - Apple's own convention)
- ❌ Empty states as your hero shot
- ❌ Captions that just narrate the screenshot ("This is the home page")
