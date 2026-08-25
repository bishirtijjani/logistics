import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, AppState, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as IntentLauncher from "expo-intent-launcher";
import { useTheme } from "../theme";
import { showAlert } from "../lib/safeAlert";

const IS_WEB = Platform.OS === "web";

/**
 * Warns the rider when device location services are off OR app permission is
 * not granted. Auto-rechecks on every AppState `active` event so a trip to
 * Settings → return is reflected immediately.
 *
 * Phase 9: when the primary requirements are met but full background access
 * ("Allow all the time" / iOS Always) is missing, shows a separate nudge so the
 * rider enables it and stays in the dispatch loop while the app is minimised.
 *
 * Renders nothing when everything is fine.
 */
export default function LocationServicesEnabledBanner() {
  const { tokens } = useTheme();
  const [check, setCheck] = useState({
    permission: "granted",
    canAskAgain: true,
    servicesEnabled: true,
    backgroundPermission: "granted",
  });

  const recheck = async () => {
    if (IS_WEB) {
      await recheckWeb(setCheck);
      return;
    }
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      let backgroundPermission = "granted";
      if (status === "granted" && servicesEnabled) {
        try {
          const bg = await Location.getBackgroundPermissionsAsync();
          backgroundPermission = bg.status;
        } catch (_) {
          // Background permission API not available on this platform/build.
          backgroundPermission = "granted";
        }
      }
      setCheck({ permission: status, canAskAgain, servicesEnabled, backgroundPermission });
    } catch (_) {
      // Don't crash if the platform API misbehaves.
    }
  };

  useEffect(() => {
    recheck();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") recheck();
    });
    return () => sub.remove();
  }, []);

  const permissionOk = check.permission === "granted";
  const servicesOk = check.servicesEnabled;
  const hasPrimaryIssue = !permissionOk || !servicesOk;

  if (hasPrimaryIssue) {
    const isPermissionIssue = !permissionOk;
    const title = isPermissionIssue
      ? "Location permission needed"
      : "Location services are off";
    const body = isPermissionIssue
      ? "Allow iPrime Rider to use your location so you can receive nearby jobs."
      : "Turn on Location on your device to start receiving jobs.";

    const openSettings = async () => {
      try {
        if (Platform.OS === "android") {
          if (!servicesOk) {
            await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS);
          } else {
            await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
              data: "package:ng.iprime.rider",
            });
          }
        } else {
          await Linking.openSettings();
        }
      } catch (_) {
        await Linking.openSettings().catch(() => {});
      }
    };

    const handleFix = async () => {
      // Web (incl. iPhone Safari): there is no OS settings screen to deep-link to,
      // and expo-location's requestForegroundPermissionsAsync() doesn't reliably
      // surface the browser's native prompt (Safari has no Permissions API for
      // geolocation). Drive the browser Geolocation API directly instead - and it
      // MUST run synchronously inside this tap gesture or Safari suppresses the
      // prompt, so don't await anything before calling getCurrentPosition.
      if (IS_WEB) {
        handleFixWeb(setCheck, check);
        return;
      }

      // For a permission issue, show the native prompt directly while the OS still
      // allows it. Only deep-link to Settings once it's been permanently denied
      // (canAskAgain === false) or when the underlying problem is services being off.
      if (isPermissionIssue && check.canAskAgain) {
        try {
          await Location.requestForegroundPermissionsAsync();
        } catch (_) {
          await openSettings();
        }
        // The prompt doesn't fire AppState, so refresh the banner ourselves.
        await recheck();
        return;
      }
      await openSettings();
    };

    return (
      <View
        style={{
          marginTop: 12,
          marginHorizontal: 0,
          padding: 14,
          borderRadius: 14,
          backgroundColor: tokens.status.warningSoft,
          borderWidth: 1,
          borderColor: tokens.status.warningSoft,
          flexDirection: "row",
          alignItems: "center",
        }}
        accessibilityRole="alert"
      >
        <Ionicons name="warning-outline" size={22} color={tokens.status.warningStrong} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.status.warningStrong, marginBottom: 2 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 12, color: tokens.text.primary, lineHeight: 17 }}>
            {body}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleFix}
          accessibilityRole="button"
          style={{
            backgroundColor: tokens.status.warningStrong,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            marginLeft: 8,
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontSize: 12, fontWeight: "700" }}>Fix</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Phase 9 - primary OK but background ("All the time") access missing: the
  // rider stays online either way (server intent guarantee), but without this
  // they won't be offered jobs while the app is minimised. Nudge, don't block.
  const backgroundOk = IS_WEB || check.backgroundPermission === "granted";
  if (backgroundOk) return null;

  const handleBackgroundFix = async () => {
    try {
      await Location.requestBackgroundPermissionsAsync();
    } catch (_) {
      try {
        await Linking.openSettings();
      } catch (_) {}
    }
    await recheck();
  };

  return (
    <View
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 14,
        backgroundColor: tokens.status.infoSoft,
        borderWidth: 1,
        borderColor: tokens.status.infoSoftBorder,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Ionicons name="phone-portrait-outline" size={22} color={tokens.brand.default} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginBottom: 2 }}>
          Allow background location
        </Text>
        <Text style={{ fontSize: 12, color: tokens.text.muted, lineHeight: 17 }}>
          {Platform.OS === "android"
            ? "Choose \"Allow all the time\" so you keep receiving jobs when the app is minimised or the screen is off."
            : "Choose \"Always\" so you keep receiving jobs when the app is minimised or the screen is off."}
        </Text>
      </View>
      <TouchableOpacity
        onPress={handleBackgroundFix}
        accessibilityRole="button"
        style={{
          backgroundColor: tokens.brand.default,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          marginLeft: 8,
        }}
      >
        <Text style={{ color: tokens.text.onBrand, fontSize: 12, fontWeight: "700" }}>Enable</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Web (browser / PWA) helpers ───────────────────────────────────────────
// On web we can't use expo-location's native permission/settings flow, so we
// talk to the browser Geolocation API directly. Kept out of the component so
// the tap handler can call getCurrentPosition without any preceding awaits
// (iOS Safari only shows the prompt inside a user gesture).

function getGeolocation() {
  return typeof navigator !== "undefined" && navigator.geolocation ? navigator.geolocation : null;
}

async function recheckWeb(setCheck) {
  const geo = getGeolocation();
  const servicesEnabled = !!geo; // Browser exposes geolocation at all.
  let permission = "undetermined";
  let canAskAgain = true;
  try {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      const res = await navigator.permissions.query({ name: "geolocation" });
      if (res.state === "granted") {
        permission = "granted";
      } else if (res.state === "denied") {
        permission = "denied";
        canAskAgain = false;
      }
      // 'prompt' → leave as undetermined/canAskAgain so the banner offers Fix.
    }
    // iOS Safari has no Permissions API for geolocation: we can't read the
    // state up front, so we stay "undetermined" and let the Fix button prompt.
  } catch (_) {
    // Query unsupported for 'geolocation' (Safari) - leave defaults.
  }
  setCheck({ permission, canAskAgain, servicesEnabled });
}

function handleFixWeb(setCheck, check) {
  const geo = getGeolocation();
  if (!geo) {
    showWebLocationHelp("This browser can't share your location. Try a different browser.");
    return;
  }
  // Already permanently denied → the browser won't re-prompt; guide the rider.
  if (check.permission === "denied") {
    showWebLocationHelp();
    return;
  }
  // Trigger the browser's native permission prompt. This call must stay
  // synchronous within the tap gesture for iOS Safari to show the dialog.
  geo.getCurrentPosition(
    () => {
      setCheck((c) => ({ ...c, permission: "granted", servicesEnabled: true }));
    },
    (err) => {
      if (err && err.code === 1 /* PERMISSION_DENIED */) {
        setCheck((c) => ({ ...c, permission: "denied", canAskAgain: false }));
        showWebLocationHelp();
      }
      // code 2 (POSITION_UNAVAILABLE) / 3 (TIMEOUT): transient - the rider can
      // tap Fix again, so leave the banner state unchanged.
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
  );
}

function showWebLocationHelp(message) {
  const isApple = typeof navigator !== "undefined" && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent || "");
  const body =
    message ||
    (isApple
      ? "Location is blocked for this site. In Safari, tap the \"aA\" (or page settings) button in the address bar → Website Settings → Location → Allow, then reload."
      : "Location is blocked for this site. Tap the lock/location icon in your browser's address bar, set Location to Allow, then reload.");
  showAlert("Turn on location", body, [{ text: "Got it" }]);
}
