/**
 * Phase 0 placeholder. Real availability toggle + earnings snapshot lands in Phase 2.
 */
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";

export default function HomeTabScreen() {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: tokens.bg.canvas }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: tokens.text.primary, marginBottom: 8 }}>
        Home
      </Text>
      <Text style={{ color: tokens.text.muted, textAlign: "center" }}>
        Availability toggle lands in Phase 2.
      </Text>
    </View>
  );
}
