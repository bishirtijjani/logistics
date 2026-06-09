/**
 * PerformanceScreen - trailing-30-day rider performance dashboard.
 *
 * Metrics fetched from `/rider/performance`:
 *   - acceptanceRate, cancellationRate, onTimeRate (percentages)
 *   - rating: { average, count, breakdown: { 5..1 } }
 *   - currentStreakDays
 *   - totalDeliveries (all-time)
 *
 * Rates can be null on a fresh account; we render an em-dash and "Not
 * enough data yet" subtitle in that case so the rider isn't shamed by
 * 0% acceptance during their first week.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { fetchPerformance } from "../../store/slices/profileSlice";

function formatPct(value) {
  if (value == null || Number.isNaN(value)) return "-";
  // Backend already returns one decimal (e.g. 92.3); round-trip to keep it tidy.
  return `${Math.round(value * 10) / 10}%`;
}

function ratingStars(avg, tokens) {
  // Render five stars; fill based on average (round-half).
  const filled = Math.round((avg || 0) * 2) / 2;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={
            filled >= n
              ? "star"
              : filled + 0.5 >= n
                ? "star-half"
                : "star-outline"
          }
          size={16}
          color={tokens.status.warning}
        />
      ))}
    </View>
  );
}

export default function PerformanceScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const perf = useSelector((s) => s.profile?.performance);
  const loading = useSelector((s) => s.profile?.performanceLoading);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchPerformance()).unwrap?.().catch(() => {});
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (!perf) load();
  }, [perf, load]);

  if (!perf && loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.brand.default} />
        </View>
      </SafeAreaView>
    );
  }

  const cards = [
    {
      icon: "checkmark-circle-outline",
      label: t("performance.acceptance", "Acceptance"),
      value: formatPct(perf?.acceptanceRate),
      meta:
        perf?.counts?.offersAccepted != null
          ? t("performance.acceptanceMeta", "{{n}} offers in 30 days", {
              n: (perf?.counts?.offersAccepted || 0) + (perf?.counts?.offersDeclined || 0) + (perf?.counts?.offersExpired || 0),
            })
          : null,
    },
    {
      icon: "close-circle-outline",
      label: t("performance.cancellation", "Cancellations"),
      value: formatPct(perf?.cancellationRate),
      meta:
        perf?.counts?.jobsClaimed != null
          ? t("performance.cancellationMeta", "{{n}} of {{total}} jobs", {
              n: perf?.counts?.jobsCancelledByRider || 0,
              total: perf?.counts?.jobsClaimed || 0,
            })
          : null,
    },
    {
      icon: "time-outline",
      label: t("performance.onTime", "On-time"),
      value: formatPct(perf?.onTimeRate),
      meta:
        perf?.counts?.deliveriesInWindow != null
          ? t("performance.onTimeMeta", "{{n}} deliveries in 30 days", { n: perf?.counts?.deliveriesInWindow || 0 })
          : null,
    },
    {
      icon: "flame-outline",
      label: t("performance.streak", "Current streak"),
      value: `${perf?.currentStreakDays ?? 0}`,
      meta: t("performance.streakMeta", "consecutive days"),
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("performance.title", "Performance")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={tokens.brand.default} />
        }
      >
        {/* Rating panel */}
        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderRadius: 16, padding: 18, marginBottom: 18,
            borderWidth: 1, borderColor: tokens.border.default,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: tokens.text.muted, fontWeight: "700" }}>
                {t("performance.ratingTitle", "Customer rating")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
                <Text style={{ fontSize: 32, fontWeight: "900", color: tokens.text.primary, letterSpacing: -0.5 }}>
                  {(perf?.rating?.average ?? 0).toFixed(1)}
                </Text>
                <Text style={{ fontSize: 13, color: tokens.text.muted, marginLeft: 6 }}>
                  / 5.0
                </Text>
              </View>
              <View style={{ marginTop: 6 }}>
                {ratingStars(perf?.rating?.average || 0, tokens)}
              </View>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 6 }}>
                {t("performance.ratingMeta", "{{n}} ratings · {{total}} deliveries", {
                  n: perf?.rating?.count || 0,
                  total: perf?.totalDeliveries || 0,
                })}
              </Text>
            </View>
          </View>

          {/* Breakdown bars */}
          <View style={{ marginTop: 16, gap: 6 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = perf?.rating?.breakdown?.[star] || 0;
              const total = perf?.rating?.count || 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <View key={star} style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ width: 22, fontSize: 12, color: tokens.text.primary, fontWeight: "700" }}>{star}</Text>
                  <Ionicons name="star" size={12} color={tokens.status.warning} />
                  <View style={{
                    flex: 1, height: 8, borderRadius: 4,
                    backgroundColor: tokens.bg.surfaceMuted, marginHorizontal: 8, overflow: "hidden",
                  }}>
                    <View style={{
                      width: `${pct}%`, height: "100%",
                      backgroundColor: tokens.status.warning,
                    }} />
                  </View>
                  <Text style={{ width: 36, textAlign: "right", fontSize: 11, color: tokens.text.muted }}>
                    {count}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Metric cards */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {cards.map((card) => (
            <View
              key={card.label}
              style={{
                width: "48%",
                backgroundColor: tokens.bg.surface,
                borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: tokens.border.default,
              }}
            >
              <Ionicons name={card.icon} size={18} color={tokens.brand.default} />
              <Text style={{ marginTop: 8, fontSize: 12, color: tokens.text.muted, fontWeight: "700" }}>
                {card.label}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 22, fontWeight: "900", color: tokens.text.primary, letterSpacing: -0.4 }}>
                {card.value}
              </Text>
              {card.meta ? (
                <Text style={{ marginTop: 2, fontSize: 11, color: tokens.text.muted }}>
                  {card.meta}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 20, textAlign: "center" }}>
          {t("performance.window", "Trailing 30 days. Updated in real time.")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
