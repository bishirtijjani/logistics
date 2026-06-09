/**
 * Maps navigation deep-link service - Phase 4.
 *
 * Opens external turn-by-turn navigation. We deliberately do NOT embed
 * navigation inside the rider app (v1 non-goal). The rider's go-to is
 * Google Maps; we fall back through Waze → generic geo: → Apple Maps.
 *
 * The customer-app uses the same pattern; this is the rider equivalent
 * with the addition of OS-specific preferred order:
 *   - Android: google.navigation:q=lat,lng → waze://?ll=...&navigate=yes → geo:lat,lng?q=label
 *   - iOS:     comgooglemaps://?q=lat,lng → waze://?ll=...&navigate=yes → maps://?daddr=lat,lng
 *
 * `Linking.canOpenURL` requires the URL scheme to be whitelisted in iOS's
 * `LSApplicationQueriesSchemes`. We try each candidate and rely on the
 * native error from `openURL` to fall through to the next - slightly more
 * resilient than canOpenURL gating, and works even if the manifest is
 * missing the entry.
 */

import { Linking, Platform } from "react-native";

function encodeLabel(label) {
  if (!label) return "";
  try { return encodeURIComponent(String(label)); } catch (_) { return ""; }
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Try a list of URLs in order. Resolves to the URL that opened (or null if
 * none did).
 */
async function tryUrls(urls) {
  for (const url of urls) {
    if (!url) continue;
    try {
      // canOpenURL is best-effort; we still attempt openURL so we don't
      // silently fail if the manifest lacks an entry for the scheme.
      // eslint-disable-next-line no-await-in-loop
      await Linking.openURL(url);
      return url;
    } catch (_) {
      // try next
    }
  }
  return null;
}

/**
 * Open turn-by-turn navigation to the supplied coords.
 *
 * @param {{ lat:number, lng:number, label?:string }} target
 * @returns {Promise<{ ok:boolean, opened?:string }>}
 */
export async function openTo(target) {
  if (!target || !isFiniteNumber(target.lat) || !isFiniteNumber(target.lng)) {
    return { ok: false };
  }
  const { lat, lng } = target;
  const labelEnc = encodeLabel(target.label);

  // Web: custom schemes (google.navigation:, geo:, waze://) don't resolve in a
  // browser, and an unhandled-scheme openURL can "succeed" without navigating -
  // so go straight to the Google Maps web directions URL (opens a new tab).
  if (Platform.OS === "web") {
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    const opened = await tryUrls([webUrl]);
    return opened ? { ok: true, opened } : { ok: false };
  }

  const candidates = Platform.OS === "ios"
    ? [
        // Google Maps iOS scheme (only fires if Google Maps is installed)
        `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
        // Waze
        `waze://?ll=${lat},${lng}&navigate=yes`,
        // Apple Maps (always present on iOS)
        `https://maps.apple.com/?daddr=${lat},${lng}${labelEnc ? `&q=${labelEnc}` : ""}`,
      ]
    : [
        // Google Maps Android intent - best-quality experience
        `google.navigation:q=${lat},${lng}&mode=d`,
        // Waze
        `waze://?ll=${lat},${lng}&navigate=yes`,
        // Geo URL - picker dialog of any installed maps app
        `geo:${lat},${lng}?q=${lat},${lng}${labelEnc ? `(${labelEnc})` : ""}`,
        // Final fallback: web URL - opens browser to Google Maps directions
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
      ];

  const opened = await tryUrls(candidates);
  return opened ? { ok: true, opened } : { ok: false };
}

/**
 * Open the device dialer to a phone number. Best-effort; returns false if
 * the OS rejects the tel: scheme (some sandboxed devices).
 */
export async function dial(phoneNumber) {
  if (!phoneNumber) return false;
  const cleaned = String(phoneNumber).replace(/[^0-9+]/g, "");
  if (!cleaned) return false;
  try {
    await Linking.openURL(`tel:${cleaned}`);
    return true;
  } catch (_) {
    return false;
  }
}

export default { openTo, dial };
