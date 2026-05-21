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

## Decisions applied in the Phase 10 #4.3 polish pass

The original open questions have been resolved as follows. The native
reviewer should still validate the wording — these decisions only fix the
structural ambiguities; line-by-line word choice is still draft.

1. ✅ **Honorific form** — switched from masculine-singular "ka" / "kai" /
   "kana" / "kake" / "maka" / "naka" / "kanka" / "ɗinka" / etc. to
   plural-neutral "ku" / "kuna" / "kuke" / "muku" / "naku" / "kanku" /
   "ɗinku". More inclusive for a mass-market app. The idiom "kai tsaye"
   ("live" / "in real time") was protected. 136 strings touched. Script
   that performed the change is at `scripts/hausa-polish.js`.
2. ✅ **Loanwords kept** — PIN, OTP, Wallet, Cart, Menu, Airtime, Data,
   Smart Card, Email remain in English. These are the colloquial usage
   even in monolingual Hausa speech.
3. ✅ **Currency stays as "₦"** — universally recognized; spelling out
   "naira" loses line space and adds friction. Use the symbol.
4. ✅ **Greeting stays as "Sannu"** — appropriate casual register for a
   service app. Time-of-day variants ("Barka da rana", "Barka da yamma")
   would need state plumbing that isn't worth the complexity for V1.
5. ✅ **"Rider"** — changed from "mai keke" (motorcycle person) to the
   English loanword **"rider"**. Vehicle-neutral; future-proofs car /
   bicycle deliveries. Common in Nigerian English even within Hausa speech.
6. ✅ **"Prescription"** — changed from "takardar shaida" (certificate)
   to "takardar likita" (doctor's prescription). Standard pharmacy term.

## What the native reviewer still needs to do

- Line-by-line tone check — the LLM draft can produce grammatically valid
  but flat or unnatural copy. A native ear catches this.
- Verify the "ku" pluralization didn't break any verb conjugations in
  context (the script handles the common cases — kana/kake/maka — but
  uncommon constructions may still read awkwardly).
- Confirm regional vocabulary choices (e.g. "lantarki" vs "wuta" for
  electricity; "kuɗi" vs "naira" in body text).
- Sign off on error messages — these are what users see when things go
  wrong, so clarity matters more than poetry.

When done, delete `_meta._draft` from `ha.json` to mark the file as
review-complete.
