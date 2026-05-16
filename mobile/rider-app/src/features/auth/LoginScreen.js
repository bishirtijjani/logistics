/**
 * Phase 0 placeholder.
 * Real implementation lands in Phase 1 (Auth & Rider Registration).
 */
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";

export default function LoginScreen() {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: tokens.bg.canvas,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: tokens.text.primary,
          marginBottom: 8,
        }}
      >
        VTU Rider
      </Text>
      <Text style={{ color: tokens.text.muted, textAlign: "center" }}>
        Phase 0 scaffold. Login lands in Phase 1.
      </Text>
    </View>
  );
}
