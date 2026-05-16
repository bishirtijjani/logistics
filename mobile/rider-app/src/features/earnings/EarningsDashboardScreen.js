/**
 * Phase 0 placeholder. Real earnings dashboard lands in Phase 6.
 */
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";

export default function EarningsDashboardScreen() {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: tokens.bg.canvas }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: tokens.text.primary, marginBottom: 8 }}>
        Earnings
      </Text>
      <Text style={{ color: tokens.text.muted, textAlign: "center" }}>Lands in Phase 6.</Text>
    </View>
  );
}
