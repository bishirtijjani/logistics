# iPrime Merchant - "Get Started Today" 🎬 Screen-Recording Script

A complete, click-by-click script for a single screen recording (Captura) that
walks a brand-new merchant from sign-up to taking their first order and getting
paid. Read the **Say** lines aloud; do the **Do** lines on screen.

**Target length:** ~8–10 minutes. **Tone:** warm, simple, no jargon.

> Everything in `"quotes"` is the exact on-screen text, so what you say matches
> what the viewer sees.

---

## ✅ Before you hit record (pre-flight)

### 1. Get your recording account ready (do this *before* filming)
You're registering a fresh merchant. Two checkpoints:

- **Approval:** a newly registered account is **"pending admin approval"** and
  can't open the dashboard. To approve it yourself: open the **admin dashboard →
  Merchants**, find your new shop (status *Pending*), and **approve** it. *(Want
  the exact admin clicks? Say the word and I'll write them.)*
- **The honest cut:** film **sign-up + OTP** with the fresh account, then **✂️
  cut**, approve it, and log back in for the dashboard scenes. (You can't go
  straight from sign-up into the dashboard - approval happens in between.)

### 2. Get one test order in (so Orders & Earnings aren't blank)
A brand-new shop has no orders. Pick one:
- **A - Real order (most authentic):** from the **customer app**, fund a test
  customer's wallet, open your shop, and place one order. It appears in **Orders**
  as *"Requested"* - perfect for Scene 7.
- **B - I script it (fastest, if you run the backend locally):** tell me you run
  the backend locally and I'll write a tiny script that drops a demo order onto
  your merchant - no customer app needed.
- **C - Narrate the empty state (zero setup):** totally fine for a *getting
  started* video - a new shop genuinely has no orders. The script already has
  narration for this.

### 3. Captura settings
- **Output:** MP4, **30 fps**, **1080p**.
- **Capture:** the browser window or a fixed **1280×720 / 1920×1080 region** -
  not full screen with the taskbar showing.
- **Cursor:** turn **ON** "Capture Cursor"; enable click-highlight / keystroke
  overlay if available (makes clicks obvious).
- **Mic:** record a 5-second test and play it back before the real take.

### 4. Browser settings
- **100% zoom**, clean window, **light mode** (toggle the ☀️/🌙 button - light
  reads better on video).
- **Private / Incognito** window so saved passwords & autofill don't appear.
- Hide the bookmarks bar; size the window to match your capture region (16:9).
- Start at the **merchant dashboard URL** (e.g. `http://localhost:5173` if local,
  or your deployed merchant site).

---

## 🎬 The recording - scene by scene

### Scene 0 - Cold open / intro  ·  ~20s  ·  *(talk only, login screen on screen)*
**Say:**
> "Welcome to iPrime for Merchants. In the next few minutes I'll show you
> everything to start selling - sign up, set up your shop, add your products, take
> orders, and get paid. Let's go."

---

### Scene 1 - Create your account  ·  ~90s  ·  Screen: `/register` ("Join iPrime")
**Do:**
1. From the login screen, click **"Register as a Merchant"**.
2. **Step 1 - "Personal Information":** **First Name**, **Last Name**, **Email
   Address** (your fresh email), **Phone Number** (Nigerian, e.g. `08012345678`),
   **Password** (≥ 8 chars), **Confirm Password**. Click **"Next"**.
3. **Step 2 - "Business Information":** click a **Business Category** tile (e.g.
   *Food*), then **Business Name**, **Business Phone**, **Business Email**. Click
   **"Next"**.
4. **Step 3 - "Operating Hours":** set **Opening Time** / **Closing Time**, point
   at the **"Approval Required"** note, glance at the **Summary**, then click
   **"Complete Registration"**.

**Say:**
> "Head to sign-up and choose 'Register as a Merchant.' Step one is about you.
> Step two is your business - pick your category, then your business name and
> contact. Step three, your opening hours. Notice it says your account is reviewed
> before going live. Then 'Complete Registration.'"

**Watch out:** phone must be a valid Nigerian number; password ≥ 8 and both
password fields must match, or "Next" won't advance.

---

### Scene 2 - Verify your email (OTP)  ·  ~30s  ·  Screen: "Verify Your Email"  ·  ✂️ CUT after this
**Do:** type the **6-digit code** from the email into **"Verification Code"**,
click **"Verify Email"** (mention **"Resend code"** has a 60-sec cooldown). The
success message says the account is **"pending admin approval."**

**Say:**
> "Check your email for a 6-digit code, type it in, and verify. Done - your account
> is created and waiting for approval. Once approved, you can log in and set up."

**✂️ CUT here.** Approve the account in the admin dashboard, then start the next
clip on the login screen.

---

### Scene 3 - Log in  ·  ~30s  ·  Screen: `/login` ("Merchant Dashboard")
**Do:** enter **Email Address** + **Password**, optionally tick **"Remember me"**,
click **"Sign In"**. *(Mention, don't click:)* **"Forgot your password?"** emails a
reset link.

**Say:**
> "Once you're approved, signing in is simple - email and password, then 'Sign In.'"

---

### Scene 4 - Set up your shop (the wizard)  ·  ~150s  ·  Screen: "Setup Your Business" pop-up
The moment a new merchant logs in, the **"Setup Your Business"** wizard opens
automatically. *(If it doesn't appear, click the amber **"Finish your business
setup"** banner on the dashboard.)*

**Do:**
1. **Step 1 - "Welcome Aboard!":** read the checklist (pin location, set hours,
   add first product). Click **"Next"**.
2. **Step 2 - "Pin Your Business Location":** on the map, **drop/drag the pin**
   onto your real shop (or search the address). When the green **"Location saved"**
   note appears, click **"Next"**. *(This step can't be skipped.)*
3. **Step 3 - "Set Business Hours":** confirm the **"Open for Business"** toggle is
   on, set **Opening Time** / **Closing Time**, click **"Next"**.
4. **Step 4 - "Add Your First Product":** click **"Add your first product"**. The
   product form opens:
   - **"Details":** add a **photo** (optional), **Name** (e.g. *Jollof Rice*), and
     **Description** → **"Continue"**.
   - **"Pricing":** enter **Price (₦)** and **Stock** → **"Continue"**.
   - **"Add-ons & choices"** *(food only, optional):* e.g. a *"Pick a protein"*
     group → then **"Create product"**.
   - Back in the wizard you'll see **"First product added!"**
5. Click **"Complete Setup"**.

**Say:**
> "As soon as you log in, this setup wizard pops up - it gets your shop live in
> about five minutes. First, drag the pin to exactly where your shop is; this is
> how customers find you and how delivery is priced, so get it right. Next, set the
> hours you're open. Then add your first product - a photo, a name, the price, and
> how many you have. For food you can add choices like protein or sides. Create it,
> and hit 'Complete Setup.' Your shop is live."

**Watch out:**
- The location step is **required** - there's no skip and no ✕ on that step.
- **"Add your first product"** is greyed out for a second until your category
  loads; price must be greater than ₦0.

---

### Scene 5 - Quick tour + your Products page  ·  ~60s  ·  Screen: **Products**
**Do:**
1. Move the cursor down the sidebar, naming each item: **Orders · Products ·
   Earnings · Analytics · Support · Marketing · Settings**. Point at the top-right
   **business name** and the **light/dark toggle**.
2. Click **Products**. Show the product you just made as a card; point out
   **"Available"** (hide/show to customers), **"Edit"**, and **"Delete"**, and the
   **"New Product"** button to add more.

**Say:**
> "This is your dashboard - Orders, Products, Earnings, and more down the left.
> Here on Products is the item we just added. You can edit it, hide it, delete it,
> or add more anytime with 'New Product.'"

---

### Scene 6 - Where to change things later (Settings)  ·  ~40s  ·  Screen: **Settings**
**Do:** click **Settings**. Tab across **"Profile"** (business name, location,
hours, description), **"Notifications"**, **"Security"** (change password), and
**"Login History"**. Don't fill anything - just orient the viewer.

**Say:**
> "Anything from setup lives here in Settings - change your location or hours under
> Profile, manage alerts under Notifications, and update your password under
> Security."

---

### Scene 7 - Receiving & fulfilling an order  ·  ~90s  ·  Screen: **Orders**
**Do:** walk through the order lifecycle (use your test order; otherwise narrate
over the list + status filter):
1. A new order arrives as **"Requested"** (yellow). Point at the live connection
   indicator (top-right) - orders appear instantly.
2. Click the green **check** ("Accept Order") → **"Accepted"**.
3. Click **"Process"** → **"Processing"** (you're preparing it).
4. Click **"Ready"** → **"Ready for Pickup"** (a rider comes to collect).
5. Explain the rest is automatic: **"Rider Assigned"** → **"Delivered."**
6. Quickly show the **eye** (details), **printer** (receipt), **X** (reject),
   **modify**, **cancel**, plus **Search**, the **status filter**, and **Export**.

**Say:**
> "When a customer orders, it lands here instantly as 'Requested.' Tap the green
> check to accept, 'Process' while you prepare it, and 'Ready' when it's packed -
> that calls a rider to pick it up. iPrime handles the rider and delivery from
> there. You can also view details, print a receipt, search, filter, and export."

**Watch out:** if there are **no orders**, the page shows *"No orders found."* -
either place a test order first (Scene/pre-flight 2) or narrate the flow.

---

### Scene 8 - Getting paid  ·  ~70s  ·  Screen: **Earnings**
**Do:**
1. Click **Earnings**. Point at the four cards: **"Available Balance"**,
   **"Pending Balance"**, **"Total Earnings"**, **"Total Commission"**.
2. Open **Withdraw** and show the form: **amount**, **bank**, **account number**,
   **account name**; how you'd submit.
3. Mention **"Withdrawal History"**, **"Refund History"**, **"Disputes"**.

**Say:**
> "Every sale lands in your wallet. 'Available Balance' is what you can cash out
> now; 'Pending' is still settling. To get paid, choose Withdraw, enter the amount
> and your bank account, and confirm - payouts usually arrive within a day or two.
> You can also see your history and raise a dispute here."

**Watch out:** withdrawals are **min ₦1,000**, **max ₦1,000,000** each; instant
payout has a small (~2%) fee, standard is free.

---

### Scene 9 - Wrap  ·  ~20s
**Say:**
> "And that's it - you're set up and ready to sell. Add more products whenever you
> like, watch orders come in, and cash out anytime. Welcome to iPrime - let's get
> you selling."

---

## 📋 Quick shot-list (tape this next to your screen)
1. Intro (talk) → 2. Register (3 steps) → 3. OTP **✂️ approve in admin, switch
account** → 4. Log in → 5. **Setup wizard** (location → hours → first product →
Complete) → 6. Dashboard tour + Products → 7. Settings (orient) → 8. Orders:
Accept → Process → Ready → 9. Earnings: Withdraw → 10. Wrap.

## 🌍 Hausa version
Once you're happy with the English take, I'll translate every **Say** line into
Hausa so you can record a second pass (or add subtitles).
