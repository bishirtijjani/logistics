import React, { useCallback, useEffect, useMemo, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { formatNaira } from "../../lib/formatters";
import { fetchTransactions } from "../../store/slices/walletSlice";

const TX_FILTERS = [
  { key: "ALL",                  labelKey: "transactions.filterAll",      fallback: "All" },
  { key: "RIDER_EARNING",        labelKey: "transactions.filterEarnings", fallback: "Earnings" },
  { key: "WITHDRAWAL",           labelKey: "transactions.filterWithdrawals", fallback: "Withdrawals" },
  { key: "REFUND",               labelKey: "transactions.filterRefunds",  fallback: "Refunds" },
  { key: "WALLET_FUNDING",       labelKey: "transactions.filterFunding",  fallback: "Funding" },
];

// `tone` keys a token path resolved at render so amount/icon colors flip with theme.
const TYPE_META = {
  RIDER_EARNING:  { icon: "cash-outline",      tone: "credit", sign: "+" },
  WITHDRAWAL:     { icon: "arrow-down",        tone: "debit",  sign: "-" },
  REFUND:         { icon: "refresh-outline",   tone: "credit", sign: "+" },
  WALLET_FUNDING: { icon: "arrow-up",          tone: "credit", sign: "+" },
  PAYOUT_FEE:     { icon: "remove-circle-outline", tone: "debit", sign: "-" },
  P2P_TRANSFER_SENT:     { icon: "send-outline",  tone: "debit",  sign: "-" },
  P2P_TRANSFER_RECEIVED: { icon: "send",          tone: "credit", sign: "+" },
};

function metaFor(type) {
  return TYPE_META[type] || { icon: "ellipsis-horizontal", tone: "neutral", sign: "" };
}

function toneColor(tone, tokens) {
  if (tone === "credit") return tokens.status.success;
  if (tone === "debit") return tokens.status.errorStrong;
  return tokens.text.muted;
}

function relativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function TransactionsScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const transactions = useSelector((s) => s.wallet?.transactions) || [];
  const total = useSelector((s) => s.wallet?.total) || 0;
  const isLoading = useSelector((s) => s.wallet?.isLoading);

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search input.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Refetch page 1 on filter/search change.
  useEffect(() => {
    setPage(1);
    dispatch(fetchTransactions({
      page: 1,
      type: filter === "ALL" ? null : filter,
      q: debouncedSearch || null,
    }));
  }, [filter, debouncedSearch, dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    try {
      await dispatch(fetchTransactions({
        page: 1,
        type: filter === "ALL" ? null : filter,
        q: debouncedSearch || null,
      })).unwrap?.().catch(() => {});
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, filter, debouncedSearch]);

  const loadMore = useCallback(() => {
    if (isLoading) return;
    if (transactions.length >= total) return;
    const next = page + 1;
    setPage(next);
    dispatch(fetchTransactions({
      page: next,
      type: filter === "ALL" ? null : filter,
      q: debouncedSearch || null,
    }));
  }, [isLoading, page, transactions.length, total, filter, debouncedSearch, dispatch]);

  const renderRow = ({ item }) => {
    const meta = metaFor(item.type);
    const metaColor = toneColor(meta.tone, tokens);
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("TransactionDetail", { transactionId: item.id, fallback: item })}
        accessibilityRole="button"
        accessibilityLabel={t("transactions.rowAria", "{{type}} {{amount}}", {
          type: (item.type || "").replace(/_/g, " ").toLowerCase(),
          amount: formatNaira(item.amount),
        })}
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderTopWidth: 1, borderTopColor: tokens.border.subtle,
        }}
      >
        <View
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center", justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name={meta.icon} size={16} color={metaColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
            {item.description || (item.type || "").replace(/_/g, " ")}
          </Text>
          <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>
            {relativeTime(item.createdAt)}
            {item.status && item.status !== "COMPLETED" ? ` · ${item.status.toLowerCase()}` : ""}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 15, fontWeight: "800", color: metaColor,
            letterSpacing: -0.3,
          }}
        >
          {meta.sign}{formatNaira(item.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("transactions.title", "Transactions")}
        </Text>
      </View>

      {/* Search */}
      <View
        style={{
          marginHorizontal: 14, marginTop: 12,
          backgroundColor: tokens.bg.surface,
          borderRadius: 12, paddingHorizontal: 12,
          flexDirection: "row", alignItems: "center",
          borderWidth: 1, borderColor: tokens.border.default,
        }}
      >
        <Ionicons name="search" size={16} color={tokens.text.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("transactions.searchPh", "Search reference or description")}
          placeholderTextColor={tokens.text.placeholder}
          accessibilityLabel={t("transactions.searchAria", "Search transactions")}
          style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 13, color: tokens.text.primary }}
        />
        {search ? (
          <TouchableOpacity
            onPress={() => setSearch("")}
            accessibilityRole="button"
            accessibilityLabel={t("common.clear", "Clear")}
            hitSlop={6}
          >
            <Ionicons name="close-circle" size={16} color={tokens.text.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}
      >
        {TX_FILTERS.map((f) => {
          const selected = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(f.labelKey, f.fallback)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: selected ? tokens.brand.default : tokens.bg.surface,
                borderWidth: 1,
                borderColor: selected ? tokens.brand.default : tokens.border.default,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? tokens.text.onBrand : tokens.text.primary }}>
                {t(f.labelKey, f.fallback)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={transactions}
        keyExtractor={(tx, i) => tx.id || tx.reference || `tx-${i}`}
        renderItem={renderRow}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator color={tokens.brand.default} />
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="receipt-outline" size={40} color={tokens.text.muted} />
              <Text style={{ marginTop: 12, fontSize: 14, color: tokens.text.muted, textAlign: "center" }}>
                {t("transactions.emptyTitle", "No transactions yet")}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 12, color: tokens.text.placeholder, textAlign: "center", paddingHorizontal: 28 }}>
                {t("transactions.emptySub", "Settlements and withdrawals will show up here.")}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoading && transactions.length > 0 ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <ActivityIndicator color={tokens.brand.default} size="small" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
