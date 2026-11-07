import React, { useEffect, useRef, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { captureAndShareWeb } from "../../lib/captureWeb";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import api from "../../services/api";
import { STATUS, statusDisplay, statusToneColors } from "../../lib/requestStatus";

const PAYMENT_LABEL = {
  WALLET: "request.payment.wallet",
  CASH: "request.payment.cash",
};

const TIMESTAMP_FIELD = {
  [STATUS.REQUESTED]: "createdAt",
  [STATUS.ACCEPTED]: "acceptedAt",
  [STATUS.PROCESSING]: "processingAt",
  [STATUS.READY_FOR_PICKUP]: "readyAt",
  [STATUS.RIDER_ASSIGNED]: "riderAssignedAt",
  [STATUS.RIDER_EN_ROUTE]: "riderEnRouteAt",
  [STATUS.PICKED_UP]: "pickedUpAt",
  [STATUS.IN_TRANSIT]: "inTransitAt",
  [STATUS.DELIVERED]: "deliveredAt",
  [STATUS.SETTLED]: "settledAt",
  [STATUS.CANCELLED]: "cancelledAt",
};

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Row({ label, value, mono, bold }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border.default,
      }}
    >
      <Text style={{ fontSize: 13, color: tokens.text.muted }}>{label}</Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: bold ? "800" : "600",
          color: bold ? tokens.text.primary : tokens.text.primary,
          fontVariant: mono ? ["tabular-nums"] : undefined,
          maxWidth: "60%",
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Full, shareable delivery/order receipt. Loads the complete request record
 * (items, package details, merchant, rider, pricing splits, lifecycle
 * timeline, proof-of-delivery) and renders it as a PNG that can be saved or
 * shared - mirrored from the wallet ReceiptScreen's capture/share mechanics.
 */
export default function RequestReceiptScreen({ navigation, route }) {
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();
  const requestId = route.params?.requestId;

  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!requestId) {
      setIsLoading(false);
      setError("No request id");
      return;
    }
    (async () => {
      try {
        const envelope = await api.get(`/requests/${requestId}`);
        if (!cancelled) setRequest(envelope?.data || null);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load receipt");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requestId]);

  const formatDateTime = (d) => {
    if (!d) return "";
    const tag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    return new Date(d).toLocaleString(tag, {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const handleShare = async () => {
    if (Platform.OS === "web") {
      try {
        await captureAndShareWeb("logistics-request-receipt", {
          fileName: `order-${request?.id || "logistics"}.png`,
          shareTitle: t("request.receipt.shareDialogTitle"),
          shareText: t("request.receipt.shareLine", { amount: formatNaira(request?.total) }),
        });
      } catch (err) {
        Toast.show({ type: "error", text1: t("wallet.receipt.couldntShare"), text2: String(err?.message || err).slice(0, 80) });
      }
      return;
    }
    try {
      const uri = await captureRef(receiptRef, { format: "png", quality: 1, result: "tmpfile" });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("request.receipt.shareDialogTitle"), UTI: "public.png" });
        return;
      }
      await Share.share({
        url: Platform.OS === "ios" ? uri : `file://${uri}`,
        message: t("request.receipt.shareLine", { amount: formatNaira(request?.total) }),
        title: t("request.receipt.shareDialogTitle"),
      });
    } catch (err) {
      Toast.show({ type: "error", text1: t("wallet.receipt.couldntShare"), text2: String(err?.message || err).slice(0, 80) });
    }
  };

  const handleCopy = () => {
    Toast.show({ type: "success", text1: t("request.receipt.refCopied"), text2: request?.id });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={tokens.brand.default} />
      </SafeAreaView>
    );
  }

  if (error || !request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Ionicons name="receipt-outline" size={40} color={tokens.text.muted} />
        <Text style={{ marginTop: 12, fontSize: 14, color: tokens.text.muted, textAlign: "center" }}>
          {error || t("request.receipt.noData")}
        </Text>
      </SafeAreaView>
    );
  }

  const isPkg = request.type === "PACKAGE";
  const catSlug = request.merchant?.category?.slug;
  const st = statusDisplay(request.status, request.type, catSlug);
  const stColor = statusToneColors(st.tone, tokens);
  const paymentLabelKey = PAYMENT_LABEL[request.paymentMethod];
  const paymentLabel = paymentLabelKey ? t(paymentLabelKey) : request.paymentMethod;
  const timeline = statusTimelineStatuses(request.type);
  const num = (n) => Number(n || 0);

  const items = Array.isArray(request.items) ? request.items : [];
  const hasItems = items.length > 0;
  const pkg = request.packageDetails;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => goBackOr(navigation)} accessibilityRole="button" accessibilityLabel={t("a11y.back")}>
          <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary, marginLeft: 16, letterSpacing: -0.5 }}>
          {t("request.receipt.title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <ViewShot ref={receiptRef} options={{ format: "png", quality: 1 }} style={{ backgroundColor: tokens.bg.canvas }}>
          <View nativeID="logistics-request-receipt">
            {/* Header */}
            <View style={{ alignItems: "center", paddingVertical: 28 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: stColor.bg, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Ionicons name={isPkg ? "cube-outline" : "receipt-outline"} size={34} color={stColor.color} />
              </View>
              <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 4 }}>
                {request.merchant?.name || (isPkg ? t("request.package") : t("activity.genericOrder"))}
              </Text>
              <Text style={{ fontSize: 32, fontWeight: "900", letterSpacing: -1, color: tokens.text.primary }}>
                {formatNaira(request.total)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stColor.color, marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: stColor.color }}>{st.label}</Text>
              </View>
            </View>

            {/* Itemized lines */}
            {hasItems ? (
              <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
                {items.map((it) => (
                  <View key={it.id} style={{ paddingVertical: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
                        {it.name}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary }}>
                        {formatNaira(num(it.lineTotal))}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                      {num(it.quantity)} × {formatNaira(num(it.unitPrice))}
                      {it.description ? `  ·  ${it.description}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Package details */}
            {isPkg && pkg ? (
              <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
                <Row label={t("request.receipt.pkgFrom")} value={`${pkg.senderName} · ${pkg.senderPhone || ""}`} />
                <Row label={t("request.receipt.pkgTo")} value={`${pkg.recipientName} · ${pkg.recipientPhone || ""}`} />
                {pkg.description ? <Row label={t("request.receipt.pkgContent")} value={pkg.description} /> : null}
                <Row label={t("request.receipt.pkgSize")} value={pkg.size} />
                {pkg.weight != null ? <Row label={t("request.receipt.pkgWeight")} value={`${pkg.weight} kg`} /> : null}
                {pkg.instructions ? <Row label={t("request.receipt.pkgInstructions")} value={pkg.instructions} /> : null}
              </View>
            ) : null}

            {/* Pricing breakdown */}
            <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
              {hasItems ? <Row label={t("request.receipt.subtotal")} value={formatNaira(request.subtotal)} /> : null}
              <Row label={t("request.receipt.deliveryFee")} value={formatNaira(request.deliveryFee)} />
              {num(request.discountAmount) > 0 ? (
                <Row label={t("request.receipt.discount")} value={`-${formatNaira(request.discountAmount)}`} />
              ) : null}
              {num(request.platformFee) > 0 ? <Row label={t("request.receipt.platformFee")} value={formatNaira(request.platformFee)} /> : null}
              {num(request.tax) > 0 ? <Row label={t("request.receipt.tax")} value={formatNaira(request.tax)} /> : null}
              <Row bold label={t("request.receipt.total")} value={formatNaira(request.total)} />
              <Row label={t("request.receipt.paymentMethod")} value={paymentLabel} />
            </View>

            {/* Trip */}
            <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
              <Row label={t("request.receipt.pickup")} value={request.pickupName ? `${request.pickupName} · ${request.pickupAddress}` : request.pickupAddress} />
              <Row label={t("request.receipt.dropoff")} value={request.dropoffName ? `${request.dropoffName} · ${request.dropoffAddress}` : request.dropoffAddress} />
              {request.distanceKm != null ? <Row label={t("request.receipt.distance")} value={`${Number(request.distanceKm).toFixed(1)} km`} /> : null}
              {request.estimatedMinutes != null ? <Row label={t("request.receipt.eta")} value={`~${request.estimatedMinutes} min`} /> : null}
            </View>

            {/* Rider */}
            {request.rider ? (
              <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
                <Row
                  label={t("request.receipt.rider")}
                  value={`${request.rider.user?.firstName || ""} ${request.rider.user?.lastName || ""}`.trim() || t("request.receipt.riderAssigned")}
                />
                {request.rider.vehicleType ? <Row label={t("request.receipt.vehicle")} value={String(request.rider.vehicleType).replace(/_/g, " ")} /> : null}
                {request.rider.plateNumber ? <Row label={t("request.receipt.plate")} value={request.rider.plateNumber} /> : null}
                {request.rider.averageRating ? <Row label={t("request.receipt.riderRating")} value={`${Number(request.rider.averageRating).toFixed(1)} ★`} /> : null}
              </View>
            ) : null}

            {/* Refs */}
            <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
              <Row label={t("request.receipt.orderRef")} value={request.id} mono />
              {request.transactionId ? <Row label={t("request.receipt.paymentRef")} value={request.transactionId} mono /> : null}
              {request.escrowTransactionId ? <Row label={t("request.receipt.escrowRef")} value={request.escrowTransactionId} mono /> : null}
              <Row label={t("request.receipt.date")} value={formatDateTime(request.createdAt)} />
            </View>

            {/* Proof of delivery */}
            {request.podPhotoUrl ? (
              <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
                <Row label={t("request.receipt.podPhoto")} value={t("request.receipt.podCaptured")} />
              </View>
            ) : null}

            {/* Cancellation block */}
            {request.status === STATUS.CANCELLED ? (
              <View style={{ backgroundColor: tokens.status.error + "15", borderRadius: 16, padding: 14, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.status.errorStrong }}>{t("request.receipt.cancelled")}</Text>
                {request.cancelledAt ? <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4 }}>{formatDateTime(request.cancelledAt)}</Text> : null}
                {request.cancellationReason ? <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>{request.cancellationReason}</Text> : null}
                {request.cancellationFee != null ? <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>{t("request.receipt.cancelFee")}: {formatNaira(request.cancellationFee)}</Text> : null}
              </View>
            ) : null}

            {/* Timeline */}
            <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>
                {t("request.receipt.timeline")}
              </Text>
              {timeline.map((statusKey) => {
                const ts = request[TIMESTAMP_FIELD[statusKey]];
                const reached = !!ts;
                const reachable = isReachable(request.status, statusKey);
                const tone = reached ? reachable : "neutral";
                const pill = statusToneColors(tone, tokens);
                return (
                  <View key={statusKey} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 14 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: reached ? pill.color : tokens.border.strong, marginRight: 12 }} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: reached ? "700" : "500", color: reached ? tokens.text.primary : tokens.text.placeholder }}>
                      {statusDisplay(statusKey, request.type, catSlug).label}
                    </Text>
                    {ts ? <Text style={{ fontSize: 12, color: tokens.text.muted }}>{formatDateTime(ts)}</Text> : null}
                  </View>
                );
              })}
            </View>

            <Text style={{ textAlign: "center", fontSize: 11, color: tokens.text.muted, marginBottom: 4 }}>
              {t("wallet.receipt.footer")}
            </Text>
          </View>
        </ViewShot>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            onPress={handleCopy}
            accessibilityRole="button"
            style={{ flex: 1, backgroundColor: tokens.bg.surface, paddingVertical: 14, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="copy-outline" size={18} color={tokens.text.primary} />
            <Text style={{ fontWeight: "700", color: tokens.text.primary, marginLeft: 8 }}>{t("request.receipt.copyRef")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            accessibilityRole="button"
            style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 14, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="share-outline" size={18} color={tokens.text.onBrand} />
            <Text style={{ fontWeight: "700", color: tokens.text.onBrand, marginLeft: 8 }}>{t("request.receipt.share")}</Text>
          </TouchableOpacity>
        </View>

        {isPkg || (request.status === STATUS.DELIVERED || request.status === STATUS.SETTLED) ? (
          <TouchableOpacity
            onPress={() => navigation.navigate("RequestTracking", { requestId: request.id })}
            accessibilityRole="button"
            style={{ marginTop: 12, backgroundColor: tokens.bg.surface, borderWidth: 1, borderColor: tokens.brand.default, paddingVertical: 14, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="locate-outline" size={18} color={tokens.brand.default} />
            <Text style={{ fontWeight: "700", color: tokens.brand.default, marginLeft: 8 }}>{t("request.receipt.viewTracking")}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// The exact statuses available to a request of this type, newest-to-oldest sense
// preserved from the backend taxonomy. Returns statuses in timeline order.
function statusTimelineStatuses(type) {
  const base = [
    STATUS.REQUESTED,
    STATUS.ACCEPTED,
    STATUS.PROCESSING,
    STATUS.READY_FOR_PICKUP,
    STATUS.RIDER_ASSIGNED,
    STATUS.RIDER_EN_ROUTE,
    STATUS.PICKED_UP,
    STATUS.IN_TRANSIT,
    STATUS.DELIVERED,
    STATUS.SETTLED,
  ];
  if (type === "PACKAGE") {
    return base.filter((s) => ![STATUS.ACCEPTED, STATUS.PROCESSING, STATUS.READY_FOR_PICKUP].includes(s));
  }
  return base;
}

// Whether a timeline status is a legitimately reached milestone for the
// request's current status (CANCELLED => everything before it stays 'success').
function isReachable(currentStatus, statusKey) {
  const order = statusTimelineStatuses("MERCHANT_ORDER");
  if (currentStatus === STATUS.CANCELLED) return order.indexOf(statusKey) < order.indexOf(STATUS.SETTLED);
  const idx = order.indexOf(currentStatus);
  return order.indexOf(statusKey) <= idx;
}