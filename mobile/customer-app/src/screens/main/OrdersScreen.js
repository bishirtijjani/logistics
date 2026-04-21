import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors } from "../../theme";
import { fetchDeliveries } from "../../store/slices/deliverySlice";

const TABS = ["Active", "Completed", "Cancelled"];

const STATUS_COLORS = {
  REQUESTED: { bg: "#FEF3C7", text: "#D97706" },
  MATCHED: { bg: "#DBEAFE", text: "#2563EB" },
  PICKED_UP: { bg: "#E0E7FF", text: "#4F46E5" },
  IN_TRANSIT: { bg: "#E0E7FF", text: "#4F46E5" },
  DELIVERED: { bg: "#D1FAE5", text: "#059669" },
  SETTLED: { bg: "#D1FAE5", text: "#059669" },
  CANCELLED: { bg: "#FEE2E2", text: "#EF4444" },
};

export default function OrdersScreen({ navigation }) {
  const dispatch = useDispatch();
  const { deliveries, isLoading, total } = useSelector((state) => state.delivery);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const statusMap = ["REQUESTED,MATCHED,PICKED_UP,IN_TRANSIT", "DELIVERED,SETTLED", "CANCELLED"];

  const loadDeliveries = useCallback(async (pageNum = 1, refresh = false) => {
    const status = statusMap[activeTab];
    await dispatch(fetchDeliveries({ page: pageNum, limit: 10, status })).unwrap();
    if (refresh) setRefreshing(false);
  }, [dispatch, activeTab]);

  useEffect(() => {
    loadDeliveries(1);
    setPage(1);
  }, [loadDeliveries]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDeliveries(1, true);
  };

  const onEndReached = () => {
    if (deliveries.length < total && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadDeliveries(nextPage);
    }
  };

  const renderDeliveryItem = ({ item }) => {
    const statusColor = STATUS_COLORS[item.status] || { bg: colors.surface, text: colors.text };
    const isActive = activeTab === 0;

    return (
      <TouchableOpacity
        onPress={() => {
          if (isActive) {
            navigation.navigate("TrackDelivery", { orderId: item.id });
          }
        }}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1.5,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: "800", color: colors.text }}>
              #{item.id.slice(-6)}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: statusColor.bg,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor.text }}>
              {item.status.replace("_", " ")}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <View style={{ alignItems: "center", marginRight: 12 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.success,
              }}
            />
            <View
              style={{
                width: 2,
                height: 20,
                backgroundColor: colors.border,
                marginVertical: 2,
              }}
            />
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }} numberOfLines={1}>
              {item.pickupAddress}
            </Text>
            <Text
              style={{ marginTop: 8, fontSize: 13, fontWeight: "600", color: colors.text }}
              numberOfLines={1}
            >
              {item.dropoffAddress}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            ₦{item.fare?.toLocaleString()}
          </Text>
          {isActive ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("TrackDelivery", { orderId: item.id })}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: colors.white, fontSize: 12, fontWeight: "700" }}>Track</Text>
            </TouchableOpacity>
          ) : item.status === "DELIVERED" && !item.rating ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("RateDelivery", { orderId: item.id, riderId: item.riderId })}
              style={{
                backgroundColor: colors.success,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: colors.white, fontSize: 12, fontWeight: "700" }}>Rate ★</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
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
        <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
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
          onPress={() => navigation.navigate("CreateDelivery")}
          style={{
            marginTop: 20,
            backgroundColor: colors.primary,
            paddingHorizontal: 28,
            paddingVertical: 13,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: colors.white, fontWeight: "800", fontSize: 14 }}>
            Start an Order
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const activeCount = deliveries.filter((d) =>
    ["REQUESTED", "MATCHED", "PICKED_UP", "IN_TRANSIT"].includes(d.status)
  ).length;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
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
        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: colors.text,
            letterSpacing: -1,
          }}
        >
          My Orders
        </Text>
        <View
          style={{
            backgroundColor: colors.dark,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.5,
            }}
          >
            ACTIVE: {activeCount}
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
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: i === activeTab ? colors.white : colors.textMuted,
              }}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Delivery List */}
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        renderItem={renderDeliveryItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          isLoading && deliveries.length > 0 ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
