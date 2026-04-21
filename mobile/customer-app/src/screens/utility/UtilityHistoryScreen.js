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
import { fetchUtilityHistory } from "../../store/slices/utilitySlice";

const UTILITY_TYPES = {
  AIRTIME: { icon: "call", color: colors.primary, label: "Airtime" },
  DATA: { icon: "wifi", color: colors.primary, label: "Data" },
  ELECTRICITY: { icon: "flash", color: colors.warning, label: "Electricity" },
  TV: { icon: "tv", color: colors.info, label: "TV" },
};

const STATUS_COLORS = {
  COMPLETED: { bg: colors.success + "20", text: colors.success },
  PENDING: { bg: "#FEF3C7", text: "#D97706" },
  FAILED: { bg: colors.error + "20", text: colors.error },
  REFUNDED: { bg: colors.info + "20", text: colors.info },
};

export default function UtilityHistoryScreen({ navigation }) {
  const dispatch = useDispatch();
  const { history, isLoading, total } = useSelector((state) => state.utility);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async (pageNum = 1, refresh = false) => {
    await dispatch(fetchUtilityHistory({ page: pageNum, limit: 20 })).unwrap();
    if (refresh) setRefreshing(false);
  }, [dispatch]);

  useEffect(() => {
    loadHistory(1);
    setPage(1);
  }, [loadHistory]);

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  };

  const renderItem = ({ item }) => {
    const utilityType = UTILITY_TYPES[item.type] || { icon: "receipt", color: colors.textMuted, label: item.type };
    const statusColor = STATUS_COLORS[item.status] || { bg: colors.surface, text: colors.text };

    return (
      <View
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
            backgroundColor: utilityType.color + "15",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 16,
          }}
        >
          <Ionicons name={utilityType.icon} size={24} color={utilityType.color} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
              {utilityType.label}
            </Text>
            <View
              style={{
                backgroundColor: statusColor.bg,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                marginLeft: 8,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor.text }}>
                {item.status}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
            {item.recipient} • {formatDate(item.createdAt)}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
            ₦{item.amount?.toLocaleString()}
          </Text>
        </View>
      </View>
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
        No utility payments
      </Text>
      <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center" }}>
        Your airtime, data, and electricity payment history will appear here
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
            Payment History
          </Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          isLoading && history.length > 0 ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
