import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { colors } from "../../theme";

const CREDIT_TYPES = [
  "WALLET_FUNDING",
  "P2P_TRANSFER_RECEIVED",
  "REFUND",
  "ESCROW_REFUND",
  "DELIVERY_EARNING",
  "RIDER_EARNING",
];

const TYPE_LABEL = {
  WALLET_FUNDING: "Wallet Funding",
  P2P_TRANSFER_SENT: "Transfer Sent",
  P2P_TRANSFER_RECEIVED: "Transfer Received",
  WITHDRAWAL: "Withdrawal",
  DELIVERY_PAYMENT: "Delivery Payment",
  UTILITY_PAYMENT: "Utility Payment",
  REFUND: "Refund",
  ESCROW_HOLD: "Payment (Hold)",
  ESCROW_REFUND: "Refund (Released)",
};

const STATUS_COLOR = {
  COMPLETED: "#16A34A",
  PROCESSING: "#D97706",
  FAILED: "#DC2626",
  PENDING: "#D97706",
};

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(d) {
  return new Date(d).toLocaleString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Row({ label, value, mono }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 13, color: colors.textMuted }}>{label}</Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: colors.text,
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
  const { transaction } = route.params ?? {};

  if (!transaction) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textMuted }}>No receipt data</Text>
      </SafeAreaView>
    );
  }

  const isCredit = CREDIT_TYPES.includes(transaction.type);
  const typeLabel = TYPE_LABEL[transaction.type] || transaction.type?.replace(/_/g, " ");
  const statusColor = STATUS_COLOR[transaction.status] || colors.textMuted;

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `VTU Logistics Receipt\n` +
          `Type: ${typeLabel}\n` +
          `Amount: ${formatNaira(transaction.amount)}\n` +
          `Reference: ${transaction.reference}\n` +
          `Status: ${transaction.status}\n` +
          `Date: ${formatDateTime(transaction.createdAt)}`,
        title: "Transaction Receipt",
      });
    } catch (_) {}
  };

  const handleCopy = () => {
    Toast.show({ type: "success", text1: "Reference copied", text2: transaction.reference });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text, marginLeft: 16, letterSpacing: -0.5 }}>
          Receipt
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        {/* Amount header */}
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: (isCredit ? "#16A34A" : colors.primary) + "20",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons
              name={isCredit ? "arrow-down-circle" : "arrow-up-circle"}
              size={40}
              color={isCredit ? "#16A34A" : colors.primary}
            />
          </View>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 6 }}>{typeLabel}</Text>
          <Text
            style={{
              fontSize: 38,
              fontWeight: "900",
              letterSpacing: -1,
              color: isCredit ? "#16A34A" : colors.text,
            }}
          >
            {isCredit ? "+" : "-"}{formatNaira(transaction.amount)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor, marginRight: 6 }} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: statusColor }}>{transaction.status}</Text>
          </View>
        </View>

        {/* Detail rows */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 4, marginBottom: 20 }}>
          <Row label="Reference" value={transaction.reference} mono />
          {transaction.description ? <Row label="Description" value={transaction.description} /> : null}
          {transaction.balanceBefore !== undefined && transaction.balanceBefore !== null ? (
            <Row label="Balance before" value={formatNaira(transaction.balanceBefore)} />
          ) : null}
          {transaction.balanceAfter !== undefined && transaction.balanceAfter !== null ? (
            <Row label="Balance after" value={formatNaira(transaction.balanceAfter)} />
          ) : null}
          <Row label="Date" value={formatDateTime(transaction.createdAt)} />
        </View>

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            onPress={handleCopy}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Ionicons name="copy-outline" size={18} color={colors.text} />
            <Text style={{ fontWeight: "700", color: colors.text, marginLeft: 8 }}>Copy Ref</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Ionicons name="share-outline" size={18} color={colors.white} />
            <Text style={{ fontWeight: "700", color: colors.white, marginLeft: 8 }}>Share</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
