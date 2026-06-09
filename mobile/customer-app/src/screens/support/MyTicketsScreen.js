import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import {
  fetchMyTickets,
  fetchMyDisputes,
} from "../../store/slices/supportSlice";
import SkeletonLoader from "../../components/SkeletonLoader";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";

export default function MyTicketsScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("tickets");

  const ticketStatusColor = (status) => {
    switch (status) {
      case "OPEN": return tokens.status.errorStrong;
      case "IN_PROGRESS": return tokens.status.warning;
      case "PENDING_USER": return tokens.status.warningStrong;
      case "RESOLVED": return tokens.status.successStrong;
      case "CLOSED": return tokens.text.muted;
      default: return tokens.text.muted;
    }
  };

  const disputeStatusColor = (status) => {
    switch (status) {
      case "OPEN": return tokens.status.errorStrong;
      case "UNDER_REVIEW": return tokens.status.warning;
      case "AWAITING_RESPONSE": return tokens.status.warningStrong;
      case "RESOLVED": return tokens.status.successStrong;
      case "REJECTED": return tokens.text.muted;
      default: return tokens.text.muted;
    }
  };

  const {
    tickets,
    ticketsLoading,
    ticketsError,
    disputes,
    disputesLoading,
    disputesError,
  } = useSelector((s) => s.support);

  useEffect(() => {
    dispatch(fetchMyTickets({}));
    dispatch(fetchMyDisputes({}));
  }, [dispatch]);

  const refresh = () => {
    if (activeTab === "tickets") dispatch(fetchMyTickets({}));
    else dispatch(fetchMyDisputes({}));
  };

  const renderTicket = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("SupportTicketDetail", { ticketId: item.id })}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.openTicket", { number: item.number })}
      style={{
        backgroundColor: tokens.bg.surface,
        borderWidth: 1,
        borderColor: tokens.border.default,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: tokens.text.muted }}>#{item.number}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: ticketStatusColor(item.status) }}>
          {item.status.replace(/_/g, " ")}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
        {item.subject}
      </Text>
      <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4 }}>
        {item.category} · {new Date(item.lastActivityAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const renderDispute = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("SupportDisputeDetail", { disputeId: item.id })}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.openDispute", { number: item.number })}
      style={{
        backgroundColor: tokens.bg.surface,
        borderWidth: 1,
        borderColor: tokens.border.default,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: tokens.text.muted }}>
          {t("support.disputeNumber")} #{item.number}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: disputeStatusColor(item.status) }}>
          {item.status.replace(/_/g, " ")}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
        {item.reason}
      </Text>
      <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4 }}>
        {item.category.replace(/_/g, " ")} ·{" "}
        {new Date(item.lastActivityAt).toLocaleDateString()}
      </Text>
      {item.refundAmount && (
        <Text style={{ fontSize: 12, color: tokens.status.successStrong, marginTop: 4, fontWeight: "600" }}>
          ₦{Number(item.refundAmount).toLocaleString("en-NG")} {t("support.refundedToWallet")}
        </Text>
      )}
    </TouchableOpacity>
  );

  const list = activeTab === "tickets" ? tickets : disputes;
  const loading = activeTab === "tickets" ? ticketsLoading : disputesLoading;
  const error = activeTab === "tickets" ? ticketsError : disputesError;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: tokens.bg.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text
            style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary }}
            accessibilityRole="header"
          >
            {t("support.myTickets")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={refresh}
          style={{ padding: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.retry")}
        >
          <Ionicons name="refresh" size={20} color={tokens.text.primary} />
        </TouchableOpacity>
      </View>

      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 20,
          marginBottom: 10,
        }}
      >
        {[
          { id: "tickets", label: t("support.ticketsTab"), count: tickets.length },
          { id: "disputes", label: t("support.disputesTab"), count: disputes.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? tokens.brand.default : tokens.border.default,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: isActive ? tokens.brand.strong : tokens.text.muted,
                }}
              >
                {tab.label} {tab.count > 0 ? `(${tab.count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === "tickets" && (
        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("CreateSupportTicket")}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.newTicket")}
            style={{
              backgroundColor: tokens.brand.default,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color={tokens.text.onBrand} />
            <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 14 }}>
              {t("support.createTicket")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && list.length === 0 ? (
        <View style={{ paddingHorizontal: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonLoader.OrderRow key={i} />
          ))}
        </View>
      ) : error && list.length === 0 ? (
        <ErrorState
          message={typeof error === "string" ? error : error?.message}
          onRetry={refresh}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={activeTab === "tickets" ? t("support.noTickets") : t("support.noDisputes")}
          ctaLabel={activeTab === "tickets" ? t("support.createTicket") : undefined}
          onCta={
            activeTab === "tickets"
              ? () => navigation.navigate("CreateSupportTicket")
              : undefined
          }
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === "tickets" ? renderTicket : renderDispute}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={refresh}
        />
      )}
    </SafeAreaView>
  );
}
