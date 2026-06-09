/**
 * Category icon resolution.
 *
 * The backend admin can supply any icon name on a `MerchantCategory`, and the
 * defaults seeded in `backend/prisma/seed-categories.js` use Material / Lucide
 * names (e.g. `shirt`, `smartphone`, `cake`, `beef`) that don't exist in
 * `MaterialCommunityIcons`. When MCI gets an unknown name it renders a "?"
 * glyph - which is what users were seeing on the category grids.
 *
 * Resolution order:
 *   1. Known slug -> curated MCI name (handles the seeded categories).
 *   2. Known Lucide/junk icon name -> MCI replacement.
 *   3. Raw `icon` field, but ONLY if it's a real MCI glyph.
 *   4. `"store"` fallback so we never render a "?".
 *
 * Step 3 is validated against the live MCI glyph map, so any unknown name
 * (admin junk, future seed names) degrades to the general-store icon instead
 * of a "?".
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";

const GLYPHS = MaterialCommunityIcons.glyphMap || {};
const isValidGlyph = (name) =>
  typeof name === "string" && Object.prototype.hasOwnProperty.call(GLYPHS, name);

export const ICON_BY_SLUG = {
  restaurant: "hamburger",
  grocery: "basket",
  pharmacy: "medical-bag",
  fashion: "tshirt-crew",
  shoes: "shoe-formal",
  electronics: "cellphone",
};

// Maps the Lucide-style names seeded in backend/prisma/seed-categories.js (and
// any other known-bad admin input) onto real MaterialCommunityIcons glyphs.
export const ICON_REMAP = {
  // legacy / hand-supplied
  shirt: "tshirt-crew",
  footprints: "shoe-formal",
  smartphone: "cellphone",
  bottle: "bottle-soda",
  restaurant: "silverware-fork-knife",
  // seed-categories.js Lucide names
  cake: "cake-variant",
  "cup-soda": "cup",
  beef: "food-drumstick",
  apple: "food-apple",
  droplet: "water",
  "spray-can": "spray-bottle",
  baby: "baby-carriage",
  "paw-print": "paw",
  pill: "pill",
  "heart-pulse": "heart-pulse",
  sparkles: "shimmer",
  "shopping-bag": "shopping",
  watch: "watch",
  cable: "cable-data",
  "cooking-pot": "pot-steam",
  armchair: "sofa",
  "book-open": "book-open-page-variant",
  "gamepad-2": "gamepad-variant",
  dumbbell: "dumbbell",
  wrench: "wrench",
  sprout: "sprout",
  car: "car",
};

export const resolveCategoryIcon = (cat) => {
  if (!cat) return "store";
  const bySlug = ICON_BY_SLUG[cat.slug];
  if (bySlug) return bySlug;
  const remapped = ICON_REMAP[cat.icon];
  if (remapped && isValidGlyph(remapped)) return remapped;
  if (isValidGlyph(cat.icon)) return cat.icon;
  return "store";
};
