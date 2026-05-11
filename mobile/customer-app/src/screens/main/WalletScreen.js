import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { fetchWallet, fetchTransactions } from "../../store/slices/walletSlice";
import { colors } from "../../theme";
import Toast from "react-native-toast-message";

const CREDIT_TYPES = ["WALLET_FUNDING", "P2P_TRANSFER_RECEIVED", "REFUND", "DELIVERY_EARNING", "RIDER_EARNING", "ESCROW_REFUND"];

function formatNaira(amount) {
  return "₦" + Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

const TX_ICON = {
  WALLET_FUNDING: { icon: "add-circle", color: "#16A34A" },
  P2P_TRANSFER_SENT: { icon: "arrow-up-circle", color: "#EA580C" },
  P2P_TRANSFER_RECEIVED: { icon: "arrow-down-circle", color: "#16A34A" },
  WITHDRAWAL: { icon: "cash-outline", color: "#DC2626" },
  DELIVERY_PAYMENT: { icon: "bicycle", color: "#EA580C" },
  UTILITY_PAYMENT: { icon: "flash", color: "#7C3AED" },
  REFUND: { icon: "return-up-back", color: "#16A34A" },
  ESCROW_HOLD: { icon: "lock-closed", color: "#D97706" },
  ESCROW_REFUND: { icon: "lock-open", color: "#16A34A" },
};

export default function WalletScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance, accountNumber, bankName, accountName, isLocked, transactions, isLoading } =
    useSelector((state) => state.wallet);
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    dispatch(fetchWallet());
    dispatch(fetchTransactions({ page: 1, limit: 5 }));
  }, [dispatch]);

  const recent = transactions.slice(0, 5);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -1, marginBottom: 18 }}>
            Wallet
          </Text>

          {/* Balance Card */}
          <View style={{ backgroundColor: colors.dark, borderRadius: 22, padding: 24, overflow: "hidden" }}>
            <View style={{ position: "absolute", top: 0, right: 36, width: 4, height: "100%", backgroundColor: colors.primary }} />
            <View style={{ position: "absolute", top: -40, left: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: "#ffffff05" }} />

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" }}>
                Available Balance
              </Text>
              <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
                <Ionicons name={showBalance ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {isLoading && balance === 0 ? (
              <ActivityIndicator color={colors.white} size="small" style={{ marginBottom: 24, alignSelf: "flex-start" }} />
            ) : (
              <Text style={{ color: colors.white, fontSize: 40, fontWeight: "900", letterSpacing: -2, marginBottom: 24 }}>
                {showBalance ? formatNaira(balance) : "₦ ••••"}
              </Text>
            )}

            {/* Virtual Account */}
            {accountNumber && (
              <View style={{ backgroundColor: "#ffffff10", borderRadius: 10, padding: 10, marginBottom: 16 }}>
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 }}>
                  Fund via transfer
                </Text>
                <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800", letterSpacing: 1 }}>{accountNumber}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{bankName} · {accountName}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate("FundWallet")}
                style={{ flex: 1, backgroundColor: colors.primary, paddingVertical: 13, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: "800", fontSize: 14, marginLeft: 6 }}>Fund</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate("SendMoney")}
                style={{ flex: 1, backgroundColor: colors.surface, paddingVertical: 13, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="send" size={18} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14, marginLeft: 6 }}>Send</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate("Withdraw")}
                style={{ flex: 1, backgroundColor: "#ffffff12", paddingVertical: 13, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ffffff10" }}
              >
                <Ionicons name="arrow-down" size={18} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: "800", fontSize: 14, marginLeft: 6 }}>Withdraw</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate("SavedBeneficiaries")}
              style={{ backgroundColor: "#ffffff08", borderRadius: 10, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="people-outline" size={16} color="#ffffff99" />
              <Text style={{ color: "#ffffff99", fontWeight: "700", fontSize: 12, marginLeft: 6 }}>Saved Beneficiaries</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 19, fontWeight: "900", color: colors.text, letterSpacing: -0.5 }}>
              Recent Transactions
            </Text>
            {transactions.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate("TransactionHistory")}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {isLoading && transactions.length === 0 ? (
            <ActivityIndicator color={colors.primary} />
          ) : recent.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 36, alignItems: "center", borderWidth: 1.5, borderColor: colors.border }}>
              <View style={{ width: 56, height: 56, backgroundColor: colors.surfaceMuted || "#f4f4f7", borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Ionicons name="receipt-outline" size={24} color={colors.textMuted} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 4 }}>No transactions yet</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center" }}>Fund your wallet to get started.</Text>
            </View>
          ) : (
            recent.map((tx) => {
              const isCredit = CREDIT_TYPES.includes(tx.type);
              const meta = TX_ICON[tx.type] || { icon: "swap-horizontal", color: colors.textMuted };
              return (
                <View key={tx.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: meta.color + "15", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                    <Ionicons name={meta.icon} size={22} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                      {tx.description || tx.type.replace(/_/g, " ")}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: isCredit ? "#16A34A" : colors.text }}>
                    {isCredit ? "+" : "-"}{formatNaira(tx.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
