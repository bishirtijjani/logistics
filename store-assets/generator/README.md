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
| `store-assets/merchant/screenshots/ios-1290x2796/en/*.png` | 1290×2796 ×6 |
| `store-assets/merchant/screenshots/android-1080x1920/en/*.png` | 1080×1920 ×6 |
| `store-assets/merchant/screenshots/ipad-2048x2732/en/*.png` | 2048×2732 ×6 |

## How it works

- `brand.css` — brand tokens copied from `mobile/merchant-app/src/theme/tokens.js`
  plus the three Roboto weights (`fonts/`, Apache-2.0).
- `templates/icon.html` — one parametrized template for the icon / adaptive
  icon / splash / favicon. Query params: `?bg=orange|transparent`,
  `?ratio=<width fraction of the mark>`, `?color=white|brand`. The wordmark is
  JS-fitted so its glyph width converges on `ratio` × icon width.
- `templates/feature-graphic.html` — 1024×500 Play banner.
- `templates/screens/*.html` — the six mockups. All sizing is in `--dp`
  (density-independent units) so one template renders correctly on iPhone
  (430pt), Android (360dp) and iPad (1024pt) logical widths; `frame.js`
  injects the status bar / tab bar / dynamic island from `?device=`.
- `templates/screens/screens.css` — device shells + app component styles.

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
