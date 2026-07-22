import React, { useRef } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { captureAndShareWeb } from "../../lib/captureWeb";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";

const CREDIT_TYPES = [
  "WALLET_FUNDING",
  "P2P_TRANSFER_RECEIVED",
  "REFUND",
  "ESCROW_REFUND",
  "DELIVERY_EARNING",
  "RIDER_EARNING",
  "MERCHANT_EARNING",
];

function getRepeatTarget(transaction) {
  const meta = transaction?.metadata || {};
  switch (transaction?.type) {
    case "WITHDRAWAL":
      // Transfers ride the WITHDRAWAL type tagged with metadata.kind; route a
      // "repeat" back to whichever flow the user originally used so the prefill
      // and copy match. Both screens take the same bank params.
      return {
        screen: meta.kind === "transfer" ? "SendMoney" : "Withdraw",
        params: {
          bankCode: meta.bankCode,
          bankName: meta.bankName,
          accountNumber: meta.accountNumber,
          accountName: meta.accountName,
          amount: Number(transaction.amount),
        },
      };
    case "WALLET_FUNDING":
      return { screen: "FundWallet", params: {} };
    default:
      return null;
  }
}

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Row({ label, value, mono }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border.default,
      }}
    >
      <Text style={{ fontSize: 13, color: tokens.text.muted }}>{label}</Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: tokens.text.primary,
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

export default function ReceiptScreen({ navigation, route }) {
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();
  const { transaction } = route.params ?? {};
  const receiptRef = useRef(null);

  const STATUS_COLOR = {
    COMPLETED: tokens.status.success,
    PROCESSING: tokens.status.warning,
    FAILED: tokens.status.errorStrong,
    PENDING: tokens.status.warning,
  };

  if (!transaction) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: tokens.text.muted }}>{t("wallet.receipt.noData")}</Text>
      </SafeAreaView>
    );
  }

  const isCredit = CREDIT_TYPES.includes(transaction.type);
  const labelKey = `wallet.receipt.labels.${transaction.type}`;
  const translatedLabel = t(labelKey);
  const typeLabel = translatedLabel === labelKey
    ? (transaction.type?.replace(/_/g, " ") || "")
    : translatedLabel;
  const statusColor = STATUS_COLOR[transaction.status] || tokens.text.muted;
  const repeatTarget = getRepeatTarget(transaction);

  // An order payment is stored as an ESCROW_HOLD whose raw description
  // ("Escrow hold for request <id>") is internal plumbing. Customers should see
  // a plain payment line, not the escrow mechanics. Other tx types keep their
  // own (already customer-friendly) description.
  const displayDescription = transaction.type === "ESCROW_HOLD"
    ? t("wallet.receipt.orderPaymentDescription")
    : transaction.description;

  const formatDateTime = (d) => {
    const tag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    return new Date(d).toLocaleString(tag, {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const handleShare = async () => {
    if (Platform.OS === "web") {
      try {
        await captureAndShareWeb("iprime-receipt-capture", {
          fileName: `receipt-${transaction.reference || "iprime"}.png`,
          shareTitle: t("wallet.receipt.shareDialogTitle"),
          shareText: t("wallet.receipt.shareLine", { label: typeLabel, amount: formatNaira(transaction.amount) }),
        });
      } catch (err) {
        Toast.show({
          type: "error",
          text1: t("wallet.receipt.couldntShare"),
          text2: String(err?.message || err).slice(0, 80),
        });
      }
      return;
    }
    try {
      const uri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: t("wallet.receipt.shareDialogTitle"),
          UTI: "public.png",
        });
        return;
      }

      await Share.share({
        url: Platform.OS === "ios" ? uri : `file://${uri}`,
        message: t("wallet.receipt.shareLine", { label: typeLabel, amount: formatNaira(transaction.amount) }),
        title: t("wallet.receipt.shareDialogTitle"),
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("wallet.receipt.couldntShare"),
        text2: String(err?.message || err).slice(0, 80),
      });
    }
  };

  const handleCopy = () => {
    Toast.show({ type: "success", text1: t("wallet.receipt.refCopied"), text2: transaction.reference });
  };

  const handleRepeat = () => {
    if (!repeatTarget) return;
    navigation.navigate(repeatTarget.screen, repeatTarget.params);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
        >
          <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary, marginLeft: 16, letterSpacing: -0.5 }}>
          {t("wallet.receipt.title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <ViewShot
          ref={receiptRef}
          options={{ format: "png", quality: 1 }}
          style={{ backgroundColor: tokens.bg.canvas }}
        >
          <View nativeID="iprime-receipt-capture">
          {/* Amount header */}
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <View
              style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: (isCredit ? tokens.status.success : tokens.brand.default) + "20",
                alignItems: "center", justifyContent: "center", marginBottom: 16,
              }}
            >
              <Ionicons
                name={isCredit ? "arrow-down-circle" : "arrow-up-circle"}
                size={40}
                color={isCredit ? tokens.status.success : tokens.brand.default}
              />
            </View>
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 6 }}>{typeLabel}</Text>
            <Text
              style={{
                fontSize: 38, fontWeight: "900", letterSpacing: -1,
                color: isCredit ? tokens.status.success : tokens.text.primary,
              }}
            >
              {isCredit ? "+" : "-"}{formatNaira(transaction.amount)}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor, marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: statusColor }}>{transaction.status}</Text>
            </View>
          </View>

          <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 4, marginBottom: 20 }}>
            <Row label={t("wallet.receipt.reference")} value={transaction.reference} mono />
            {displayDescription ? <Row label={t("wallet.receipt.description")} value={displayDescription} /> : null}
            {transaction.balanceBefore !== undefined && transaction.balanceBefore !== null ? (
              <Row label={t("wallet.receipt.balanceBefore")} value={formatNaira(transaction.balanceBefore)} />
            ) : null}
            {transaction.balanceAfter !== undefined && transaction.balanceAfter !== null ? (
              <Row label={t("wallet.receipt.balanceAfter")} value={formatNaira(transaction.balanceAfter)} />
            ) : null}
            <Row label={t("wallet.receipt.date")} value={formatDateTime(transaction.createdAt)} />
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
            accessibilityLabel={t("wallet.receipt.copyRef")}
            style={{ flex: 1, backgroundColor: tokens.bg.surface, paddingVertical: 14, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="copy-outline" size={18} color={tokens.text.primary} />
            <Text style={{ fontWeight: "700", color: tokens.text.primary, marginLeft: 8 }}>{t("wallet.receipt.copyRef")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.receipt.share")}
            style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 14, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="share-outline" size={18} color={tokens.text.onBrand} />
            <Text style={{ fontWeight: "700", color: tokens.text.onBrand, marginLeft: 8 }}>{t("wallet.receipt.share")}</Text>
          </TouchableOpacity>
        </View>

        {repeatTarget ? (
          <TouchableOpacity
            onPress={handleRepeat}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.receipt.repeat")}
            style={{ marginTop: 12, backgroundColor: tokens.bg.surface, borderWidth: 1, borderColor: tokens.brand.default, paddingVertical: 14, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="refresh" size={18} color={tokens.brand.default} />
            <Text style={{ fontWeight: "700", color: tokens.brand.default, marginLeft: 8 }}>
              {t("wallet.receipt.repeat")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
