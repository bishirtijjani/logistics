import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { fetchWallet, fetchTransactions } from "../../store/slices/walletSlice";
import { colors } from "../../theme";
import EmptyState from "../../components/EmptyState";
import SkeletonLoader from "../../components/SkeletonLoader";

const CREDIT_TYPES = ["WALLET_FUNDING", "P2P_TRANSFER_RECEIVED", "REFUND", "DELIVERY_EARNING", "RIDER_EARNING", "ESCROW_REFUND"];

function formatNaira(amount) {
  return "₦" + Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const { t, i18n } = useTranslation();
  const { balance, accountNumber, bankName, accountName, transactions, isLoading } =
    useSelector((state) => state.wallet);
  const [showBalance, setShowBalance] = useState(true);

  // Locale-aware short date used in the transaction list.
  const formatDate = useMemo(() => {
    const tag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    return (d) => new Date(d).toLocaleDateString(tag, { day: "numeric", month: "short" });
  }, [i18n.language]);

  useEffect(() => {
    dispatch(fetchWallet());
    dispatch(fetchTransactions({ page: 1, limit: 5 }));
  }, [dispatch]);

  const recent = transactions.slice(0, 5);

  // Resolve a translated label for a transaction type. Falls back to the
  // server-supplied description (already localized when present) or the raw
  // enum if the catalog is missing the key.
  const txTitle = (tx) => {
    if (tx.description) return tx.description;
    const key = `wallet.txTypes.${tx.type}`;
    const translated = t(key);
    return translated === key ? tx.type.replace(/_/g, " ") : translated;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -1, marginBottom: 18 }}
          >
            {t("wallet.title")}
          </Text>

          {/* Balance Card */}
          <View style={{ backgroundColor: colors.dark, borderRadius: 22, padding: 24, overflow: "hidden" }}>
            <View style={{ position: "absolute", top: 0, right: 36, width: 4, height: "100%", backgroundColor: colors.primary }} />
            <View style={{ position: "absolute", top: -40, left: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: "#ffffff05" }} />

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" }}>
                {t("wallet.balance")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowBalance(!showBalance)}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.toggleBalance")}
                accessibilityState={{ selected: !showBalance }}
              >
                <Ionicons name={showBalance ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {isLoading && balance === 0 ? (
              <View style={{ marginBottom: 24 }}>
                <SkeletonLoader width={180} height={36} radius={6} />
              </View>
            ) : (
              <Text
                accessibilityLabel={`${t("wallet.balance")} ${showBalance ? formatNaira(balance) : ""}`.trim()}
                style={{ color: colors.white, fontSize: 40, fontWeight: "900", letterSpacing: -2, marginBottom: 24 }}
              >
                {showBalance ? formatNaira(balance) : "₦ ••••"}
              </Text>
            )}

            {/* Virtual Account */}
            {accountNumber && (
              <View style={{ backgroundColor: "#ffffff10", borderRadius: 10, padding: 10, marginBottom: 16 }}>
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 }}>
                  {t("wallet.fundViaTransfer")}
                </Text>
                <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800", letterSpacing: 1 }}>{accountNumber}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{bankName} · {accountName}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate("FundWallet")}
                accessibilityRole="button"
                accessibilityLabel={t("wallet.fund")}
                style={{ flex: 1, height: 44, backgroundColor: colors.primary, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="add" size={18} color={colors.white} />
                <Text numberOfLines={1} style={{ color: colors.white, fontWeight: "800", fontSize: 14, marginLeft: 6 }}>{t("wallet.fund")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate("SendMoney")}
                accessibilityRole="button"
                accessibilityLabel={t("wallet.send")}
                style={{ flex: 1, height: 44, backgroundColor: colors.surface, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="send" size={18} color={colors.text} />
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "800", fontSize: 14, marginLeft: 6 }}>{t("wallet.send")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate("Withdraw")}
                accessibilityRole="button"
                accessibilityLabel={t("wallet.withdraw")}
                style={{ flex: 1, height: 44, backgroundColor: "#ffffff12", borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ffffff10" }}
              >
                <Ionicons name="arrow-down" size={18} color={colors.white} />
                <Text numberOfLines={1} style={{ color: colors.white, fontWeight: "800", fontSize: 14, marginLeft: 6 }}>{t("wallet.withdraw")}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate("SavedBeneficiaries")}
              accessibilityRole="button"
              accessibilityLabel={t("wallet.savedBeneficiaries")}
              style={{ backgroundColor: "#ffffff08", borderRadius: 10, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="people-outline" size={16} color="#ffffff99" />
              <Text style={{ color: "#ffffff99", fontWeight: "700", fontSize: 12, marginLeft: 6 }}>{t("wallet.savedBeneficiaries")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text accessibilityRole="header" style={{ fontSize: 19, fontWeight: "900", color: colors.text, letterSpacing: -0.5 }}>
              {t("wallet.recentTransactions")}
            </Text>
            {transactions.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate("TransactionHistory")}
                accessibilityRole="link"
                accessibilityLabel={t("wallet.seeAll")}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>{t("wallet.seeAll")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {isLoading && transactions.length === 0 ? (
            <View>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLoader.TransactionRow key={i} />
              ))}
            </View>
          ) : recent.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title={t("wallet.noHistory")}
              subtitle={t("wallet.noHistoryHint")}
              fill={false}
            />
          ) : (
            recent.map((tx) => {
              const isCredit = CREDIT_TYPES.includes(tx.type);
              const meta = TX_ICON[tx.type] || { icon: "swap-horizontal", color: colors.textMuted };
              const title = txTitle(tx);
              const amountText = `${isCredit ? "+" : "-"}${formatNaira(tx.amount)}`;
              return (
                <View
                  key={tx.id}
                  accessible
                  accessibilityLabel={`${title}. ${amountText}. ${formatDate(tx.createdAt)}`}
                  style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10 }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: meta.color + "15", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                    <Ionicons name={meta.icon} size={22} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: isCredit ? "#16A34A" : colors.text }}>
                    {amountText}
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
