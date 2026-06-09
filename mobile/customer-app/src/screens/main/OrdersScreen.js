import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { fetchRequests } from "../../store/slices/requestSlice";
import { ACTIVE_STATUSES as ACTIVE_LIST, COMPLETED_STATUSES as COMPLETED_LIST, statusDisplay, statusToneColors } from "../../lib/requestStatus";
import SkeletonLoader from "../../components/SkeletonLoader";
import EmptyState from "../../components/EmptyState";

const TAB_KEYS = ["tabActive", "tabCompleted", "tabCancelled"];

const ACTIVE_STATUSES = ACTIVE_LIST.join(",");
const COMPLETED_STATUSES = COMPLETED_LIST.join(",");
const CANCELLED_STATUSES = "CANCELLED";

// Soft 8% tint for category badge background. `fallbackBg` is a themed token so
// rows without a category color stay readable in both modes.
const tintBg = (hex, fallbackBg) => (/^#[0-9a-fA-F]{6}$/.test(hex || "") ? `${hex}14` : fallbackBg);

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

export default function OrdersScreen({ navigation }) {
  const dispatch = useDispatch();
  const { tokens, isDark } = useTheme();
  const { t, i18n } = useTranslation();

  // Static badge for the package (courier) flow. `labelKey` resolves via t() at
  // render time so a locale change retags every row without a re-fetch.
  const PACKAGE_META = {
    icon: "cube-outline",
    bg: tokens.category.package.bg,
    color: tokens.category.package.icon,
    labelKey: "home.package",
  };

  // Resolve type metadata for a request:
  // - PACKAGE → static blue cube (label resolved via t)
  // - MERCHANT_ORDER → derived from request.merchant.category (color/name)
  const resolveTypeMeta = (request) => {
    if (request.type === "PACKAGE") return { ...PACKAGE_META, label: t(PACKAGE_META.labelKey) };
    const cat = request.merchant?.category;
    return {
      icon: "storefront-outline",
      bg: tintBg(cat?.color, tokens.bg.surfaceMuted),
      color: cat?.color || tokens.category.groceries.icon,
      label: cat?.name || t("home.active.orderFallback"),
    };
  };
  const { requests, isLoading, pagination } = useSelector((s) => s.request);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  // Locale-aware date formatter - memoized on language so the Intl runtime
  // is touched once per locale change, not once per row.
  const formatDate = useMemo(() => {
    const tag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    return (d) => new Date(d).toLocaleDateString(tag, {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }, [i18n.language]);

  const statusFilter = [ACTIVE_STATUSES, COMPLETED_STATUSES, CANCELLED_STATUSES][activeTab];

  const load = useCallback(async (pageNum = 1, isRefresh = false) => {
    await dispatch(fetchRequests({ status: statusFilter, page: pageNum, limit: 10 }));
    if (isRefresh) setRefreshing(false);
  }, [dispatch, statusFilter]);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(1, true);
  };

  const onEndReached = () => {
    if (requests.length < pagination.total && !isLoading) {
      const next = page + 1;
      setPage(next);
      load(next);
    }
  };

  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    if (activeTab === 0) setActiveCount(requests.length);
  }, [activeTab, requests.length]);

  // Phase 4 - surface the three states that matter most at-a-glance.
  // These supplement (not replace) the existing status pill.
  const resolveLifecycleBadge = (req) => {
    if (req.status === "REQUESTED" || req.status === "READY_FOR_PICKUP") {
      return { label: t("orders.lifecycle.searching"), bg: tokens.brand.soft, color: tokens.brand.strong, icon: "search" };
    }
    if (
      req.status === "PICKED_UP" ||
      req.status === "IN_TRANSIT" ||
      req.status === "RIDER_EN_ROUTE"
    ) {
      return { label: t("orders.lifecycle.inTransit"), bg: tokens.status.successSoft, color: tokens.status.successStrong, icon: "bicycle" };
    }
    if ((req.status === "DELIVERED" || req.status === "SETTLED") && !req.rating) {
      return { label: t("orders.lifecycle.awaitingRating"), bg: tokens.status.warningSoft, color: tokens.status.warningStrong, icon: "star-outline" };
    }
    return null;
  };

  const renderItem = ({ item }) => {
    // Phase 8 - pass category slug so pharmacy/grocery rows render
    // type-specific status copy ("Pharmacist preparing…", "Picking your groceries").
    const pill = statusDisplay(item.status, item.type, item.merchant?.category?.slug);
    const pillColors = statusToneColors(pill.tone, tokens);
    const status = { label: pill.label, bg: pillColors.bg, text: pillColors.color };
    const type = resolveTypeMeta(item);
    const isActive = activeTab === 0;
    const canRate = (item.status === "DELIVERED" || item.status === "SETTLED") && !item.rating;
    const lifecycle = resolveLifecycleBadge(item);
    const title = item.merchant?.name || type.label;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate("RequestTracking", { requestId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${status.label}. ${formatNaira(item.total || item.customerPaid)}`}
        style={{
          backgroundColor: tokens.bg.surface,
          borderRadius: 18,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1.5,
          borderColor: isActive ? tokens.brand.default + "30" : tokens.border.default,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* Top row */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: type.bg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name={type.icon} size={20} color={type.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.text.primary }}>
                {title}
              </Text>
              <View style={{ backgroundColor: status.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: status.text }}>{status.label}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>
              {t("orders.orderId")}{item.id.slice(-8).toUpperCase()} · {formatDate(item.createdAt)}
            </Text>
            {lifecycle && (
              <View style={{ flexDirection: "row", alignSelf: "flex-start", alignItems: "center", marginTop: 8, backgroundColor: lifecycle.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <Ionicons name={lifecycle.icon} size={11} color={lifecycle.color} />
                <Text style={{ marginLeft: 4, fontSize: 11, fontWeight: "700", color: lifecycle.color }}>
                  {lifecycle.label}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Route */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
          <View style={{ alignItems: "center", marginRight: 10, paddingTop: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.status.success }} />
            <View style={{ width: 1.5, height: 18, backgroundColor: tokens.border.default, marginVertical: 2 }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.brand.default }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: tokens.text.muted, fontWeight: "600" }} numberOfLines={1}>
              {item.pickupAddress || "Pickup location"}
            </Text>
            <Text style={{ fontSize: 12, color: tokens.text.primary, fontWeight: "600", marginTop: 14 }} numberOfLines={1}>
              {item.dropoffAddress || "Delivery location"}
            </Text>
          </View>
        </View>

        {/* Bottom row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "900", color: tokens.text.primary }}>
              {formatNaira(item.total || item.customerPaid)}
            </Text>
            {item.distanceKm > 0 && (
              <Text style={{ fontSize: 11, color: tokens.text.muted }}>{item.distanceKm} km</Text>
            )}
          </View>

          {isActive ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("RequestTracking", { requestId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={t("orders.track")}
              style={{ backgroundColor: tokens.brand.default, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 }}
            >
              <Text style={{ color: tokens.text.onBrand, fontSize: 12, fontWeight: "700" }}>{t("orders.track")}</Text>
            </TouchableOpacity>
          ) : canRate ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("RequestTracking", { requestId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={t("orders.rate")}
              style={{ backgroundColor: tokens.status.warning, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 }}
            >
              <Text style={{ color: tokens.text.onBrand, fontSize: 12, fontWeight: "700" }}>{t("orders.rate")}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {(item.status === "DELIVERED" || item.status === "SETTLED" || item.status === "CANCELLED") && (
                <TouchableOpacity
                  onPress={() => navigation.navigate("CreateDispute", { requestId: item.id })}
                  accessibilityRole="button"
                  accessibilityLabel={t("support.reportIssue")}
                  style={{
                    borderWidth: 1,
                    borderColor: tokens.border.default,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 10,
                  }}
                >
                  <Ionicons name="flag-outline" size={14} color={tokens.text.muted} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => navigation.navigate("RequestTracking", { requestId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={t("orders.details")}
                style={{ backgroundColor: tokens.bg.surfaceMuted, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 }}
              >
                <Text style={{ color: tokens.text.muted, fontSize: 12, fontWeight: "700" }}>{t("orders.details")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    const titleKey = ["orders.noActive", "orders.noCompleted", "orders.noCancelled"][activeTab];
    const hintKey = ["orders.noActiveHint", "orders.noCompletedHint", "orders.noCancelledHint"][activeTab];
    return (
      <EmptyState
        icon="receipt-outline"
        title={t(titleKey)}
        subtitle={t(hintKey)}
        ctaLabel={activeTab === 0 ? t("orders.startOrder") : undefined}
        onCta={activeTab === 0 ? () => navigation.navigate("MerchantBrowse") : undefined}
        fill={false}
      />
    );
  };

  const renderLoadingSkeleton = () => (
    <View style={{ paddingTop: 8 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonLoader.OrderRow key={i} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 22,
          paddingBottom: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "900", color: tokens.text.primary, letterSpacing: -1 }}>
          {t("orders.title")}
        </Text>
        <View style={{ backgroundColor: tokens.bg.elevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
          <Text style={{ color: tokens.brand.default, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>
            {t("orders.activeCount", { count: activeCount })}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 20,
          marginBottom: 24,
          backgroundColor: tokens.bg.surfaceMuted,
          borderRadius: 14,
          padding: 4,
        }}
        accessibilityRole="tablist"
      >
        {TAB_KEYS.map((tabKey, i) => {
          const label = t(`orders.${tabKey}`);
          const selected = i === activeTab;
          return (
            <TouchableOpacity
              key={tabKey}
              onPress={() => setActiveTab(i)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 11,
                alignItems: "center",
                backgroundColor: selected ? tokens.bg.elevated : "transparent",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: selected ? tokens.text.onElevated : tokens.text.muted }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        ListFooterComponent={
          isLoading && requests.length > 0 ? (
            // Shows a single skeleton row as the "load more" indicator,
            // matching the shape of an actual row so the list doesn't jump.
            <SkeletonLoader.OrderRow />
          ) : null
        }
        ListHeaderComponent={
          isLoading && requests.length === 0 ? renderLoadingSkeleton() : null
        }
      />
    </SafeAreaView>
  );
}
