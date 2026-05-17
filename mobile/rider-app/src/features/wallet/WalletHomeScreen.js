import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { formatNaira } from "../../lib/formatters";

/**
 * Wallet tab — real wallet UI (NUBAN banner, transactions, Withdraw flow)
 * lands in Phase 6. Phase 2 ships a polished read-only summary so the tab
 * doesn't look broken when the rider taps it.
 */
export default function WalletHomeScreen() {
  const { tokens } = useTheme();
  const rider = useSelector((s) => s.rider?.rider);
  const lifetimeEarnings = Number(rider?.totalEarnings ?? 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: tokens.text.primary,
            marginBottom: 18,
            letterSpacing: -0.5,
          }}
        >
          Wallet
        </Text>

        <View
          style={{
            backgroundColor: tokens.bg.elevated,
            borderRadius: 18,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 12, color: tokens.text.onElevated, opacity: 0.7, marginBottom: 6 }}>
            Lifetime earnings
          </Text>
          <Text
            style={{
              fontSize: 30,
              fontWeight: "900",
              color: tokens.text.onElevated,
              letterSpacing: -1,
            }}
          >
            {formatNaira(lifetimeEarnings)}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderWidth: 1,
            borderColor: tokens.border.default,
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: tokens.brand.soft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons name="wallet-outline" size={26} color={tokens.brand.default} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary, marginBottom: 6 }}>
            Withdrawals coming soon
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: tokens.text.muted,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            Your earnings accrue here on every settled delivery. Bank withdrawals open up shortly.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
