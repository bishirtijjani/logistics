import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';
import { canAskForStoreReview, markStoreReviewAsked } from './ratingPrompt';

const IOS_APP_STORE_ID = '6793998826';
const ANDROID_PACKAGE = 'ng.logistics.customer';

// Nudges the user toward a store review. Only call this after a happy
// signal (e.g. a high in-app rating) - never cold. Prefers the native
// in-app review sheet, which the OS itself throttles and lets the user
// dismiss with zero friction; falls back to opening the store listing.
export async function maybeRequestStoreReview() {
  if (!(await canAskForStoreReview())) return;

  try {
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
      await markStoreReviewAsked();
      return;
    }
  } catch {
    // fall through to manual link
  }

  const url = Platform.OS === 'ios'
    ? `itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`
    : `market://details?id=${ANDROID_PACKAGE}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      await markStoreReviewAsked();
    }
  } catch {
    // Best-effort only - never surface an error for this.
  }
}
