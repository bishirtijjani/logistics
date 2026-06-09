# Merchant Dashboard - Phase 2 Changelog

A short note for merchants on the product-form changes that landed with Phase 2.

## What changed

Your **Add Product / Edit Product** form is now driven by the category you pick. The form auto-shows only the fields that category needs.

### Variants - per-SKU price and stock
- Pizza in three sizes? Each size is now its own SKU with its own price and its own stock count.
- A 25cl, 50cl, and 1.5L bottle of the same drink? Three SKUs.
- The form auto-generates the SKU matrix from the axes you tick (Size, Color, Strength, Capacity, …).
- You can still skip the matrix and create a single-SKU product - just enter a price and stock once and we'll create the SKU invisibly for you.
- Old per-product `variations` JSON has been migrated into proper SKU rows; nothing on your existing menu is lost.

### Option groups - customer customizations
- Sides, addons, spice level, "no onions", combo picks - these used to be ad-hoc JSON. They're now first-class **option groups** with rules.
- Each group has a selection rule: **pick exactly one** (required) / **pick at most one** (optional) / **pick several** (required or optional, up to a max you set). The form fills in the min/max picks from the rule, so the two can't contradict.
- Each item under a group has its own price delta. "Extra cheese (+₦500)" attaches a real +₦500 to the line total.
- Need to 86 an item for the day? Toggle `Available` off - it greys out in the customer app within 30 seconds without deleting the option.

### Inventory
- Stock counts moved from the product to the SKU. When you sell the last "Large pizza", the Large SKU flips to unavailable; "Small" and "Medium" stay live.
- The inventory screen shows one row per SKU with inline-editable stock.
- Low-stock alerts fire at the SKU level too - no more false "low stock" panic on a product that's only out of one size.

## What to expect

- Existing products keep working. Each got one default SKU on migration, carrying your old `basePrice` and `stock`. Add real variants when you have time; nothing breaks if you don't.
- Customer-app order tickets now show the full breakdown: SKU + options selected + special instructions + price math. No more guessing what "the medium one" means.
- Your **kitchen ticket** shows the same breakdown, with special instructions called out in italics. Use it.

## Walkthrough

The Menu page now has a 30-second walkthrough that fires on first visit after the update. Skip it any time; re-watch from Settings → Help if you want.

## Help

If something feels off - a SKU shows the wrong stock, an option group won't save, the form is asking for an axis you don't recognize - open Support → "Phase 2 product form" and we'll respond same day.
