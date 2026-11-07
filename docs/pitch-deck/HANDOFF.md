# Handoff — read this first

Context for continuing the Logistics Platform pitch deck in a fresh session, on any
machine. The conversation that produced the deck does not transfer; this
file is the replacement.

## To edit the published deck without breaking the link

The deck is already published at:

    https://claude.ai/code/artifact/c8119a2e-e59f-4f23-90c9-d973e250bced

A new conversation did not publish it, so republishing will mint a **new
URL** unless the existing one is passed explicitly. When asking Claude to
update it, give it that URL and say to update in place. Otherwise the old
link keeps serving the old deck and anyone already holding it sees stale
content.

Source of truth is `logistics-founders-friday.html` in this folder. Edit that,
then republish it to the URL above.

## Who is pitching

**Muhammad Umar Lawal** is the founder, the owner of Logistics Platform, and the person
presenting. The deck is written in his voice.

The development agency that built the platform must not appear anywhere in
the deck or any other outward-facing material. This is deliberate, not an
oversight. "Owned outright, no vendor lock-in, no revenue share" on slide 11
is the correct and truthful framing of the stack.

## The event

Founders Friday — monthly Northern Nigeria ecosystem meetup. Kano chapter
meets the 3rd Friday of the month, Abuja the last Friday. 200-450 attendees
in a casual hub setting: founders, ecosystem players, and some angels
(Angels Radar and TechCabal partner on the Abuja edition).

The pitching segment is a **Pitchathon** — short-form. The deck is sized for
a **5-minute slot**: 12 slides live, 4 appendix slides held back for Q&A.

Design consequence: it is read from the back of a large room off a projector.
Type is deliberately oversized and there is one idea per slide. Do not add
dense body copy.

## The honesty position — do not quietly erode this

Logistics Platform is **pre-launch**. Both apps sit in Google Play closed testing. There
are zero public users and no revenue.

Slide 7 says this outright, and every figure after it is labelled a
projection. That disclosure is what makes the rest of the deck credible to a
room that can smell invented traction. If slides get rewritten, keep it.

### Figures that are real

Read out of the running platform, not estimated:

- Delivery fee: ₦200 base + ₦100/km
- Platform take on delivery: 30% (rider keeps 70%)
- Merchant commission: 15% default, adjustable per merchant
- 4 production surfaces, 300+ API endpoints, 44 Prisma models, 20 backend modules

### Figures that are modelled

Bottom-up estimates, printed with their assumptions visible so they can be
argued with rather than taken on faith:

- 25,000 active wallets by month 12
- 300 deliveries/day at exit rate
- ₦5.49M monthly platform revenue at month 12
- Phase 1: 50 riders, 100 merchants

### Market data, with sources on slide A4

- : 10.5M people, 3rd most populous state (NPC/NBS projections)
- North West is Nigeria's most financially excluded region, ~51% of adults (EFInA)
- 26M Nigerian adults financially excluded nationally (EFInA)
- ₦447bn monthly national VTU volume (Mobifin, via The Guardian Nigeria)
- 145M active mobile lines (NCC)
- Katsina is the first state to domesticate the Nigeria Startup Act, with a
  ₦250m minimum annual startup fund, and was selected for the federal
  $10bn Innovation Hub programme

## Open items

1. **Slide 12 still says `₦[AMOUNT]`.** The raise figure has not been set.
   It should cover 18 months of the plan on slide 10, not 12.
2. **Convert to `.pptx`** via python-pptx or a Node equivalent. Requested,
   not started. Ctrl+P already produces a clean 1280x720 PDF.
3. **Unused assets** that could still earn a slide: `website/public/katsina-map-bg.svg`
   (geography for slide 9 or 10), plus 17 admin and 12 merchant screenshots
   beyond the two already used.

## Decisions already made — do not redo

- 12-slide spine, not 13. An earlier draft added a standalone "Thank you"
  slide; it was folded into the ask so the slide on screen during Q&A
  carries the ask and the founder's contact details.
- The "Set the raise amount before pitching" note was removed from slide 12.
  It was guidance for the author and would have been projected to the room.
- Brand photography is used without captions implying live operations,
  because there are none yet.
- Palette and type derive from the existing product brand: burnt orange
  #EA580C with warm stone neutrals. Both light and dark themes are designed;
  photo opacity is a theme token (58% dark, 34% light).