import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors } from "../../theme";
import { fetchTransactions } from "../../store/slices/walletSlice";

const TRANSACTION_TYPES = {
  FUNDING: { icon: "add-circle", color: colors.success, label: "Funding" },
  P2P_TRANSFER: { icon: "swap-horizontal", color: colors.primary, label: "Transfer" },
  WITHDRAWAL: { icon: "arrow-down-circle", color: colors.error, label: "Withdrawal" },
  DELIVERY_PAYMENT: { icon: "bicycle", color: colors.error, label: "Delivery" },
  UTILITY_PAYMENT: { icon: "flash", color: colors.error, label: "Utility" },
  REFUND: { icon: "return-up-back", color: colors.success, label: "Refund" },
};

const TABS = ["All", "Funding", "Payments", "Transfers"];

export default function TransactionHistoryScreen({ navigation }) {
  const dispatch = useDispatch();
  const { transactions, isLoading, total } = useSelector((state) => state.wallet);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const typeMap = [null, "FUNDING", "DELIVERY_PAYMENT,UTILITY_PAYMENT", "P2P_TRANSFER,WITHDRAWAL"];

  const loadTransactions = useCallback(async (pageNum = 1, refresh = false) => {
    const type = typeMap[activeTab];
    await dispatch(fetchTransactions({ page: pageNum, limit: 20, type })).unwrap();
    if (refresh) setRefreshing(false);
  }, [dispatch, activeTab]);

  useEffect(() => {
    loadTransactions(1);
    setPage(1);
  }, [loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions(1, true);
  };

  const onEndReached = () => {
    if (transactions.length < total && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadTransactions(nextPage);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatAmount = (amount, type) => {
    const isCredit = ["FUNDING", "P2P_TRANSFER", "REFUND", "DELIVERY_EARNING"].includes(type);
    return `${isCredit ? "+" : "-"}₦${Number(amount).toLocaleString()}`;
  };

  const renderTransactionItem = ({ item }) => {
    const txType = TRANSACTION_TYPES[item.type] || { icon: "help-circle", color: colors.textMuted, label: item.type };
    const isCredit = ["FUNDING", "P2P_TRANSFER", "REFUND", "DELIVERY_EARNING"].includes(item.type);

    return (
      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: txType.color + "15",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 16,
          }}
        >
          <Ionicons name={txType.icon} size={24} color={txType.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
            {item.description || txType.label}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {formatDate(item.createdAt)}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: isCredit ? colors.success : colors.text,
            }}
          >
            {formatAmount(item.amount, item.type)}
          </Text>
          <View
            style={{
              backgroundColor:
                item.status === "COMPLETED"
                  ? colors.success + "20"
                  : item.status === "PENDING"
                  ? "#FEF3C7"
                  : colors.error + "20",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color:
                  item.status === "COMPLETED"
                    ? colors.success
                    : item.status === "PENDING"
                    ? "#D97706"
                    : colors.error,
              }}
            >
              {item.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={{ alignItems: "center", marginTop: 60 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name="receipt-outline" size={36} color={colors.textLight} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text, marginBottom: 6 }}>
        No transactions
      </Text>
      <Text style={{ fontSize: 13, color: colors.textMuted }}>
        Your transaction history will appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
            Transaction History
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 20,
          marginBottom: 16,
        }}
      >
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(i)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: i === activeTab ? colors.primary : colors.surface,
              marginRight: 8,
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

      {/* Transaction List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          isLoading && transactions.length > 0 ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
