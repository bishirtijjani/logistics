import React, { useEffect, useRef, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { captureAndShareWeb } from "../../lib/captureWeb";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useRoute } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { formatNaira } from "../../lib/formatters";
import { fetchReceipt } from "../../store/slices/walletSlice";

const TYPE_COLORS = {
  RIDER_EARNING:  "#16A34A",
  WITHDRAWAL:     "#DC2626",
  REFUND:         "#16A34A",
  WALLET_FUNDING: "#16A34A",
  PAYOUT_FEE:     "#DC2626",
};

function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

/**
 * Transaction detail + shareable receipt. The card is captured via
 * react-native-view-shot and shared via expo-sharing as a PNG. The server
 * also exposes `GET /wallet/transactions/:id/receipt` which returns the
 * canonical receipt payload - we hit that to pick up server-side fields
 * (e.g. bank-side reference) the in-memory tx row may not have.
 */
export default function TransactionDetailScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const { transactionId, fallback } = route.params || {};

  const txFromList = useSelector((s) =>
    (s.wallet?.transactions || []).find((t) => t.id === transactionId),
  );

  const [tx, setTx] = useState(txFromList || fallback || null);
  const [loading, setLoading] = useState(!tx);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!transactionId) return;
    setLoading(true);
    (async () => {
      const res = await dispatch(fetchReceipt(transactionId));
      if (fetchReceipt.fulfilled.match(res)) {
        // Server payload may wrap as { transaction: ..., receipt: ... }.
        const r = res.payload;
        setTx({
          ...(txFromList || fallback || {}),
          ...(r.transaction || r),
        });
      }
      setLoading(false);
    })();
  }, [transactionId, dispatch]);

  const shareReceipt = async () => {
    if (sharing) return;
    if (Platform.OS === "web") {
      setSharing(true);
      try {
        await captureAndShareWeb("iprime-rider-receipt-capture", {
          fileName: `receipt-${tx?.reference || "iprime"}.png`,
          shareTitle: t("receipt.shareDialog", "Share receipt"),
          shareText: String(tx?.type || "").replace(/_/g, " "),
        });
      } catch (err) {
        Toast.show({
          type: "error",
          text1: t("receipt.shareFailed", "Couldn't share"),
          text2: err?.message || t("common.tryAgain", "Try again."),
        });
      } finally {
        setSharing(false);
      }
      return;
    }
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await cardRef.current.capture();
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Toast.show({
          type: "error",
          text1: t("receipt.shareUnavailable", "Sharing isn't available"),
          text2: t("receipt.shareUnavailableSub", "Take a screenshot to share manually."),
        });
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: t("receipt.shareDialog", "Share receipt"),
        UTI: "public.png",
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("receipt.shareFailed", "Couldn't share"),
        text2: err?.message || t("common.tryAgain", "Try again."),
      });
    } finally {
      setSharing(false);
    }
  };

  if (!tx && loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={tokens.brand.default} />
      </SafeAreaView>
    );
  }

  if (!tx) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Ionicons name="receipt-outline" size={40} color={tokens.text.muted} />
        <Text style={{ marginTop: 12, fontSize: 15, color: tokens.text.muted }}>
          {t("receipt.notFound", "Transaction not found")}
        </Text>
        <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={6} style={{ marginTop: 20 }}>
          <Text style={{ color: tokens.brand.default, fontWeight: "700" }}>{t("common.back", "Back")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const typeLabel = String(tx.type || "").replace(/_/g, " ");
  const amountColor = TYPE_COLORS[tx.type] || tokens.text.primary;
  const isCredit = ["RIDER_EARNING", "REFUND", "WALLET_FUNDING", "P2P_TRANSFER_RECEIVED"].includes(tx.type);
  const sign = isCredit ? "+" : "-";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={8} style={{ padding: 4 }} accessibilityRole="button" accessibilityLabel={t("common.back", "Back")}>
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
            {t("receipt.title", "Receipt")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={shareReceipt}
          disabled={sharing}
          accessibilityRole="button"
          accessibilityLabel={t("receipt.shareAria", "Share receipt")}
          style={{ padding: 4 }}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={tokens.brand.default} />
          ) : (
            <Ionicons name="share-outline" size={22} color={tokens.brand.default} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Capturable card */}
        <ViewShot
          ref={cardRef}
          options={{ format: "png", quality: 0.95 }}
          style={{
            backgroundColor: tokens.bg.surface,
            borderRadius: 18, padding: 22,
            borderWidth: 1, borderColor: tokens.border.default,
          }}
        >
          <View nativeID="iprime-rider-receipt-capture">
          <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.text.muted, letterSpacing: 0.5, textAlign: "center" }}>
            {t("receipt.brand", "iPRIME RIDER")}
          </Text>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2, textAlign: "center" }}>
            {typeLabel}
          </Text>

          <Text
            style={{
              fontSize: 36, fontWeight: "900",
              color: amountColor, letterSpacing: -1,
              textAlign: "center", marginVertical: 16,
            }}
          >
            {sign}{formatNaira(tx.amount)}
          </Text>

          <View style={{ height: 1, backgroundColor: tokens.border.subtle, marginVertical: 4 }} />

          <Row tokens={tokens} label={t("receipt.statusLabel", "Status")} value={tx.status || "-"} />
          <Row tokens={tokens} label={t("receipt.dateLabel", "Date")} value={formatDateTime(tx.createdAt)} />
          <Row tokens={tokens} label={t("receipt.refLabel", "Reference")} value={tx.reference || "-"} mono />
          {tx.description ? (
            <Row tokens={tokens} label={t("receipt.descLabel", "Description")} value={tx.description} />
          ) : null}
          {tx.balanceAfter != null ? (
            <Row tokens={tokens} label={t("receipt.balanceAfterLabel", "Balance after")} value={formatNaira(tx.balanceAfter)} />
          ) : null}
          {tx.fee != null && Number(tx.fee) > 0 ? (
            <Row tokens={tokens} label={t("receipt.feeLabel", "Fee")} value={formatNaira(tx.fee)} />
          ) : null}
          {tx.metadata?.bankCode || tx.metadata?.bankName ? (
            <Row
              tokens={tokens}
              label={t("receipt.bankLabel", "Bank")}
              value={tx.metadata.bankName || tx.metadata.bankCode}
            />
          ) : null}
          {tx.metadata?.accountNumber ? (
            <Row
              tokens={tokens}
              label={t("receipt.accountLabel", "Account")}
              value={tx.metadata.accountNumber}
              mono
            />
          ) : null}

          <View style={{ height: 1, backgroundColor: tokens.border.subtle, marginVertical: 8 }} />
          <Text style={{ fontSize: 10, color: tokens.text.placeholder, textAlign: "center", marginTop: 4 }}>
            {t("receipt.footer", "Generated by the iPrime Rider app")}
          </Text>
          </View>
        </ViewShot>

        <TouchableOpacity
          onPress={shareReceipt}
          disabled={sharing}
          accessibilityRole="button"
          accessibilityLabel={t("receipt.share", "Share receipt")}
          style={{
            marginTop: 18, paddingVertical: 14, borderRadius: 12,
            backgroundColor: tokens.brand.default,
            alignItems: "center", flexDirection: "row", justifyContent: "center",
            opacity: sharing ? 0.7 : 1,
          }}
        >
          {sharing ? (
            <ActivityIndicator color={tokens.text.onBrand} />
          ) : (
            <>
              <Ionicons name="share-outline" size={16} color={tokens.text.onBrand} />
              <Text style={{ marginLeft: 6, color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
                {t("receipt.share", "Share receipt")}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Phase 7 - report an issue on a delivered trip. RIDER_EARNING txs
            carry the originating requestId in metadata, which is exactly what
            CreateDispute needs. */}
        {tx.type === "RIDER_EARNING" && tx.metadata?.requestId ? (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("CreateDispute", { requestId: tx.metadata.requestId })
            }
            accessibilityRole="button"
            accessibilityLabel={t("support.fileDispute", "File dispute")}
            style={{
              marginTop: 10, paddingVertical: 14, borderRadius: 12,
              backgroundColor: tokens.bg.surface,
              borderWidth: 1, borderColor: tokens.border.default,
              alignItems: "center", flexDirection: "row", justifyContent: "center",
            }}
          >
            <Ionicons name="flag-outline" size={16} color={tokens.text.primary} />
            <Text style={{ marginLeft: 6, color: tokens.text.primary, fontWeight: "700", fontSize: 14 }}>
              {t("support.reportThisDelivery", "Report an issue with this delivery")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ tokens, label, value, mono }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 }}>
      <Text style={{ fontSize: 12, color: tokens.text.muted, flex: 1 }}>{label}</Text>
      <Text
        style={{
          fontSize: 13, fontWeight: "700", color: tokens.text.primary,
          flex: 2, textAlign: "right",
          fontFamily: mono ? "monospace" : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
