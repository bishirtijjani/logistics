import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, AppState, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as IntentLauncher from "expo-intent-launcher";
import { useTheme } from "../theme";

/**
 * Warns the rider when device location services are off OR app permission is
 * not granted. Auto-rechecks on every AppState `active` event so a trip to
 * Settings → return is reflected immediately.
 *
 * Renders nothing when everything is fine.
 */
export default function LocationServicesEnabledBanner() {
  const { tokens } = useTheme();
  const [check, setCheck] = useState({ permission: "granted", canAskAgain: true, servicesEnabled: true });

  const recheck = async () => {
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      setCheck({ permission: status, canAskAgain, servicesEnabled });
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
  if (permissionOk && servicesOk) return null;

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
