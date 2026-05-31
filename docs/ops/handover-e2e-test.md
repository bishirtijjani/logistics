# iPrime — pre-handover end-to-end manual test

A single linear smoke pass across **website + merchant dashboard + admin dashboard**.
Tick each box; **🔴 = must-pass** (a fail here blocks handover). Target: ~45 min.

The flows connect on purpose: you register a shop in Part 2, **approve it** in Part 3,
then **log in as it** in Part 4 — so the merchant↔admin loop is exercised for real.

---

## 0. Pre-flight (2 min)

**Local URLs / logins**

| App | URL | Login |
|---|---|---|
| Backend API | http://localhost:3000 | — |
| Website (public) | http://localhost:4321 | — |
| Merchant dashboard | http://localhost:5174 | `merchant@test.com` / `merchant123` (seeded, approved, has data) |
| Admin dashboard | http://localhost:3001 | `admin@vtulogistics.com` / `admin123456` |

Run this to confirm everything's up **and** to (re)populate demo orders/earnings:

```bash
curl -s -o /dev/null -w "backend  %{http_code}\n" http://localhost:3000/categories
curl -s -o /dev/null -w "merchant %{http_code}\n" http://localhost:5174/
curl -s -o /dev/null -w "admin    %{http_code}\n" http://localhost:3001/login
curl -s -o /dev/null -w "website  %{http_code}\n" http://localhost:4321/help/
node backend/scripts/seed-demo-orders.js
```

- [ ] All four return **200** and the seed prints "Created 7 demo orders."
- Use an **incognito window**. The ☀️/🌙 button toggles dark/light — flip it once per app.
- ⚠️ **OTP codes are printed in the backend terminal** (SMS/WhatsApp aren't configured locally) — keep that window visible for Part 2.

---

## 1. Website — public Help Center & gating (5 min)

- [ ] 🔴 Open **http://localhost:4321/help/** → landing shows **"For Merchants"** only, **no "For Admins."**
- [ ] 🔴 Search **`how to withdraw to bank`** → top result is **"Getting paid: earnings and withdrawals."**
- [ ] Search **`how to add a new product`** → top result **"Adding and managing products."** Try a typo (`withdrwal`) → still finds Getting paid.
- [ ] Open any guide → **screenshots render**, sidebar lists merchant guides, **no Merchant⇄Admin switcher** (admin is hidden).
- [ ] 🔴 Visit **http://localhost:4321/help/admin/managing-merchants/** → **404** (admin docs are not public).
- [ ] Open **http://localhost:4321/merchants/** → scroll to *How it works* → **"Read the step-by-step merchant guide"** opens a guide; final CTA **"Browse the merchant guides"** opens `/help`.

---

## 2. Merchant — new-shop sign-up + OTP (8 min)

- [ ] Open **http://localhost:5174/** → header shows **Guides** link (and in the footer); the Guides link opens the Help Center.
- [ ] Click **Register** → **Step 1** name/email (use a NEW email, e.g. `qa1@iprime.ng`)/phone (`08011112222`)/password → **Next**.
- [ ] 🔴 **Step 2** pick a **category**, business name/phone/email → **Next**. **Step 3** set hours → **Complete Registration**.
- [ ] 🔴 OTP screen → read the **6-digit code from the backend terminal** → **Verify Email** → see **"pending admin approval."**
- [ ] (Try logging in now → it should refuse, because you're not approved yet. Leave it — you'll approve in Part 3.)

---

## 3. Admin — approve the shop + touch every screen (15 min)

- [ ] 🔴 Log in at **http://localhost:3001** (`admin@vtulogistics.com` / `admin123456`).
- [ ] 🔴 **Dashboard** → 6 stat cards, Revenue/Request charts, Pending panels all render.
- [ ] 🔴 **Merchants** → **Pending Review** tab → find your new shop → open it → **Approve Application** (status → *Active*).
- [ ] **Merchants** → open `Test Restaurant` → drawer tabs **Profile / Commission / Wallet / Tags** all load; **Withdrawals** tab lists payout requests.
- [ ] **Riders** → *All Riders* + *Pending Approvals* tabs; open the seeded rider → **Profile / Documents / Earnings** tabs.
- [ ] **Requests** → list of delivery orders shows; click one → details (items, customer, fees).
- [ ] **Disputes** → loads (may be empty — fine). **Support** → ticket list loads.
- [ ] **Customers** → search a name → open a customer → **Requests / Transactions / Addresses** tabs.
- [ ] **Transactions** → filter by **type** and **status**; rows update. **Financial** → loads.
- [ ] **Categories** → list renders; open one (edit form opens). **VTU Plans** → tabs (Airtime/Data/Cable/Electricity); **VTU Networks** → list.
- [ ] **Marketing** → banners screen. **Settings** → Platform Config / Commission Defaults / Notifications sections.
- [ ] **Analytics** → tabs Overview/Revenue/Orders/Customers/Geographic. **Safety** → loads. **Waitlist** → loads (Refresh works).
- [ ] 🔴 **Audit Logs** → your **merchant-approval from above appears** here.
- [ ] ⚠️ **Rider Ops** — known incomplete (real-time/performance endpoints deferred). Expect partial/empty; **not a blocker**.
- [ ] 🔴 Click the **"?"** button (bottom-right) → help drawer opens to the relevant guide; search `approve a vendor` → "Approving and managing merchants." Close it.
- [ ] Toggle **dark mode** once — layout stays intact.

---

## 4. Merchant — onboarding wizard + daily use (15 min)

**4a. The freshly-approved shop (the wizard):**
- [ ] 🔴 Log in at **http://localhost:5174** as the **shop you just approved** (`qa1@iprime.ng`).
- [ ] 🔴 The **"Setup Your Business"** wizard auto-opens → **Step 1 of 3** Welcome → Next.
- [ ] 🔴 **Pin Your Business Location** (Step 2) → search an address / drag the pin → "Location saved" → Next. *(There should be **NO separate hours step** — it's Welcome → Location → Product.)*
- [ ] 🔴 **Add Your First Product** (Step 3) → fill name + price → **Create product** → "First product added!" → **Complete Setup**.

**4b. Daily use (switch to the seeded shop for populated data):**
- [ ] Sign out → log in as **`merchant@test.com` / `merchant123`**.
- [ ] 🔴 **Products** → 3 products render with **₦ prices and no garbled text** (e.g. "₦2,500 · 40 in stock"). Click **New Product** → 3-step modal (Details → Pricing → Add-ons). Toggle **Available**, try **Edit**, use search.
- [ ] 🔴 **Orders** → demo orders show across statuses. On a **Requested** order: **Accept** → **Process** → **Ready** (status badges change). Try **view details**, **print receipt**, status filter, search, **Export**.
- [ ] 🔴 **Earnings** → 4 balance cards populated (Available ~₦10,540). **Request Withdrawal** → modal shows amount + bank + account fields. Check **Withdrawal History / Refund History / Disputes** buttons.
- [ ] 🔴 **Settings → Profile** → confirm the **"Open for orders"** toggle is present; change hours → **Save Changes**. Check **Notifications**, **Security** (password form), **Login History** tabs.
- [ ] **Support** → tabs **My Tickets / Disputes / FAQ / Knowledge Base**; **New ticket** opens the form.
- [ ] 🔴 Click the **"?"** help button → opens to the current page's guide; search **`cash out`** → "Getting paid"; open a guide → **screenshots render**; Back/Close work.
- [ ] Toggle **dark mode**; shrink the window to phone width → sidebar collapses to a drawer and opens/closes.

---

## 5. Wrap / sign-off

- [ ] No red console errors blocking any core flow (open DevTools console on each app once).
- [ ] All 🔴 items passed.

**Recently changed — worth a closer look (where regressions would hide):**
- Merchant **products list** (was a reducer bug — products now render) and **mojibake** fix (₦, ·, … in the product form).
- Onboarding **wizard** (hours step removed) + new **"Open for orders"** toggle in Settings.
- **In-app help** ("?" panel) + **search** in both dashboards; **Help Center** role gating (admin not public); **Guides** links on the website /merchants page and the dashboard landing.

**Before deploying (not part of the smoke test):**
- Both dashboards' `.env` currently point at **`http://localhost:3000`** for local testing — **revert to `https://api.iprime.ng`** before building for production.
- Dashboard-landing **Guides** links are hardcoded to `https://iprime.ng/help/...` — confirm that's the real Help Center URL.
- Admin account is **`admin@vtulogistics.com`** (a pre-rebrand email) — decide whether to migrate it to the iPrime domain.
