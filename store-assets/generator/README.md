# Merchant visual asset generator

Renders every iPrime **Merchant** store/brand asset from HTML/CSS/SVG — no
Figma, Inkscape, or Pillow required. One command, exact store dimensions.

## Run

```bash
node store-assets/generator/render.mjs
# or, from the repo root:
npm run assets:merchant
```

Uses the repo-root **Playwright Chromium** (already a root devDependency) and
serves this folder over a throwaway localhost port so `@font-face` and
relative paths load cleanly. `deviceScaleFactor=1` means the PNGs come out at
exactly the viewport size.

## Outputs

| File | Size |
|---|---|
| `mobile/merchant-app/assets/icon.png` | 1024×1024 (opaque) |
| `mobile/merchant-app/assets/adaptive-icon.png` | 1024×1024 (transparent) |
| `mobile/merchant-app/assets/splash-icon.png` | 1024×1024 (transparent) |
| `mobile/merchant-app/assets/favicon.png` | 256×256 |
| `store-assets/merchant/icon-1024.png` | 1024×1024 |
| `store-assets/merchant/icon-512.png` | 512×512 |
| `store-assets/merchant/feature-graphic.png` | 1024×500 |
| `store-assets/merchant/playstore-merchant-phone-*.png` | 1080×1920 ×7 |
| `store-assets/merchant/playstore-merchant-tablet-7-*.png` | 1200×1920 ×7 |
| `store-assets/merchant/playstore-merchant-tablet-10-*.png` | 1600×2560 ×7 |
| `store-assets/merchant/appstore-merchant-iphone-*.png` | 1320×2868 ×7 (6.9″) |
| `store-assets/merchant/appstore-merchant-ipad-*.png` | 2064×2752 ×7 (13″) |

App Store sizes differ from Play (Apple rejects Play dimensions); the same
templates render at both because the layout is viewport-relative. Apple's
6.9″ set auto-scales to every smaller iPhone, and the 13″ iPad set is
required because the app declares `supportsTablet: true`.

Screenshots use the approved Play Store marketing style (see
`store-assets/iprimeriderplaystorescreenshots/`): paper canvas, orange
eyebrow, big two-tone headline, subtitle, a floating phone mockup showing
the app, footer brand lockup, and an orange bottom bar. The seven frames
are `orders, order-detail, products, earnings, store-status, analytics,
bills`.

## How it works

- `brand.css` — brand tokens copied from `mobile/merchant-app/src/theme/tokens.js`
  plus the three Roboto weights (`fonts/`, Apache-2.0).
- `templates/icon.html` — one parametrized template for the icon / adaptive
  icon / splash / favicon. Query params: `?bg=orange|transparent`,
  `?ratio=<width fraction of the mark>`, `?color=white|brand`,
  `?label=MERCHANT` (small uppercase marker stacked above `iPrime`). The
  wordmark/label are JS-fitted so their glyph widths converge on target, and
  the `MERCHANT` lockup is what distinguishes the merchant icon from the plain
  rider/customer mark. The splash is intentionally left label-less.
- `templates/feature-graphic.html` — 1024×500 Play banner.
- `templates/screens/*.html` — the seven marketing frames. Header copy +
  a floating phone mockup + footer. `frame.js` injects the iOS status bar,
  dynamic island and home indicator. The phone's internal sizing is in
  `--dp` (derived from `--phoneH`), so the app UI scales with the mockup at
  every canvas size.
- `templates/screens/screens.css` — marketing layout + phone shell + app
  component styles.

The mockups mirror the real screens in `mobile/merchant-app/src/features`
(Orders, Order detail, Products, Earnings, Store) and the push-with-actions
capability in `src/services/notifications.js`.

## Editing

- Change copy/colors/data → edit the relevant `templates/screens/*.html`
  (colors live in `brand.css`).
- Add a frame → add a `<div class="card">…` block.
- Add a device class → add an entry to `DEVICES` in `render.mjs` and a
  matching `[data-device="…"]` block in `screens.css`.
- Regenerate icons after any brand change by re-running the command.
