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

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Row({ label, value, mono, bold, accent }) {
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
          color: accent || tokens.text.primary,
          fontVariant: mono ? ["tabular-nums"] : undefined,
          maxWidth: "62%",
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const TYPE_META = {
  AIRTIME:     { icon: "call",        color: "category.airtime",     labelKey: "utility.airtime" },
  DATA:        { icon: "wifi",        color: "category.data",        labelKey: "utility.data" },
  ELECTRICITY: { icon: "flash",       color: "category.electricity", labelKey: "utility.electricity" },
  CABLE:       { icon: "tv",          color: "category.cable",       labelKey: "utility.cable" },
};

/**
 * Rich receipt for a utility purchase (airtime / data / electricity / cable).
 * The wallet only knows the generic UTILITY_PAYMENT transaction (amount, fee,
 * reference); this screen resolves the full `utilityPayment` record via the
 * payment reference and renders everything: biller, recipient, plan, token,
 * provider, fee breakdown - and lets the customer save/share it as a PNG.
 */
export default function UtilityReceiptScreen({ navigation, route }) {
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();
  const { transaction } = route.params ?? {};

  const [payment, setPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const ref = transaction?.reference;
    if (!ref) {
      setIsLoading(false);
      setError(t("request.receipt.noData"));
      return;
    }
    (async () => {
      try {
        const envelope = await api.get(`/utility/payments/${ref}`);
        if (!cancelled) setPayment(envelope?.data || null);
      } catch (err) {
        // The payment may predate rich tax data or the record lookup may fail;
        // fall back to showing the wallet transaction alone so users are never
        // left without a receipt in hand.
        if (!cancelled) setPayment(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [transaction?.reference]);

  // Source of truth for display: the utilityPayment row when available, else
  // the wallet transaction (which at minimum has amount, fee, reference, date).
  const meta = TYPE_META[(payment || transaction)?.type] || {
    icon: "receipt",
    color: "category.electricity",
    labelKey: "wallet.receipt.labels.UTILITY_PAYMENT",
  };
  const color = meta.color.startsWith("category.")
    ? tokens.category[meta.color.replace("category.", "")]
    : meta.color;
  const typeLabel = t(meta.labelKey);
  const amount = Number(payment?.amount ?? transaction?.amount ?? 0);
  const fee = Number(transaction?.fee ?? 0);
  const reference = payment?.transactionId || transaction?.reference || payment?.providerRequestId || "";
  const createdAt = payment?.createdAt || transaction?.createdAt;
  const recipient = payment
    ? (payment.phoneNumber || payment.meterNumber || "-")
    : (transaction?.description || "-");
  const status = payment?.status || transaction?.status || "";
  const statusColor =
    status === "COMPLETED" ? tokens.status.success
    : status === "FAILED" || status === "REFUNDED" ? tokens.status.error
    : tokens.status.warning;

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
        await captureAndShareWeb("logistics-utility-receipt", {
          fileName: `utility-${reference || "logistics"}.png`,
          shareTitle: t("utility.receipt.shareDialogTitle"),
          shareText: t("utility.receipt.shareLine", { type: typeLabel, amount: formatNaira(amount) }),
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
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("utility.receipt.shareDialogTitle"), UTI: "public.png" });
        return;
      }
      await Share.share({
        url: Platform.OS === "ios" ? uri : `file://${uri}`,
        message: t("utility.receipt.shareLine", { type: typeLabel, amount: formatNaira(amount) }),
        title: t("utility.receipt.shareDialogTitle"),
      });
    } catch (err) {
      Toast.show({ type: "error", text1: t("wallet.receipt.couldntShare"), text2: String(err?.message || err).slice(0, 80) });
    }
  };

  const handleCopy = () => {
    Toast.show({ type: "success", text1: t("wallet.receipt.refCopied"), text2: reference });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={tokens.brand.default} />
      </SafeAreaView>
    );
  }

  if (error || !transaction) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Ionicons name="receipt-outline" size={40} color={tokens.text.muted} />
        <Text style={{ marginTop: 12, fontSize: 14, color: tokens.text.muted, textAlign: "center" }}>
          {error || t("request.receipt.noData")}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => goBackOr(navigation)} accessibilityRole="button" accessibilityLabel={t("a11y.back")}>
          <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary, marginLeft: 16, letterSpacing: -0.5 }}>
          {t("utility.receipt.title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <ViewShot ref={receiptRef} options={{ format: "png", quality: 1 }} style={{ backgroundColor: tokens.bg.canvas }}>
          <View nativeID="logistics-utility-receipt">
            <View style={{ alignItems: "center", paddingVertical: 28 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: color + "18", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Ionicons name={meta.icon} size={34} color={color} />
              </View>
              <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 4 }}>
                {(payment?.biller || typeLabel).toUpperCase()}
              </Text>
              <Text style={{ fontSize: 32, fontWeight: "900", letterSpacing: -1, color: tokens.text.primary }}>
                {formatNaira(amount + fee)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor, marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: statusColor }}>{status}</Text>
              </View>
            </View>

            <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
              <Row label={t("utility.receipt.type")} value={typeLabel} />
              {payment?.biller ? <Row label={t("utility.receipt.biller")} value={payment.biller} /> : null}
              <Row label={t("utility.receipt.recipient")} value={recipient} />
              {payment?.beneficiaryName ? <Row label={t("utility.receipt.beneficiary")} value={payment.beneficiaryName} /> : null}
              {payment?.plan ? <Row label={t("utility.receipt.plan")} value={payment.plan} /> : null}
              {payment?.provider ? <Row label={t("utility.receipt.provider")} value={payment.provider} /> : null}
            </View>

            <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 16 }}>
              <Row label={t("utility.receipt.amount")} value={formatNaira(amount)} />
              {fee > 0 ? <Row label={t("utility.receipt.fee")} value={formatNaira(fee)} /> : null}
              <Row bold label={t("utility.receipt.total")} value={formatNaira(amount + fee)} />
              {transaction?.balanceBefore != null ? (
                <Row label={t("wallet.receipt.balanceBefore")} value={formatNaira(transaction.balanceBefore)} />
              ) : null}
              {transaction?.balanceAfter != null ? (
                <Row label={t("wallet.receipt.balanceAfter")} value={formatNaira(transaction.balanceAfter)} />
              ) : null}
              <Row label={t("wallet.receipt.reference")} value={reference} mono />
              <Row label={t("wallet.receipt.date")} value={formatDateTime(createdAt)} />
            </View>

            {payment?.type === "ELECTRICITY" && payment.token ? (
              <View style={{ backgroundColor: tokens.status.successSoft, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.status.successStrong, letterSpacing: 0.3 }}>
                  {t("utility.receipt.tokenLabel")}
                </Text>
                <Text
                  selectable
                  style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary, marginTop: 8, letterSpacing: 1.5, fontVariant: ["tabular-nums"] }}
                >
                  {payment.token}
                </Text>
                <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4 }}>{t("utility.receipt.tokenHint")}</Text>
              </View>
            ) : null}

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
            <Text style={{ fontWeight: "700", color: tokens.text.primary, marginLeft: 8 }}>{t("wallet.receipt.copyRef")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            accessibilityRole="button"
            style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 14, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="share-outline" size={18} color={tokens.text.onBrand} />
            <Text style={{ fontWeight: "700", color: tokens.text.onBrand, marginLeft: 8 }}>{t("utility.receipt.share")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}