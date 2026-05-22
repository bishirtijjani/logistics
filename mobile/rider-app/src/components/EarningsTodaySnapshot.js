import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useTheme } from "../theme";
import { formatNaira } from "../lib/formatters";

/**
 * Compact earnings strip for the Home tab — three stats sourced from
 * `GET /rider/earnings` (today/week summary) with fallback to lifetime
 * stats from the rider profile while earnings are still loading. No mock
 * data: if the endpoint returns nothing, we show `—`.
 */
export default function EarningsTodaySnapshot({ onSeeAll }) {
  const { tokens } = useTheme();
  const rider = useSelector((s) => s.rider?.rider);
  const summary = useSelector((s) => s.earnings?.summary);
  const isLoading = useSelector((s) => s.earnings?.isLoading);

  const today = summary?.today;
  const lifetimeAmount = Number(rider?.totalEarnings ?? 0);
  const lifetimeCount = Number(rider?.totalDeliveries ?? 0);
  const rating = rider?.averageRating;

  const todayAmountText = today
    ? formatNaira(today.amount)
    : isLoading
      ? "—"
      : formatNaira(0);
  const todayCountText = today ? String(today.count) : isLoading ? "—" : "0";

  return (
    <View
      style={{
        marginTop: 16,
        backgroundColor: tokens.bg.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.border.default,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Ionicons name="stats-chart" size={18} color={tokens.brand.default} />
        <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
          Today
        </Text>
        {isLoading ? (
          <ActivityIndicator color={tokens.text.muted} size="small" style={{ marginLeft: 8 }} />
        ) : null}
        <View style={{ flex: 1 }} />
        {onSeeAll ? (
          <TouchableOpacity onPress={onSeeAll} accessibilityRole="link">
            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.brand.default }}>
              See all
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ flexDirection: "row" }}>
        <Stat label="Earned today" value={todayAmountText} tokens={tokens} />
        <Stat label="Deliveries today" value={todayCountText} tokens={tokens} />
        <Stat
          label="Rating"
          value={typeof rating === "number" && rating > 0 ? rating.toFixed(1) : "—"}
          tokens={tokens}
          last
        />
      </View>

      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: tokens.border.subtle,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 12, color: tokens.text.muted }}>
          Lifetime: {formatNaira(lifetimeAmount)}
        </Text>
        <Text style={{ fontSize: 12, color: tokens.text.muted }}>
          {lifetimeCount} deliver{lifetimeCount === 1 ? "y" : "ies"}
        </Text>
      </View>
    </View>
  );
}

function Stat({ label, value, tokens, last }) {
  return (
    <View
      style={{
        flex: 1,
        borderRightWidth: last ? 0 : 1,
        borderRightColor: tokens.border.subtle,
        paddingHorizontal: 8,
      }}
    >
      <Text style={{ fontSize: 11, color: tokens.text.muted, marginBottom: 4 }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: tokens.text.primary,
          letterSpacing: -0.3,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
