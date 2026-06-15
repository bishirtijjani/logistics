import React, { useCallback, useEffect, useMemo, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { formatNaira } from "../../lib/formatters";
import { fetchRiderEarnings, fetchMoreEarnings } from "../../store/slices/earningsSlice";

/**
 * Per-day sectioned list of rider earnings. Groups recent earning rows by
 * settledAt date; tap a row → request detail modal (passes requestId to
 * the TripCockpit deep-link or admin-style detail screen).
 *
 * Infinite-scrolls via `fetchMoreEarnings`. Pull-to-refresh resets.
 */

function ymdLocal(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(iso, t) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return t("earnings.today", "Today");
  if (day.getTime() === yesterday.getTime()) return t("earnings.yesterday", "Yesterday");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function prettyTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function EarningsBreakdownScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const focusDate = route.params?.focusDate || null;

  const byId = useSelector((s) => s.earnings?.byId) || {};
  const allIds = useSelector((s) => s.earnings?.allIds) || [];
  const page = useSelector((s) => s.earnings?.page) || 1;
  const hasMore = useSelector((s) => s.earnings?.hasMore);
  const isLoading = useSelector((s) => s.earnings?.isLoading);
  const isLoadingMore = useSelector((s) => s.earnings?.isLoadingMore);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (allIds.length === 0) dispatch(fetchRiderEarnings());
  }, [dispatch, allIds.length]);

  const sections = useMemo(() => {
    const groups = new Map();
    for (const id of allIds) {
      const row = byId[id];
      if (!row) continue;
      const key = ymdLocal(row.settledAt || row.deliveredAt || row.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return Array.from(groups.entries()).map(([key, data]) => ({
      key,
      title: key,
      data,
      total: data.reduce((acc, r) => acc + Number(r.amount || 0), 0),
      count: data.length,
    }));
  }, [allIds, byId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchRiderEarnings()).unwrap?.().catch(() => {});
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const onEndReached = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    dispatch(fetchMoreEarnings({ page: page + 1 }));
  }, [hasMore, isLoadingMore, page, dispatch]);

  const renderItem = ({ item }) => {
    const isFocusDay = focusDate && ymdLocal(item.settledAt) === focusDate;
    // Tapping a row opens the underlying RIDER_EARNING transaction receipt
    // (rather than the live cockpit, which is for active trips only). The
    // transaction id IS the synthetic earning row's id from the server.
    const onPress = () => {
      if (item.id) {
        navigation.navigate("TransactionDetail", {
          transactionId: item.id,
          fallback: {
            id: item.id,
            reference: item.reference || null,
            type: "RIDER_EARNING",
            amount: item.amount,
            description: item.description,
            createdAt: item.settledAt,
            status: "COMPLETED",
            metadata: { requestId: item.requestId || null },
          },
        });
      }
    };
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={!item.id}
        accessibilityRole="button"
        accessibilityLabel={t("earnings.rowAria", "{{amount}} earned, {{customer}}", {
          amount: formatNaira(item.amount),
          customer: item.customerName || t("earnings.unknownCustomer", "delivery"),
        })}
        style={{
          backgroundColor: tokens.bg.surface,
          paddingHorizontal: 14, paddingVertical: 12,
          borderTopWidth: 1, borderTopColor: tokens.border.subtle,
          flexDirection: "row", alignItems: "center",
          opacity: isFocusDay ? 1 : 0.97,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
            {item.customerName || t("earnings.unknownCustomer", "Delivery")}
          </Text>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }} numberOfLines={1}>
            {prettyTime(item.settledAt)}
            {item.distanceKm != null ? ` · ${Number(item.distanceKm).toFixed(1)} km` : ""}
            {item.durationMin != null ? ` · ${item.durationMin} min` : ""}
          </Text>
          {item.dropoffAddress ? (
            <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }} numberOfLines={1}>
              {item.dropoffAddress}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: tokens.status.successStrong, letterSpacing: -0.3 }}>
            +{formatNaira(item.amount)}
          </Text>
          {item.requestId ? (
            <Ionicons name="chevron-forward" size={16} color={tokens.text.muted} style={{ marginTop: 2 }} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }) => {
    const isFocus = section.key === focusDate;
    return (
      <View
        style={{
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 10,
          backgroundColor: isFocus ? tokens.brand.soft : tokens.bg.canvas,
          borderBottomWidth: isFocus ? 1 : 0,
          borderBottomColor: tokens.brand.softBorder,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary }}>
          {prettyDate(section.title, t)}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted }}>
          {formatNaira(section.total)} · {section.count} {section.count === 1 ? t("earnings.delivery", "delivery") : t("earnings.deliveries", "deliveries")}
        </Text>
      </View>
    );
  };

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
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("earnings.breakdownTitle", "Earnings history")}
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator color={tokens.brand.default} />
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="cash-outline" size={40} color={tokens.text.muted} />
              <Text style={{ marginTop: 12, fontSize: 14, color: tokens.text.muted, textAlign: "center" }}>
                {t("earnings.emptyTitle", "No deliveries yet")}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 12, color: tokens.text.placeholder, textAlign: "center", paddingHorizontal: 28 }}>
                {t("earnings.emptySub", "Go online to start receiving offers.")}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <ActivityIndicator color={tokens.brand.default} size="small" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
