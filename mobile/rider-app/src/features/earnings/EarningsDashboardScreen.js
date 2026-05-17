import React, { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { formatNaira } from "../../lib/formatters";
import { fetchRiderEarnings } from "../../store/slices/earningsSlice";

/**
 * Earnings tab — Phase 2 ships a polished read-only lifetime summary so the
 * tab isn't a stub. Daily breakdown + chart + per-delivery rows land in Phase 6.
 */
export default function EarningsDashboardScreen() {
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const rider = useSelector((s) => s.rider?.rider);
  const summary = useSelector((s) => s.earnings?.summary);

  useEffect(() => {
    dispatch(fetchRiderEarnings());
  }, [dispatch]);

  const lifetimeAmount = Number(summary?.allTime?.amount ?? rider?.totalEarnings ?? 0);
  const lifetimeCount = Number(summary?.allTime?.count ?? rider?.totalDeliveries ?? 0);
  const rating = rider?.averageRating;

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
          Earnings
        </Text>

        <Card tokens={tokens} label="Lifetime earnings" value={formatNaira(lifetimeAmount)} />
        <Card
          tokens={tokens}
          label="Deliveries completed"
          value={String(lifetimeCount)}
          icon="checkmark-done"
        />
        <Card
          tokens={tokens}
          label="Average rating"
          value={typeof rating === "number" && rating > 0 ? rating.toFixed(1) : "—"}
          icon="star"
        />

        <View
          style={{
            marginTop: 20,
            backgroundColor: tokens.bg.surface,
            borderWidth: 1,
            borderColor: tokens.border.default,
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
          }}
        >
          <Ionicons name="stats-chart-outline" size={32} color={tokens.brand.default} />
          <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary, marginTop: 10 }}>
            Daily breakdown coming soon
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: tokens.text.muted,
              marginTop: 4,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            Today, this week, this month — and per-delivery details — are on the way.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ tokens, label, value, icon = "cash-outline" }) {
  return (
    <View
      style={{
        backgroundColor: tokens.bg.surface,
        borderWidth: 1,
        borderColor: tokens.border.default,
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: tokens.brand.soft,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={18} color={tokens.brand.default} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: tokens.text.muted, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: tokens.text.primary, letterSpacing: -0.5 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
