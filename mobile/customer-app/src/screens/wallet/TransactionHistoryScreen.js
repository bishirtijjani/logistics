import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { fetchTransactions } from "../../store/slices/walletSlice";
import EmptyState from "../../components/EmptyState";
import SkeletonLoader from "../../components/SkeletonLoader";

const RANGES = [
  { key: "all", labelKey: "wallet.tx.rangeAll", days: null },
  { key: "7d",  labelKey: "wallet.tx.range7d",  days: 7   },
  { key: "30d", labelKey: "wallet.tx.range30d", days: 30  },
  { key: "90d", labelKey: "wallet.tx.range90d", days: 90  },
];

const TAB_KEYS = ["tabAll", "tabFunding", "tabPayments", "tabTransfers"];

function computeRange(rangeKey) {
  const range = RANGES.find((r) => r.key === rangeKey);
  if (!range || !range.days) return { startDate: null, endDate: null };
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - range.days);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export default function TransactionHistoryScreen({ navigation }) {
  const dispatch = useDispatch();
  const { tokens } = useTheme();
  const { t, i18n } = useTranslation();

  // Tx type metadata. `labelKey` resolves to a localized string at render.
  const TRANSACTION_TYPES = {
    FUNDING:           { icon: "add-circle",       color: tokens.status.success, labelKey: "wallet.tx.labelFunding"    },
    P2P_TRANSFER:      { icon: "swap-horizontal",  color: tokens.brand.default,  labelKey: "wallet.tx.labelTransfer"   },
    WITHDRAWAL:        { icon: "arrow-down-circle",color: tokens.status.error,   labelKey: "wallet.tx.labelWithdrawal" },
    DELIVERY_PAYMENT:  { icon: "bicycle",          color: tokens.status.error,   labelKey: "wallet.tx.labelDelivery"   },
    UTILITY_PAYMENT:   { icon: "flash",            color: tokens.status.error,   labelKey: "wallet.tx.labelUtility"    },
    REFUND:            { icon: "return-up-back",   color: tokens.status.success, labelKey: "wallet.tx.labelRefund"     },
  };

  const { transactions, isLoading, total } = useSelector((state) => state.wallet);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [rangeKey, setRangeKey] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const typeMap = [null, "FUNDING", "DELIVERY_PAYMENT,UTILITY_PAYMENT", "P2P_TRANSFER,WITHDRAWAL"];

  useEffect(() => {
    const id = setTimeout(() => setSearchQ(searchInput.trim()), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadTransactions = useCallback(async (pageNum = 1, refresh = false) => {
    const type = typeMap[activeTab];
    const { startDate, endDate } = computeRange(rangeKey);
    await dispatch(fetchTransactions({
      page: pageNum, limit: 20, type, startDate, endDate, q: searchQ || null,
    })).unwrap();
    if (refresh) setRefreshing(false);
  }, [dispatch, activeTab, rangeKey, searchQ]); // eslint-disable-line

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
    const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (days === 0) return t("wallet.tx.dateToday");
    if (days === 1) return t("wallet.tx.dateYesterday");
    if (days < 7) return t("wallet.tx.dateDaysAgo", { count: days });
    const tag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    return date.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
  };

  const formatAmount = (amount, type) => {
    const isCredit = ["FUNDING", "P2P_TRANSFER", "REFUND", "DELIVERY_EARNING"].includes(type);
    return `${isCredit ? "+" : "-"}₦${Number(amount).toLocaleString()}`;
  };

  const filterChipCount = useMemo(() => {
    let n = 0;
    if (rangeKey !== "all") n += 1;
    if (searchQ) n += 1;
    return n;
  }, [rangeKey, searchQ]);

  const renderTransactionItem = ({ item }) => {
    const meta = TRANSACTION_TYPES[item.type] || { icon: "help-circle", color: tokens.text.muted, labelKey: null };
    const fallbackLabel = item.type;
    const txLabel = meta.labelKey ? t(meta.labelKey) : fallbackLabel;
    const isCredit = ["FUNDING", "P2P_TRANSFER", "REFUND", "DELIVERY_EARNING"].includes(item.type);
    const title = item.description || txLabel;
    const amountText = formatAmount(item.amount, item.type);

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("Receipt", { transaction: item })}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${amountText}. ${formatDate(item.createdAt)}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: tokens.bg.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: meta.color + "15",
            alignItems: "center", justifyContent: "center",
            marginRight: 16,
          }}
        >
          <Ionicons name={meta.icon} size={24} color={meta.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>{title}</Text>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>{formatDate(item.createdAt)}</Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: isCredit ? tokens.status.success : tokens.text.primary }}>
            {amountText}
          </Text>
          <View
            style={{
              backgroundColor:
                item.status === "COMPLETED" ? tokens.status.success + "20"
                : item.status === "PENDING" ? tokens.status.warningSoft
                : tokens.status.error + "20",
              paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4,
            }}
          >
            <Text style={{
              fontSize: 10, fontWeight: "700",
              color: item.status === "COMPLETED" ? tokens.status.success
                   : item.status === "PENDING" ? tokens.status.warning
                   : tokens.status.error,
            }}>
              {item.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <EmptyState
      icon="receipt-outline"
      title={searchQ || rangeKey !== "all" ? t("wallet.tx.noMatches") : t("wallet.tx.noTransactions")}
      subtitle={
        searchQ
          ? t("wallet.tx.noMatchesHint", { q: searchQ })
          : rangeKey !== "all"
            ? t("wallet.tx.tryWiderRange")
            : t("wallet.tx.willAppearHere")
      }
      fill={false}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ marginRight: 16 }}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.back")}
            >
              <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
            </TouchableOpacity>
            <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary }}>
              {t("wallet.history")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setFiltersOpen((v) => !v)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: filtersOpen || filterChipCount > 0 ? tokens.brand.default + "20" : tokens.bg.surface,
              flexDirection: "row",
              alignItems: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.tx.filtersToggle")}
            accessibilityState={{ expanded: filtersOpen }}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={filtersOpen || filterChipCount > 0 ? tokens.brand.default : tokens.text.primary}
            />
            {filterChipCount > 0 ? (
              <View style={{ marginLeft: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: tokens.brand.default, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: tokens.text.onBrand }}>{filterChipCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters drawer */}
      {filtersOpen ? (
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          {/* Reference search */}
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10 }}>
            <Ionicons name="search" size={18} color={tokens.text.muted} />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder={t("wallet.tx.searchPh")}
              accessibilityLabel={t("wallet.tx.searchPh")}
              placeholderTextColor={tokens.text.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: tokens.text.primary }}
            />
            {searchInput ? (
              <TouchableOpacity
                onPress={() => setSearchInput("")}
                accessibilityRole="button"
                accessibilityLabel={t("wallet.tx.clearSearch")}
              >
                <Ionicons name="close-circle" size={18} color={tokens.text.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Date range presets */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {RANGES.map((r) => {
              const selected = rangeKey === r.key;
              const label = t(r.labelKey);
              return (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setRangeKey(r.key)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
                    backgroundColor: selected ? tokens.brand.default : tokens.bg.surface,
                    marginRight: 8, marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? tokens.text.onBrand : tokens.text.muted }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, marginBottom: 16 }} accessibilityRole="tablist">
        {TAB_KEYS.map((tabKey, i) => {
          const label = t(`wallet.tx.${tabKey}`);
          const selected = i === activeTab;
          return (
            <TouchableOpacity
              key={tabKey}
              onPress={() => setActiveTab(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: selected ? tokens.brand.default : tokens.bg.surface,
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: selected ? tokens.text.onBrand : tokens.text.muted }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        ListHeaderComponent={
          isLoading && transactions.length === 0
            ? (
              <View>
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonLoader.TransactionRow key={i} />
                ))}
              </View>
            )
            : null
        }
        ListFooterComponent={
          isLoading && transactions.length > 0
            ? <SkeletonLoader.TransactionRow />
            : null
        }
      />
    </SafeAreaView>
  );
}
