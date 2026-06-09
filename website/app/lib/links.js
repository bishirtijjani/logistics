// Cross-app links for the iPrime web apps. The marketing site (this repo) is a
// static export; these are the running Expo-web builds the hero hands off to.
//   - app.iprime.ng   → customer app (mobile/customer-app, web build)
//   - rider.iprime.ng → rider app
// Overridable at build time via NEXT_PUBLIC_* for staging/preview hosts.
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.iprime.ng";

export const RIDER_URL =
  process.env.NEXT_PUBLIC_RIDER_URL?.replace(/\/$/, "") || "https://rider.iprime.ng";

// Deep-link a hero category card into the customer app. The `intent` slug is
// honoured by mobile/customer-app/src/lib/pendingIntent.js, which replays the
// matching screen after sign-in - so a logged-out visitor lands exactly where
// they tapped. Keep these slugs in sync with INTENT_TO_ACTION there.
export const orderLink = (intent) => `${APP_URL}/?intent=${intent}`;
