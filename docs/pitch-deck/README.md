# iPrime pitch deck — Founders Friday

Self-contained web deck. All images are embedded as data URIs, so
`iprime-founders-friday.html` runs offline from any machine — just open it
in a browser. No build step, no assets folder, no network needed.

## Published artifact

https://claude.ai/code/artifact/c8119a2e-e59f-4f23-90c9-d973e250bced

Private until shared from the page's share menu.

## Presenting

- Arrow keys, spacebar, or swipe to navigate. `Home` / `End` jump to the ends.
- The URL carries the slide number (`#7`), so a link can open on a given slide.
- Ctrl+P exports a PDF at 1280x720, one slide per page.
- Renders in the viewer's light or dark theme.

## Structure

12-slide spine sized for a 5-minute pitchathon slot, plus 4 appendix slides
for the Q&A that follows.

| # | Slide |
|---|---|
| 1 | Title |
| 2 | Problem |
| 3 | Insight |
| 4 | Product |
| 5 | How it works |
| 6 | Why now |
| 7 | Status |
| 8 | Business model |
| 9 | Market & model |
| 10 | Go to market |
| 11 | The edge |
| 12 | The ask |
| A1 | Product screens |
| A2 | Architecture |
| A3 | Risks |
| A4 | Sources |

## Before it is presented

- **Slide 12 has a `₦[AMOUNT]` placeholder.** The raise figure is not set.
- **Year-1 targets on slide 9 are modelled, not committed**: 25,000 wallets,
  300 deliveries/day, ₦5.49M monthly run rate. Assumptions are printed on the
  slide so they can be argued with. Confirm they match what is actually intended.
- **Phase-1 numbers on slide 10** (50 riders, 100 merchants) are estimates.

Slide 7 states plainly that iPrime is pre-launch with no public users, and
every forward figure after it is labelled a projection. Keep that framing.

## Figures that are real, not estimated

Taken from the running platform, not invented for the deck:

- Delivery fee: ₦200 base + ₦100/km
- Platform take on delivery: 30% (rider keeps 70%)
- Merchant commission: 15% default, adjustable per merchant

## Imagery

Brand photography comes from `website/public/images/` (`audience-*.png`,
`mock-with-packages.png`); product screenshots from `store-assets/customer/`,
`admin-dashboard/public/help/screenshots/`, and
`merchant-dashboard/public/help/screenshots/`.

Captions deliberately avoid implying live operations, since the company is
pre-launch.

## Outstanding

- Convert to `.pptx` (python-pptx or a Node equivalent).
- Unused assets that may still earn a slide: `website/public/katsina-map-bg.svg`,
  the remaining 17 admin and 12 merchant screenshots.