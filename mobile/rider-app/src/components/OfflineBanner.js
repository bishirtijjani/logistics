/**
 * OfflineBanner - global "You're offline" strip rendered above the
 * NavigationContainer when connectivity is down.
 *
 * Source of truth is `services/connectivity.js`, which fuses socket
 * disconnects and API network errors into a single boolean. The banner
 * unmounts the moment connectivity returns, so there's no visual lag.
 *
 * Token-based styling - works correctly in light + dark mode.
 */

import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme";
import { useConnectivity } from "../services/connectivity";

export default function OfflineBanner() {
  const online = useConnectivity();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  if (online) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: tokens.status.warningSoft,
        borderBottomWidth: 1,
        borderBottomColor: tokens.status.warningStrong,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={14} color={tokens.status.warningStrong} />
      <Text
        numberOfLines={1}
        style={{ fontSize: 12, fontWeight: "700", color: tokens.status.warningStrong }}
      >
        {t("offline.banner", "You're offline. Actions will retry when you reconnect.")}
      </Text>
    </View>
  );
}
