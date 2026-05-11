import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors } from "../../theme";
import { fetchRequests } from "../../store/slices/requestSlice";

const TABS = ["Active", "Completed", "Cancelled"];

const ACTIVE_STATUSES = "REQUESTED,ACCEPTED,PROCESSING,READY_FOR_PICKUP,RIDER_ASSIGNED,RIDER_EN_ROUTE,PICKED_UP,IN_TRANSIT";
const COMPLETED_STATUSES = "DELIVERED,SETTLED";
const CANCELLED_STATUSES = "CANCELLED";

const STATUS_META = {
  REQUESTED:       { label: "Pending",      bg: "#FEF3C7", text: "#D97706" },
  ACCEPTED:        { label: "Accepted",     bg: "#DBEAFE", text: "#2563EB" },
  PROCESSING:      { label: "Preparing",    bg: "#DBEAFE", text: "#2563EB" },
  READY_FOR_PICKUP:{ label: "Ready",        bg: "#E0E7FF", text: "#4F46E5" },
  RIDER_ASSIGNED:  { label: "Rider Assigned",bg:"#FEF9C3", text: "#CA8A04" },
  RIDER_EN_ROUTE:  { label: "On the Way",   bg: "#E0E7FF", text: "#4F46E5" },
  PICKED_UP:       { label: "Picked Up",    bg: "#E0E7FF", text: "#4F46E5" },
  IN_TRANSIT:      { label: "In Transit",   bg: "#E0E7FF", text: "#4F46E5" },
  DELIVERED:       { label: "Delivered",    bg: "#D1FAE5", text: "#059669" },
  SETTLED:         { label: "Completed",    bg: "#D1FAE5", text: "#059669" },
  CANCELLED:       { label: "Cancelled",    bg: "#FEE2E2", text: "#EF4444" },
};

// Static badge for the package (courier) flow.
const PACKAGE_META = {
  icon: "cube-outline",
  bg: colors.delivery?.bg || "#EFF6FF",
  color: colors.delivery?.icon || "#2563EB",
  label: "Package",
};

// Soft 8% tint for category badge background.
const tintBg = (hex) => (/^#[0-9a-fA-F]{6}$/.test(hex || "") ? `${hex}14` : "#F3F4F6");

// Resolve type metadata for a request:
// - PACKAGE → static blue cube
// - MERCHANT_ORDER → derived from request.merchant.category (color/name)
const resolveTypeMeta = (request) => {
  if (request.type === "PACKAGE") return PACKAGE_META;
  const cat = request.merchant?.category;
  return {
    icon: "storefront-outline",
    bg: tintBg(cat?.color),
    color: cat?.color || "#7C3AED",
    label: cat?.name || "Order",
  };
};

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function OrdersScreen({ navigation }) {
  const dispatch = useDispatch();
  const { requests, isLoading, pagination } = useSelector((s) => s.request);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

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

  const renderItem = ({ item }) => {
    const status = STATUS_META[item.status] || { label: item.status, bg: colors.surfaceMuted, text: colors.textMuted };
    const type = resolveTypeMeta(item);
    const isActive = activeTab === 0;
    const canRate = (item.status === "DELIVERED" || item.status === "SETTLED") && !item.rating;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate("RequestTracking", { requestId: item.id })}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 18,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1.5,
          borderColor: isActive ? colors.primary + "30" : colors.border,
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
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                {item.merchant?.name || type.label + " Delivery"}
              </Text>
              <View style={{ backgroundColor: status.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: status.text }}>{status.label}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              #{item.id.slice(-8).toUpperCase()} · {formatDate(item.createdAt)}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
          <View style={{ alignItems: "center", marginRight: 10, paddingTop: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#16A34A" }} />
            <View style={{ width: 1.5, height: 18, backgroundColor: colors.border, marginVertical: 2 }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: "600" }} numberOfLines={1}>
              {item.pickupAddress || "Pickup location"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.text, fontWeight: "600", marginTop: 14 }} numberOfLines={1}>
              {item.dropoffAddress || "Delivery location"}
            </Text>
          </View>
        </View>

        {/* Bottom row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
              {formatNaira(item.total || item.customerPaid)}
            </Text>
            {item.distanceKm > 0 && (
              <Text style={{ fontSize: 11, color: colors.textMuted }}>{item.distanceKm} km</Text>
            )}
          </View>

          {isActive ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("RequestTracking", { requestId: item.id })}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 }}
            >
              <Text style={{ color: colors.white, fontSize: 12, fontWeight: "700" }}>Track</Text>
            </TouchableOpacity>
          ) : canRate ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("RequestTracking", { requestId: item.id })}
              style={{ backgroundColor: "#FFA500", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 }}
            >
              <Text style={{ color: colors.white, fontSize: 12, fontWeight: "700" }}>Rate ★</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate("RequestTracking", { requestId: item.id })}
              style={{ backgroundColor: colors.surfaceMuted, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700" }}>Details</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View
      style={{
        marginTop: 40,
        backgroundColor: colors.surface,
        borderRadius: 22,
        padding: 40,
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          backgroundColor: colors.surfaceMuted,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name="receipt-outline" size={28} color={colors.textMuted} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text, marginBottom: 6 }}>
        No {TABS[activeTab].toLowerCase()} orders
      </Text>
      <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 20 }}>
        {activeTab === 0
          ? "Place an order and track it here in real time."
          : "Your order history will appear here."}
      </Text>
      {activeTab === 0 && (
        <TouchableOpacity
          onPress={() => navigation.navigate("MerchantBrowse")}
          style={{ marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 }}
        >
          <Text style={{ color: colors.white, fontWeight: "800", fontSize: 14 }}>Start an Order</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

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
        <Text style={{ fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -1 }}>
          My Orders
        </Text>
        <View style={{ backgroundColor: colors.dark, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>
            {activeCount} ACTIVE
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 20,
          marginBottom: 24,
          backgroundColor: colors.surfaceMuted,
          borderRadius: 14,
          padding: 4,
        }}
      >
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(i)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 11,
              alignItems: "center",
              backgroundColor: i === activeTab ? colors.dark : "transparent",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: i === activeTab ? colors.white : colors.textMuted }}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        ListFooterComponent={
          isLoading && requests.length > 0 ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
          ) : null
        }
        ListHeaderComponent={
          isLoading && requests.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
