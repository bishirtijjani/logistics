# Hausa translation review checklist

The current `ha.json` is a working draft produced for unblocking Phase 9 development. Every key needs review by a native Hausa speaker before launch.

## Review process

1. Open `ha.json` and `en.json` side-by-side.
2. For each section below, mark a ✅ when reviewed and edited, or note specific keys that need rewording.
3. When the whole file has been reviewed, delete `_meta._draft` from `ha.json`.

## Sections

- [ ] `common` — generic UI words (OK, Cancel, Save, etc.). Verify gendered forms (Hausa often distinguishes m/f for second-person commands; this draft uses masculine "ka". Decide if the app should use the neutral "ku" form throughout instead).
- [ ] `a11y` — screen-reader labels. These are spoken aloud, so prioritize clarity over brevity.
- [ ] `states` — empty/error states. Verify the hints sound natural, not literal translations.
- [ ] `locale` — language toggle copy.
- [ ] `auth` — signup, login, OTP, PIN flows. Particularly verify "PIN", "OTP" — keep as-is or translate?
- [ ] `home` — greeting, headline, wallet labels, section titles.
- [ ] `tabs` — tab labels (kept short to fit the tab bar).
- [ ] `orders` — order list copy and tab labels.
- [ ] `wallet` — funding, sending, history.
- [ ] `request.tracking` — tracking screen + cancel modal. Verify "rider" translation ("mai keke" = motorcycle person). If we have bicycle/car riders too, may need broader term.
- [ ] `request.checkout` — checkout flow including the prescription upload section (Phase 8).
- [ ] `merchant` — variant picker, substitution preference. The substitution copy is sensitive (must convey clearly what the merchant will do if an item is unavailable).
- [ ] `utility` — VTU services. Keep "Airtime" / "Data" / "Smart Card" untranslated if those are the colloquial Hausa terms.
- [ ] `settings` — settings screen rows.
- [ ] `notifications` — notification center.
- [ ] `rate` — rating screen.
- [ ] `errors` — every error code's user-facing message. **Most important section** — these are what users see when things go wrong; clarity matters more than poetry.

## Open questions for the reviewer

1. **Honorific form** — current draft uses masculine "ka" / "ka..." throughout. Should we switch to plural-neutral "ku" / "ku..." everywhere for the Katsina audience?
2. **Loanwords** — kept English: PIN, OTP, Wallet, Cart, Menu, Airtime, Data, Smart Card, Email. Confirm or replace.
3. **Currency** — kept "₦" symbol. Should we ever write "naira" in words for accessibility?
4. **Greeting** — "Sannu" used as casual greeting. "Barka da rana" / "barka da yamma" would be more time-aware but harder to drive from app state. Confirm "Sannu" is fine.
5. **"Rider"** — translated as "mai keke" (motorcycle person). Confirm or pick a broader term.
6. **"Prescription"** — translated as "takardar shaida" (literally "certificate"). The clearer pharmacy term may be "takardar likita" (doctor's note). Reviewer to pick.
