/**
 * Cart helpers — pure utilities shared by the cart slice, MerchantMenu,
 * ProductDetail, CartScreen, and CheckoutScreen.
 *
 * Cart is single-merchant. The `cartSlice` enforces that contract; this file
 * exposes the math + a few formatting helpers.
 */

/**
 * Sum of every line's `lineTotal`. Lines carry pre-computed totals so we
 * don't have to walk options here.
 */
export const computeCartTotal = (lines) =>
  (lines || []).reduce((sum, l) => sum + Number(l.lineTotal || 0), 0);

/**
 * Total number of *units* (sum of quantities). Used by the bottom-tab badge,
 * which is more informative than counting lines (a "3× Burger" line shouldn't
 * register as 1).
 */
export const computeCartCount = (lines) =>
  (lines || []).reduce((sum, l) => sum + Number(l.quantity || 0), 0);

/**
 * Snapshot of merchant info we cache alongside the cart so CartScreen and
 * CheckoutScreen don't need to refetch the merchant just to render headers
 * and submit the order. Mirrors what MerchantMenu previously forwarded via
 * navigation params.
 */
export const buildMerchantSnapshot = (merchant, categorySlugFallback = null) => {
  if (!merchant) return null;
  return {
    id: merchant.id,
    name: merchant.name || null,
    categorySlug: merchant.category?.slug || categorySlugFallback || null,
    lat: Number(merchant.lat ?? 0),
    lng: Number(merchant.lng ?? 0),
    address: merchant.address || 'Merchant Location',
  };
};

/**
 * Payload shape the backend expects on POST /requests and /requests/quote.
 * Strips the customer-app-only fields (variantSummary, imageUrl, …) and
 * only forwards what the server validates.
 */
export const toServerItems = (lines) =>
  (lines || []).map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    selectedOptions: (line.selectedOptions || []).map((g) => ({
      groupId: g.groupId,
      itemIds: g.itemIds,
    })),
    specialInstructions: line.specialInstructions || undefined,
    substitution: line.substitution || undefined,
  }));
