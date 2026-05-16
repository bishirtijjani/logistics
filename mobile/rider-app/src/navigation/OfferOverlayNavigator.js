import React from "react";
import { View, Text } from "react-native";
import { useSelector } from "react-redux";
import { useTheme } from "../theme";

/**
 * Phase 0 placeholder. Full-screen offer sheet lives here in Phase 3.
 * Mounted at the navigator root so an incoming offer can supersede any other
 * screen. Renders nothing while `offers.activeOfferId` is null.
 */
export default function OfferOverlayNavigator() {
  const activeOfferId = useSelector((s) => s.offers?.activeOfferId);
  const { tokens } = useTheme();

  if (!activeOfferId) return null;

  return (
    <View
      pointerEvents="auto"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: tokens.overlay.scrim,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          backgroundColor: tokens.bg.surface,
          padding: 24,
          borderRadius: 16,
          minWidth: 280,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700", color: tokens.text.primary }}>
          Offer
        </Text>
        <Text style={{ color: tokens.text.muted, marginTop: 8 }}>
          Job offer UI lands in Phase 3.
        </Text>
      </View>
    </View>
  );
}
