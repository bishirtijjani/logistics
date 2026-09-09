import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import api from "../../services/api";
import EmptyState from "../../components/EmptyState";
import SkeletonLoader from "../../components/SkeletonLoader";
import { statusDisplay, statusToneColors } from "../../lib/requestStatus";

const PAGE_SIZE = 20;
const TX_CREDITS = ["WALLET_FUNDING", "P2P_TRANSFER_RECEIVED", "REFUND", "ESCROW_REFUND", "DELIVERY_EARNING", "RIDER_EARNING", "MERCHANT_EARNING"];

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * "All Activity" - the customer's full, date-merged history of requests and
 * wallet transactions, newest first. One row per activity: every purchase
 * (orders + airtime/data/electricity/cable) and every money movement.
 *
 * The feed is built client-side from the two existing paginated endpoints so a
 * single source of truth keeps every activity in one timeline:
 *   - GET /requests?scope=customer&page=N      (orders / packages)
 *   - GET /wallet/transactions?page=N          (money movements; utility
 *     purchases arrive as UTILITY_PAYMENT transactions)
 *
 * Infinite scroll pages each source independently; the merged list is
 * re-sorted on every batch so ordering stays correct as older rows arrive.
 */

export default function AllActivityScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();

  // Per-source pagination + accumulation (kept local; the shared slices'
  // accumulation semantics differ and shouldn't be hijacked for this screen).
  const [requests, setRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reqPage, setReqPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [reqTotal, setReqTotal] = useState(0);
  const [txTotal, setTxTotal] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /**
   * Fetch one page of one source and apply it to local state. `reset` replaces
   * (pull-to-refresh), otherwise accumulates (infinite scroll).
   */
  const fetchAndApply = useCallback(async (kind, pageNum, reset) => {
    const [setList, setPage, setTotal] =
      kind === "requests"
        ? [setRequests, setReqPage, setReqTotal]
        : [setTransactions, setTxPage, setTxTotal];

    const qs = kind === "requests"
      ? `/requests?scope=customer&page=${pageNum}&limit=${PAGE_SIZE}`
      : `/wallet/transactions?page=${pageNum}&limit=${PAGE_SIZE}`;

    const envelope = await api.get(qs);
    const rows = envelope?.data || [];
    const total = Number(envelope?.meta?.total) || rows.length;
    setList((prev) => (reset ? rows : [...prev, ...rows]));
    setPage(pageNum);
    setTotal(total);
    return { rows, total };
  }, []);

  const initialLoad = useCallback(async () => {
    setIsInitialLoading(true);
    setError(null);
    let reqOk = false;
    let txOk = false;
    try {
      const [reqs, txs] = await Promise.allSettled([
        fetchAndApply("requests", 1, true),
        fetchAndApply("transactions", 1, true),
      ]);
      reqOk = reqs.status === "fulfilled";
      txOk = txs.status === "fulfilled";
      if (!reqOk && !txOk) {
        setError(reqs.reason?.message || "Failed to load activity");
      }
    } finally {
      if (mountedRef.current) setIsInitialLoading(false);
    }
  }, [fetchAndApply]);

  useEffect(() => {
    initialLoad();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await initialLoad();
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [initialLoad]);

  const onEndReached = useCallback(async () => {
    if (isInitialLoading || isLoadingMore) return;
    const reqLoadedAll = requests.length >= reqTotal;
    const txLoadedAll = transactions.length >= txTotal;
    if (reqLoadedAll && txLoadedAll) return;

    setIsLoadingMore(true);
    try {
      await Promise.allSettled([
        reqLoadedAll ? Promise.resolve() : fetchAndApply("requests", reqPage + 1, false),
        txLoadedAll ? Promise.resolve() : fetchAndApply("transactions", txPage + 1, false),
      ]);
    } finally {
      if (mountedRef.current) setIsLoadingMore(false);
    }
  }, [isInitialLoading, isLoadingMore, requests.length, reqTotal, transactions.length, txTotal, reqPage, txPage, fetchAndApply]);

  const merged = useMemo(() => {
    const items = [];
    for (const row of requests) items.push({ kind: "request", _at: row.createdAt, row });
    for (const row of transactions) items.push({ kind: "transaction", _at: row.createdAt, row });
    return items
      .filter((it) => it._at)
      .sort((a, b) => new Date(b._at).getTime() - new Date(a._at).getTime());
  }, [requests, transactions]);

  const formatDate = useCallback((iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const itemDay = new Date(d); itemDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dayStart.getTime() - itemDay.getTime()) / (1000 * 60 * 60 * 24));
    const tag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    if (diffDays <= 0) return d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return t("wallet.tx.dateYesterday");
    if (diffDays < 7) return t("wallet.tx.dateDaysAgo", { count: diffDays });
    return d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
  }, [i18n.language, t]);

  const txMeta = useMemo(() => ({
    WALLET_FUNDING:       { icon: "add-circle",          color: tokens.status.success },
    P2P_TRANSFER_SENT:    { icon: "arrow-up-circle",     color: tokens.text.muted },
    P2P_TRANSFER_RECEIVED:{ icon: "arrow-down-circle",   color: tokens.status.success },
    P2P_TRANSFER:         { icon: "swap-horizontal",     color: tokens.brand.default },
    WITHDRAWAL:           { icon: "arrow-down-circle",   color: tokens.status.errorStrong },
    DELIVERY_PAYMENT:     { icon: "bicycle",             color: tokens.status.error },
    UTILITY_PAYMENT:      { icon: "flash",               color: tokens.category.electricity },
    REFUND:               { icon: "return-up-back",      color: tokens.status.successStrong },
    ESCROW_HOLD:          { icon: "lock-closed",         color: tokens.status.warning },
    ESCROW_RELEASE:       { icon: "checkmark-done-circle", color: tokens.status.success },
    ESCROW_REFUND:        { icon: "return-down-back",    color: tokens.status.successStrong },
    DELIVERY_EARNING:     { icon: "wallet",              color: tokens.status.success },
    RIDER_EARNING:        { icon: "bicycle",             color: tokens.status.success },
    MERCHANT_EARNING:     { icon: "storefront",          color: tokens.status.success },
  }), [tokens]);

  // A UTILITY_PAYMENT transaction's description is "MTN airtime 0803…", so we
  // can pick a precise bill icon + label without an extra round-trip.
  const utilityIconForDescription = useCallback((desc) => {
    const s = String(desc || "").toLowerCase();
    if (s.includes("electricity")) return { icon: "flash", color: tokens.category.electricity, label: t("utility.electricity") };
    if (s.includes("cable")) return { icon: "tv", color: tokens.category.cable, label: t("utility.cable") };
    if (s.includes("airtime")) return { icon: "call", color: tokens.category.airtime, label: t("utility.airtime") };
    if (s.includes("data")) return { icon: "wifi", color: tokens.category.data, label: t("utility.data") };
    return null;
  }, [tokens, t]);

  const renderRow = ({ item }) => {
    const { kind, row } = item;

    if (kind === "request") {
      const isPkg = row.type === "PACKAGE";
      const catSlug = row.merchant?.category?.slug;
      const cat =
        row.type === "PACKAGE"
          ? { icon: "cube-outline", color: tokens.category.package.icon, bg: tokens.category.package.bg }
          : catSlug === "pharmacy"
            ? { icon: "medical-outline", color: tokens.category.pharmacy.icon, bg: tokens.category.pharmacy.bg }
            : (catSlug && catSlug.startsWith("grocery"))
              ? { icon: "basket-outline", color: tokens.category.groceries.icon, bg: tokens.category.groceries.bg }
              : { icon: "restaurant-outline", color: tokens.category.food.icon, bg: tokens.category.food.bg };
      const st = statusDisplay(row.status, row.type, catSlug);
      const stColor = statusToneColors(st.tone, tokens);
      const title = row.merchant?.name || (isPkg ? t("request.package") : t("activity.genericOrder"));
      const subtitle = row.dropoffAddress || row.pickupAddress || "";
      const amount = Number(row.customerPaid ?? row.total ?? 0);

      return (
        <TouchableOpacity
          onPress={() => navigation.navigate("RequestReceipt", { requestId: row.id })}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${formatNaira(amount)}. ${st.label}. ${formatDate(row.createdAt)}`}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 16, marginBottom: 12 }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: cat.bg, alignItems: "center", justifyContent: "center", marginRight: 16 }}>
            <Ionicons name={cat.icon} size={24} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>{title}</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
              {formatDate(row.createdAt)}
              {subtitle ? ` · ${subtitle}` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: tokens.text.primary }}>{formatNaira(amount)}</Text>
            <View style={{ backgroundColor: stColor.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: stColor.color }}>{st.label}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // ---- wallet transaction ----
    const isCredit = TX_CREDITS.includes(row.type);
    let meta = txMeta[row.type] || { icon: "help-circle", color: tokens.text.muted };
    let title = row.description || row.type;
    if (row.type === "UTILITY_PAYMENT") {
      const u = utilityIconForDescription(row.description);
      if (u) {
        meta = u;
        title = `${u.label} · ${row.description}`;
      }
    }
    const amountText = `${isCredit ? "+" : "-"}${formatNaira(row.amount)}`;
    const txStatusColor = row.status === "COMPLETED"
      ? { bg: tokens.status.success + "20", text: tokens.status.success }
      : row.status === "PENDING" || row.status === "PROCESSING"
        ? { bg: tokens.status.warningSoft, text: tokens.status.warning }
        : { bg: tokens.status.error + "20", text: tokens.status.error };

    const onPress = row.type === "UTILITY_PAYMENT"
      ? () => navigation.navigate("UtilityReceipt", { transaction: row })
      : () => navigation.navigate("Receipt", { transaction: row });

    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${amountText}. ${row.status}. ${formatDate(row.createdAt)}`}
        style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 16, marginBottom: 12 }}
      >
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: meta.color + "15", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
          <Ionicons name={meta.icon} size={24} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>{title}</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
            {formatDate(row.createdAt)}
            {row.reference ? ` · ${row.reference}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: isCredit ? tokens.status.success : tokens.text.primary }}>{amountText}</Text>
          <View style={{ backgroundColor: txStatusColor.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: txStatusColor.text }}>{row.status}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => goBackOr(navigation)} accessibilityRole="button" accessibilityLabel={t("a11y.back")}>
          <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary, marginLeft: 16, letterSpacing: -0.5 }}>
          {t("activity.title")}
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: tokens.text.muted, paddingHorizontal: 20, marginBottom: 12 }}>
        {t("activity.subtitle")}
      </Text>

      {isInitialLoading ? (
        <View style={{ paddingHorizontal: 20 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonLoader.TransactionRow key={i} />)}
        </View>
      ) : error && merged.length === 0 ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("states.errorTitle")}
          subtitle={error}
          ctaLabel={t("activity.retry")}
          onCta={() => initialLoad()}
        />
      ) : (
        <FlatList
          data={merged}
          keyExtractor={(it) => `${it.kind}-${it.row.id}`}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title={t("states.empty.activity")}
              subtitle={t("states.empty.activityHint")}
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={tokens.brand.default} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}