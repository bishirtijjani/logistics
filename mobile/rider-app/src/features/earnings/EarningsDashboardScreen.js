import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { formatNaira } from "../../lib/formatters";
import { fetchRiderEarnings } from "../../store/slices/earningsSlice";
import { fetchWallet } from "../../store/slices/walletSlice";
import { useOnboardingStage } from "../../lib/useOnboardingStage";
import EarningsChart from "./EarningsChart";

const TABS = [
  { key: "today",   labelKey: "earnings.tab.today",   fallback: "Today" },
  { key: "week",    labelKey: "earnings.tab.week",    fallback: "Week" },
  { key: "month",   labelKey: "earnings.tab.month",   fallback: "Month" },
  { key: "allTime", labelKey: "earnings.tab.allTime", fallback: "All time" },
];

export default function EarningsDashboardScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const summary = useSelector((s) => s.earnings?.summary) || {};
  const daily = useSelector((s) => s.earnings?.daily) || [];
  const averageRating = useSelector((s) => s.earnings?.averageRating) || 0;
  const isLoading = useSelector((s) => s.earnings?.isLoading);
  const walletBalance = useSelector((s) => s.wallet?.balance) || 0;
  const { isApproved } = useOnboardingStage();

  const [activeTab, setActiveTab] = useState("today");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchRiderEarnings());
    dispatch(fetchWallet());
  }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchRiderEarnings()).unwrap?.().catch(() => {}),
        dispatch(fetchWallet()).unwrap?.().catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const active = summary[activeTab] || { amount: 0, count: 0 };

  // Not yet an approved rider → there can be no earnings. Show an empty state
  // that points back to Home, where the OnboardingHero drives the next step.
  if (!isApproved) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 26, fontWeight: "800", color: tokens.text.primary,
              letterSpacing: -0.5, marginBottom: 18,
            }}
          >
            {t("earnings.title", "Earnings")}
          </Text>
          <View
            style={{
              flex: 1, alignItems: "center", justifyContent: "center",
              paddingHorizontal: 8, paddingVertical: 40,
            }}
          >
            <View
              style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: tokens.brand.soft,
                alignItems: "center", justifyContent: "center", marginBottom: 18,
              }}
            >
              <Ionicons name="stats-chart-outline" size={32} color={tokens.brand.default} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginBottom: 8, textAlign: "center" }}>
              {t("earnings.onboardEmptyTitle", "No earnings yet")}
            </Text>
            <Text style={{ fontSize: 14, color: tokens.text.muted, textAlign: "center", lineHeight: 20, marginBottom: 22 }}>
              {t(
                "earnings.onboardEmptyBody",
                "Finish setting up your rider profile to start receiving jobs and earning.",
              )}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("MainTabs", { screen: "HomeTab" })}
              accessibilityRole="button"
              style={{
                paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14,
                backgroundColor: tokens.brand.default,
              }}
            >
              <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
                {t("earnings.onboardEmptyCta", "Get started")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 26, fontWeight: "800", color: tokens.text.primary,
            letterSpacing: -0.5, marginBottom: 4,
          }}
        >
          {t("earnings.title", "Earnings")}
        </Text>
        <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 18 }}>
          {t("earnings.subtitle", "Track how you're earning.")}
        </Text>

        {/* Big "today" header */}
        <View
          style={{
            backgroundColor: tokens.brand.default,
            borderRadius: 18,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.onBrand, opacity: 0.85, letterSpacing: 0.5 }}>
            {t("earnings.todayLabel", "TODAY").toUpperCase()}
          </Text>
          <Text
            style={{
              fontSize: 36, fontWeight: "900", color: tokens.text.onBrand,
              letterSpacing: -1, marginTop: 6,
            }}
          >
            {formatNaira(summary?.today?.amount || 0)}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.text.onBrand, opacity: 0.85, marginTop: 4 }}>
            {t("earnings.deliveriesCount", "{{count}} {{noun}}", {
              count: summary?.today?.count || 0,
              noun: (summary?.today?.count || 0) === 1
                ? t("earnings.delivery", "delivery")
                : t("earnings.deliveries", "deliveries"),
            })}
          </Text>
        </View>

        {/* Tabs */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: tokens.bg.surface,
            borderRadius: 12,
            padding: 4,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: tokens.border.default,
          }}
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: 9,
                  backgroundColor: selected ? tokens.brand.default : "transparent",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12, fontWeight: "700",
                    color: selected ? tokens.text.onBrand : tokens.text.muted,
                  }}
                >
                  {t(tab.labelKey, tab.fallback)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active tab stats */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: tokens.bg.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: tokens.border.default,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: tokens.text.muted }}>
              {t("earnings.amountLabel", "Amount")}
            </Text>
            <Text
              style={{
                fontSize: 22, fontWeight: "800", color: tokens.text.primary,
                letterSpacing: -0.5, marginTop: 4,
              }}
            >
              {formatNaira(active.amount || 0)}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: tokens.border.default, marginHorizontal: 14 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: tokens.text.muted }}>
              {t("earnings.countLabel", "Deliveries")}
            </Text>
            <Text
              style={{
                fontSize: 22, fontWeight: "800", color: tokens.text.primary,
                letterSpacing: -0.5, marginTop: 4,
              }}
            >
              {active.count || 0}
            </Text>
          </View>
        </View>

        {/* 7-day chart */}
        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: tokens.border.default,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
              {t("earnings.last7Days", "Last 7 days")}
            </Text>
            {averageRating > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="star" size={14} color={tokens.status.warningStrong} />
                <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: "700", color: tokens.text.primary }}>
                  {averageRating.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
          <EarningsChart
            daily={daily}
            onSelectDay={(date) => navigation.navigate("EarningsBreakdown", { focusDate: date })}
          />
        </View>

        {/* Wallet widget */}
        <TouchableOpacity
          onPress={() => navigation.navigate("MainTabs", { screen: "WalletTab" })}
          accessibilityRole="button"
          accessibilityLabel={t("earnings.openWalletAria", "Open wallet")}
          style={{
            flexDirection: "row", alignItems: "center",
            backgroundColor: tokens.bg.surface,
            borderRadius: 14, padding: 16, marginBottom: 12,
            borderWidth: 1, borderColor: tokens.border.default,
          }}
        >
          <View
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: tokens.brand.soft,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="wallet" size={18} color={tokens.brand.strong} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 12, color: tokens.text.muted }}>
              {t("earnings.walletBalance", "Wallet balance")}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginTop: 2 }}>
              {formatNaira(walletBalance)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={tokens.text.muted} />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Withdraw")}
            accessibilityRole="button"
            accessibilityLabel={t("earnings.withdraw", "Withdraw")}
            style={{
              flex: 1, paddingVertical: 14, borderRadius: 12,
              backgroundColor: tokens.brand.default,
              alignItems: "center", justifyContent: "center", flexDirection: "row",
            }}
          >
            <Ionicons name="arrow-down" size={16} color={tokens.text.onBrand} />
            <Text style={{ marginLeft: 6, color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
              {t("earnings.withdraw", "Withdraw")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("EarningsBreakdown")}
            accessibilityRole="button"
            accessibilityLabel={t("earnings.viewAll", "View all")}
            style={{
              flex: 1, paddingVertical: 14, borderRadius: 12,
              borderWidth: 1, borderColor: tokens.border.default,
              backgroundColor: tokens.bg.surface,
              alignItems: "center", justifyContent: "center", flexDirection: "row",
            }}
          >
            <Ionicons name="list-outline" size={16} color={tokens.text.primary} />
            <Text style={{ marginLeft: 6, color: tokens.text.primary, fontWeight: "800", fontSize: 14 }}>
              {t("earnings.viewAll", "View all")}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && !refreshing ? (
          <View style={{ alignItems: "center", marginTop: 18 }}>
            <ActivityIndicator color={tokens.brand.default} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
