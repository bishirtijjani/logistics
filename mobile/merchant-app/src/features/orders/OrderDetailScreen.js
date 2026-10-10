import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { acceptOrder, rejectOrder, updateOrderStatus } from "../../store/slices/ordersSlice";
import { statusDisplay, statusTimeline, statusToneColors, STATUS } from "../../lib/requestStatus";

function Row({ label, value }) {
  const { tokens } = useTheme();
  if (!value) return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}>
      <Text style={{ color: tokens.text.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: tokens.text.primary, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right", marginLeft: 12 }}>
        {value}
      </Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const { requestId } = route.params || {};
  const storeOrder = useSelector((s) => s.orders.orders.find((o) => o.id === requestId));
  const order = storeOrder || route.params?.order || { id: requestId };

  const customer = order.customer || {};
  const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || order.customerName || "Customer";
  const disp = statusDisplay(order.status, order.type, order.categorySlug);
  const tone = statusToneColors(disp.tone, tokens);
  const total = order.total ?? order.subtotal ?? 0;

  const timeline = useMemo(() => statusTimeline(order.type), [order.type]);
  const currentIdx = timeline.indexOf(order.status);

  const act = (fn) => fn();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Ionicons name="chevron-back" size={22} color={tokens.text.primary} />
        <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>{t("common.back", "Back")}</Text>
      </TouchableOpacity>

      <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: tokens.border.default }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: tokens.text.primary }}>₦{Number(total).toLocaleString()}</Text>
          <View style={{ backgroundColor: tone.bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 }}>
            <Text style={{ color: tone.color, fontWeight: "800", fontSize: 12 }}>{disp.label}</Text>
          </View>
        </View>
        {requestId ? <Text style={{ color: tokens.text.placeholder, fontSize: 12 }}>#{String(requestId).slice(0, 12)}</Text> : null}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: "row", marginBottom: 12 }}>
        {order.status === STATUS.REQUESTED && (
          <>
            <TouchableOpacity onPress={() => dispatch(acceptOrder(order.id))} style={{ flex: 1, backgroundColor: tokens.status.success, paddingVertical: 13, borderRadius: 12, alignItems: "center", marginRight: 8 }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>{t("merchant.accept", "Accept")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => dispatch(rejectOrder({ requestId: order.id, reason: "Rejected by merchant" }))} style={{ flex: 1, backgroundColor: tokens.status.errorSoft, paddingVertical: 13, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: tokens.status.errorStrong, fontWeight: "800" }}>{t("merchant.reject", "Reject")}</Text>
            </TouchableOpacity>
          </>
        )}
        {order.status === STATUS.ACCEPTED && (
          <TouchableOpacity onPress={() => dispatch(updateOrderStatus({ requestId: order.id, status: STATUS.PROCESSING }))} style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 13, borderRadius: 12, alignItems: "center" }}>
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>{t("merchant.startPreparing", "Start preparing")}</Text>
          </TouchableOpacity>
        )}
        {order.status === STATUS.PROCESSING && (
          <TouchableOpacity onPress={() => dispatch(updateOrderStatus({ requestId: order.id, status: STATUS.READY_FOR_PICKUP }))} style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 13, borderRadius: 12, alignItems: "center" }}>
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>{t("merchant.markReady", "Mark ready for pickup")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Customer */}
      <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: tokens.border.default }}>
        <Text style={{ fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>{t("merchant.customer", "Customer")}</Text>
        <Row label={t("merchant.name", "Name")} value={customerName} />
        <Row label={t("merchant.phone", "Phone")} value={customer.phone || order.customerPhone} />
        <Row label={t("merchant.pickup", "Pickup")} value={order.pickupAddress} />
        <Row label={t("merchant.dropoff", "Dropoff")} value={order.dropoffAddress} />
      </View>

      {/* Items */}
      {order.items?.length ? (
        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: tokens.border.default }}>
          <Text style={{ fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>{t("merchant.items", "Items")}</Text>
          {order.items.map((it, i) => (
            <View key={it.id || i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
              <Text style={{ color: tokens.text.primary, flex: 1 }}>
                {it.quantity ? `${it.quantity}× ` : ""}
                {it.name || it.product?.name || "Item"}
              </Text>
              {it.price != null ? <Text style={{ color: tokens.text.muted }}>₦{Number(it.price).toLocaleString()}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Timeline */}
      <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: tokens.border.default }}>
        <Text style={{ fontWeight: "800", color: tokens.text.primary, marginBottom: 12 }}>{t("merchant.progress", "Progress")}</Text>
        {timeline.map((s, i) => {
          const reached = currentIdx >= i;
          const label = statusDisplay(s, order.type).label;
          return (
            <View key={s} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: reached ? tokens.brand.default : tokens.border.default, marginRight: 12 }} />
              <Text style={{ color: reached ? tokens.text.primary : tokens.text.placeholder, fontWeight: reached ? "700" : "500" }}>{label}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
