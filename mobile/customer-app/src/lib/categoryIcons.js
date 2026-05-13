/**
 * Category icon resolution.
 *
 * The backend admin can supply any icon name on a `MerchantCategory`, and the
 * defaults seeded in `backend/prisma/seed.js` use Material / Lucide-style
 * names (e.g. `shirt`, `smartphone`, `restaurant`) that don't exist in
 * `MaterialCommunityIcons`. When MCI gets an unknown name it renders a "?"
 * glyph — which is what users were seeing on the home grid.
 *
 * Resolution order:
 *   1. Known slug → curated MCI name (handles the seeded categories).
 *   2. Known bad icon name → MCI replacement (covers admin-supplied junk).
 *   3. Raw `icon` field as-is (admin already supplied a valid MCI name).
 *   4. `"store"` fallback so we never render a "?".
 */

export const ICON_BY_SLUG = {
  restaurant: "hamburger",
  grocery: "basket",
  pharmacy: "medical-bag",
  fashion: "tshirt-crew",
  shoes: "shoe-formal",
  electronics: "cellphone",
};

export const ICON_REMAP = {
  shirt: "tshirt-crew",
  footprints: "shoe-formal",
  smartphone: "cellphone",
  bottle: "bottle-soda",
  restaurant: "silverware-fork-knife",
};

export const resolveCategoryIcon = (cat) =>
  ICON_BY_SLUG[cat.slug] || ICON_REMAP[cat.icon] || cat.icon || "store";
