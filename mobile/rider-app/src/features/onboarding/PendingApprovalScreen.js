/**
 * Phase 0 placeholder. Real polling loop + push-on-approval lands in Phase 1.
 */
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";

export default function PendingApprovalScreen() {
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
        Awaiting approval
      </Text>
      <Text style={{ color: tokens.text.muted, textAlign: "center" }}>
        Your rider application is under review.
      </Text>
    </View>
  );
}
