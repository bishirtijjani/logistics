# Product Model - Variants vs. Option Groups

Phase 2 split the product model into three concepts that previously got conflated:

| Concept | What it is | Data model | When to use |
|---|---|---|---|
| **Variant (SKU)** | A distinct sellable unit with its own price and stock. | `ProductVariant` rows with `attributes` JSON, `price`, `stock`, `packSize`/`packUnit`. | Different sizes, capacities, flavors that the kitchen / inventory treats as separate items. |
| **Option group** | A customization the customer makes on top of a chosen variant. | `ProductOptionGroup` + `ProductOptionItem` rows; selection captured on `RequestItem.selectedOptions`. | Sides, addons, spice level, "no onions", combo picks - things that don't get their own stock count. |
| **Pack size** | The unit count the SKU is sold in. | `packSize` + `packUnit` (+ optional `packLabel` override) on `ProductVariant`. | Pharmacy ("30 × TABLET"), grocery liquid ("500 ml"), grocery dry ("5 kg bag"). |

## Rule of thumb

- If the kitchen / warehouse keeps a separate stock count for it, it's a **variant**.
  - Small/Medium/Large pizza, 25cl/50cl/1.5L bottle, 128GB/256GB phone.
- If it changes the customer's experience but the kitchen just adds it to the same item, it's an **option group**.
  - Spice level, side picks, "extra cheese", "remove onions", combo drink choice.
- Use **both** for combos. A "Family Meal" is one variant whose option groups capture the drink pick, side pick, and protein pick.

## Concrete examples by category

### Food
- **Variants:** Small/Medium/Large pizza, each with its own price and stock.
- **Option groups:**
  - `Toppings` (`OPTIONAL_MULTIPLE`, max 5) - Mushroom (+₦300), Pepperoni (+₦500), …
  - `Spice level` (`REQUIRED_ONE`) - Mild / Medium / Hot (price-neutral).
  - `Sides` (`OPTIONAL_MULTIPLE`, max 3) - Plantain (+₦300), Coleslaw (+₦200), …
  - `Doneness` (`REQUIRED_ONE` - for steak/burger) - Rare / Medium / Well done.
- **Pack:** none - food is sold by the dish.

### Pharmacy
- **Variants:** Strength + Form axes - `{strength:"500mg", form:"TABLET"}` vs `{strength:"250mg", form:"SYRUP"}`.
- **Pack:** required - `30 × TABLET`, `120 × ML`, etc.
- **Option groups:** rare in V1 (some products may offer a generic-vs-brand pick).

### Groceries
A single category covers both dry and liquid stock (real merchants typically
carry both, so splitting them forced double-listing). Pack units span every
common option:
- **Variants:** none by default. Merchants opt in to a `flavor` axis for
  liquids (Original / Strawberry / Vanilla) or `size`/other axes per product.
- **Pack:** required - dry: `5 × KG`, `1 × PACK`, `1 × SACHET`; liquid:
  `500 × ML`, `1 × L`, `5 × BOTTLE`. The `attributeSchema.packUnits` list
  exposes the union so the merchant product form offers every choice.

### Fashion
- **Variants:** Size + Color axes - `{size:"M", color:"Black"}`.
- **Pack:** none.

### Electronics
- **Variants:** Capacity + Color axes - `{capacity:"128GB", color:"Black"}`.
- **Pack:** none.

## What the customer app shows

`ProductDetailScreen` renders:

1. Variant picker chips when `variants.length > 1`. Single-SKU products skip the picker entirely.
2. Each option group in `sortOrder`, with input style derived from `selectionRule`:
   - `REQUIRED_ONE` / `OPTIONAL_ONE` → radio list.
   - `REQUIRED_MULTIPLE` / `OPTIONAL_MULTIPLE` → checkbox list (disabled once `maxSelect` is reached).
3. A `Special instructions` textarea (max 200 chars) that lands in `RequestItem.specialInstructions`.
4. Quantity stepper.
5. A sticky CTA showing the live total: `variant.price + Σ option priceDeltas` × quantity.

Add-to-cart is disabled until every `REQUIRED_*` group is satisfied; the offending group is scrolled into view and highlighted when the user taps the disabled CTA.

## What the server persists

At order creation the server reads the current option-group / item rows by id, validates the selection respects `minSelect`/`maxSelect`, and writes a frozen snapshot onto `RequestItem`:

- `unitPrice = variant.price + Σ option priceDeltas` - computed server-side; client-sent prices are never trusted.
- `lineTotal = unitPrice × quantity`.
- `selectedOptions` JSONB - `[{groupId, groupName, items:[{itemId, itemName, priceDelta}]}]`. Frozen so later merchant menu edits don't rewrite order history.

The server also decrements `ProductVariant.stock` by `quantity` for the resolved variant and flips `isAvailable=false` if stock hits zero.

## Validation guarantees

- Multi-variant products require an explicit `variantId` in `items[].variantId`. Single-variant products auto-resolve server-side.
- Every `REQUIRED_*` option group must be satisfied.
- Every selection must respect `minSelect ≤ count ≤ maxSelect`.
- Out-of-stock or unavailable items / variants are rejected with a clear error.
- Client-supplied `unitPrice` / `lineTotal` are ignored; the server recomputes from server-side state.

## Where to manage the data

| Surface | What it manages |
|---|---|
| Admin → **Category Taxonomy** | `MerchantCategory.attributeSchema` JSON - defines which axes and pack units a category exposes in the merchant form. |
| Merchant → **Menu** | Per-product: variant matrix builder (axes → SKU rows) + option groups builder (drag-reorder, inline edit, 86-toggle). |
| Merchant → **Inventory** | Per-variant stock with inline edit. Low-stock alerts fire at the variant level. |
