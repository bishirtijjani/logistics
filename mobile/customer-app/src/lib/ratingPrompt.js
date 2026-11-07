/**
 * Local-only preferences that gate the post-delivery "rate your order" nudge
 * and the follow-on app-store review ask. Nothing here is backend-synced -
 * it's purely a client-side nag-prevention layer.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const OPT_OUT_KEY = '@logistics/rating_prompt_opt_out';
const SEEN_ORDERS_KEY = '@logistics/rating_prompt_seen_orders';
const LAST_ASKED_KEY = '@logistics/rating_prompt_last_asked';
const STORE_REVIEW_LAST_ASKED_KEY = '@logistics/store_review_last_asked';

// Don't nudge again for a few days after a "not now" / dismiss, even across
// different orders - one prompt per visit at most.
const PROMPT_COOLDOWN_MS = 4 * 24 * 60 * 60 * 1000;
// Store review has its own, longer cooldown for the manual Linking fallback
// (the native requestReview() call already self-throttles per OS).
const STORE_REVIEW_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_SEEN_ORDERS = 200;

export async function isRatingPromptOptedOut() {
  return (await AsyncStorage.getItem(OPT_OUT_KEY)) === '1';
}

export async function setRatingPromptOptedOut(optOut) {
  await AsyncStorage.setItem(OPT_OUT_KEY, optOut ? '1' : '0');
}

async function getSeenOrderIds() {
  try {
    const raw = await AsyncStorage.getItem(SEEN_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function markOrderSeen(orderId) {
  const seen = await getSeenOrderIds();
  if (seen.includes(orderId)) return;
  const next = [...seen, orderId].slice(-MAX_SEEN_ORDERS);
  await AsyncStorage.setItem(SEEN_ORDERS_KEY, JSON.stringify(next));
}

async function isOnCooldown(key, cooldownMs) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return false;
  return Date.now() - Number(raw) < cooldownMs;
}

// Picks the first delivered-unrated order worth prompting about, or null.
export async function pickOrderToPrompt(candidates) {
  if (await isRatingPromptOptedOut()) return null;
  if (await isOnCooldown(LAST_ASKED_KEY, PROMPT_COOLDOWN_MS)) return null;
  const seen = await getSeenOrderIds();
  return (candidates || []).find((r) => r?.id && !r.rating && !seen.includes(r.id)) || null;
}

// Call whether the user rated, dismissed, or closed the banner - in every
// case we shouldn't ask about that same order again.
export async function markOrderPromptResolved(orderId) {
  await markOrderSeen(orderId);
  await AsyncStorage.setItem(LAST_ASKED_KEY, String(Date.now()));
}

export async function canAskForStoreReview() {
  if (await isRatingPromptOptedOut()) return false;
  return !(await isOnCooldown(STORE_REVIEW_LAST_ASKED_KEY, STORE_REVIEW_COOLDOWN_MS));
}

export async function markStoreReviewAsked() {
  await AsyncStorage.setItem(STORE_REVIEW_LAST_ASKED_KEY, String(Date.now()));
}
