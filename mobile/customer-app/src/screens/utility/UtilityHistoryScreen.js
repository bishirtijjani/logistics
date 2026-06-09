import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { fetchUtilityHistory, fetchUtilityPayment } from "../../store/slices/utilitySlice";
import EmptyState from "../../components/EmptyState";
import SkeletonLoader from "../../components/SkeletonLoader";

const FILTERS = [
  { key: null,           tabKey: "tabAll" },
  { key: "AIRTIME",      tabKey: "tabAirtime" },
  { key: "DATA",         tabKey: "tabData" },
  { key: "ELECTRICITY",  tabKey: "tabElectricity" },
  { key: "CABLE",        tabKey: "tabCable" },
];

const PENDING_STATUSES = ["PENDING", "PROCESSING"];
const POLL_MS = 5000;

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function UtilityHistoryScreen({ navigation }) {
  const dispatch = useDispatch();
  const { tokens } = useTheme();
  const { t, i18n } = useTranslation();
  const { history, isLoading, total } = useSelector((state) => state.utility);
  const [refreshing, setRefreshing] = useState(false);

  const UTILITY_TYPES = useMemo(() => ({
    AIRTIME:       { icon: "call",   color: tokens.category.airtime,     labelKey: "utility.airtime" },
    DATA:          { icon: "wifi",   color: tokens.category.data,        labelKey: "utility.data" },
    ELECTRICITY:   { icon: "flash",  color: tokens.status.warning,       labelKey: "utility.electricity" },
    CABLE:         { icon: "tv",     color: tokens.status.info,          labelKey: "utility.cable" },
    EDUCATION_PIN: { icon: "school", color: tokens.status.successStrong, labelKey: null },
  }), [tokens]);

  const STATUS_COLORS = useMemo(() => ({
    COMPLETED:  { bg: tokens.status.successSoft, text: tokens.status.success },
    PENDING:    { bg: tokens.status.warningSoft, text: tokens.status.warning },
    PROCESSING: { bg: tokens.status.warningSoft, text: tokens.status.warning },
    FAILED:     { bg: tokens.status.errorSoft,   text: tokens.status.error },
    REFUNDED:   { bg: tokens.status.infoSoft,    text: tokens.status.info },
  }), [tokens]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState(null);
  const pollRef = useRef(null);

  const formatDate = useMemo(() => {
    const tag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    return (d) => new Date(d).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
  }, [i18n.language]);

  const loadHistory = useCallback(async (pageNum = 1, refresh = false, type = filter) => {
    await dispatch(fetchUtilityHistory({ page: pageNum, limit: 20, type })).unwrap();
    if (refresh) setRefreshing(false);
  }, [dispatch, filter]);

  useEffect(() => {
    loadHistory(1, false, filter);
    setPage(1);
  }, [filter, loadHistory]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const pendingIds = history.filter((r) => PENDING_STATUSES.includes(r.status)).map((r) => r.id);
    if (!pendingIds.length) return;

    pollRef.current = setInterval(() => {
      pendingIds.forEach((id) => dispatch(fetchUtilityPayment(id)));
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [history, dispatch]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory(1, true);
  };

  const onEndReached = () => {
    if (history.length < total && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadHistory(nextPage);
    }
  };

  const handleRowPress = (item) => {
    if (item.type === "ELECTRICITY" && (item.token || PENDING_STATUSES.includes(item.status))) {
      navigation.navigate("ElectricityResult", {
        paymentId: item.id,
        amount: Number(item.amount),
        meterNumber: item.meterNumber,
        biller: item.biller,
        beneficiaryName: item.beneficiaryName,
      });
    }
  };

  const renderItem = ({ item }) => {
    const meta = UTILITY_TYPES[item.type] || { icon: "receipt", color: tokens.text.muted, labelKey: null };
    const typeLabel = meta.labelKey ? t(meta.labelKey) : item.type;
    const statusColor = STATUS_COLORS[item.status] || { bg: tokens.bg.surface, text: tokens.text.primary };
    const recipient = item.phoneNumber || item.meterNumber || "-";
    const amountText = naira(item.amount);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleRowPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${typeLabel}. ${amountText}. ${recipient}. ${item.status}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: tokens.bg.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: meta.color + "15", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
          <Ionicons name={meta.icon} size={24} color={meta.color} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>{typeLabel}</Text>
            <View
              style={{
                backgroundColor: statusColor.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
                marginLeft: 8, flexDirection: "row", alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor.text }}>{item.status}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 2 }}>
            {recipient} • {formatDate(item.createdAt)}
          </Text>
          {item.token ? (
            <Text style={{ fontSize: 12, color: tokens.brand.strong, fontWeight: "700", marginTop: 4 }}>
              {t("utility.result.tokenLabel")}: {item.token}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: tokens.text.primary }}>{amountText}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginRight: 16 }}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
          >
            <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary }}>
            {t("utility.history.title")}
          </Text>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, alignItems: "center" }}
        accessibilityRole="tablist"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const label = t(`utility.history.${f.tabKey}`);
          return (
            <TouchableOpacity
              key={f.tabKey}
              onPress={() => setFilter(f.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              style={{
                backgroundColor: active ? tokens.brand.default : tokens.bg.surface,
                borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
                marginRight: 8, borderWidth: 1,
                borderColor: active ? tokens.brand.default : tokens.border.default,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: active ? tokens.text.onBrand : tokens.text.primary }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="receipt-outline"
              title={t("utility.history.noTransactions")}
              subtitle={t("utility.history.noTransactionsHint")}
              fill={false}
            />
          ) : null
        }
        ListHeaderComponent={
          isLoading && history.length === 0 ? (
            <View>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLoader.TransactionRow key={i} />
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading && history.length > 0 ? <SkeletonLoader.TransactionRow /> : null
        }
      />
    </SafeAreaView>
  );
}
