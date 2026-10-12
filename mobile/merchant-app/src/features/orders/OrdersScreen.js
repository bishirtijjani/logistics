import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { fetchOrders, acceptOrder, rejectOrder, updateOrderStatus, setStatusFilter } from "../../store/slices/ordersSlice";
import { statusDisplay, statusToneColors, STATUS } from "../../lib/requestStatus";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import ScreenHeader from "../../components/ScreenHeader";

const FILTERS = [
  { key: null, label: "All" },
  { key: STATUS.REQUESTED, label: "New" },
  { key: STATUS.ACCEPTED, label: "Accepted" },
  { key: STATUS.PROCESSING, label: "Preparing" },
  { key: STATUS.READY_FOR_PICKUP, label: "Ready" },
  { key: STATUS.IN_TRANSIT, label: "In transit" },
  { key: STATUS.DELIVERED, label: "Delivered" },
  { key: STATUS.CANCELLED, label: "Cancelled" },
];

function StatusPill({ status }) {
  const { tokens } = useTheme();
  const disp = statusDisplay(status);
  const { color, bg } = statusToneColors(disp.tone, tokens);
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ color, fontSize: 11, fontWeight: "800" }}>{disp.label}</Text>
    </View>
  );
}

function OrderCard({ order, onOpen, onAction, busy }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const total = order.total ?? order.subtotal ?? 0;
  const customer = order.customer || {};
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || order.customerName || "Customer";
  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.85}
      style={{
        backgroundColor: tokens.bg.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: tokens.border.default,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontWeight: "800", color: tokens.text.primary, fontSize: 15 }}>
          ₦{Number(total).toLocaleString()}
        </Text>
        <StatusPill status={order.status} />
      </View>
      <Text style={{ color: tokens.text.muted, fontSize: 13, marginBottom: 2 }}>{name}</Text>
      <Text style={{ color: tokens.text.placeholder, fontSize: 12 }}>
        {order.items?.length ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}` : order.type || "Order"}
        {order.id ? ` · #${String(order.id).slice(0, 8)}` : ""}
      </Text>

      <View style={{ flexDirection: "row", marginTop: 12 }}>
        {order.status === STATUS.REQUESTED ? (
          <>
            <TouchableOpacity
              disabled={busy}
              onPress={() => onAction("accept", order)}
              style={{ flex: 1, backgroundColor: tokens.status.success, paddingVertical: 11, borderRadius: 12, alignItems: "center", marginRight: 8 }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>{t("merchant.accept", "Accept")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy}
              onPress={() => onAction("reject", order)}
              style={{ flex: 1, backgroundColor: tokens.status.errorSoft, paddingVertical: 11, borderRadius: 12, alignItems: "center" }}
            >
              <Text style={{ color: tokens.status.errorStrong, fontWeight: "800" }}>{t("merchant.reject", "Reject")}</Text>
            </TouchableOpacity>
          </>
        ) : order.status === STATUS.ACCEPTED ? (
          <TouchableOpacity
            disabled={busy}
            onPress={() => onAction("processing", order)}
            style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 11, borderRadius: 12, alignItems: "center" }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>{t("merchant.startPreparing", "Start preparing")}</Text>
          </TouchableOpacity>
        ) : order.status === STATUS.PROCESSING ? (
          <TouchableOpacity
            disabled={busy}
            onPress={() => onAction("ready", order)}
            style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 11, borderRadius: 12, alignItems: "center" }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>{t("merchant.markReady", "Mark ready for pickup")}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onOpen}
            style={{ flex: 1, backgroundColor: tokens.bg.surfaceMuted, paddingVertical: 11, borderRadius: 12, alignItems: "center" }}
          >
            <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>{t("merchant.viewDetails", "View details")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { orders, isLoading, error, statusFilter } = useSelector((s) => s.orders);

  const load = useCallback(() => {
    dispatch(fetchOrders({ page: 1, status: statusFilter || undefined }));
  }, [dispatch, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onAction = (action, order) => {
    if (action === "accept") dispatch(acceptOrder(order.id));
    else if (action === "reject") dispatch(rejectOrder({ requestId: order.id, reason: "Rejected by merchant" }));
    else if (action === "processing") dispatch(updateOrderStatus({ requestId: order.id, status: STATUS.PROCESSING }));
    else if (action === "ready") dispatch(updateOrderStatus({ requestId: order.id, status: STATUS.READY_FOR_PICKUP }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <ScreenHeader title={t("merchant.ordersTitle", "Orders")} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.label}
          renderItem={({ item }) => {
            const active = (statusFilter || null) === item.key;
            return (
              <TouchableOpacity
                onPress={() => dispatch(setStatusFilter(item.key))}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  marginRight: 8,
                  backgroundColor: active ? tokens.brand.default : tokens.bg.surface,
                  borderWidth: 1,
                  borderColor: active ? tokens.brand.default : tokens.border.default,
                }}
              >
                <Text style={{ color: active ? tokens.text.onBrand : tokens.text.muted, fontWeight: "700", fontSize: 13 }}>
                  {t(`merchant.filter_${item.label}`, item.label)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {isLoading && orders.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={tokens.brand.default} />
        </View>
      ) : error && orders.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={tokens.brand.default} />}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onOpen={() => navigation.navigate("OrderDetail", { requestId: item.id, order: item })}
              onAction={onAction}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={t("merchant.noOrders", "No orders yet")}
              subtitle={t("merchant.noOrdersSub", "New orders will appear here in real time.")}
            />
          }
        />
      )}
    </View>
  );
}
