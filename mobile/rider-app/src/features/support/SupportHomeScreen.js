/**
 * SupportHomeScreen - entry point for the rider's tickets + disputes lists.
 * Mirrors the customer-app MyTicketsScreen with two tabs: Tickets / Disputes,
 * and an "Open new ticket" CTA on the tickets tab.
 */

import React, { useCallback, useEffect, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { fetchTickets, fetchDisputes } from "../../store/slices/supportSlice";
import EmptyState from "../../components/EmptyState";

const ticketStatusColor = (status, tokens) => {
  switch (status) {
    case "OPEN": return tokens.status.errorStrong;
    case "IN_PROGRESS": return tokens.status.warningStrong;
    case "PENDING_USER": return tokens.status.warning;
    case "RESOLVED": return tokens.status.successStrong;
    case "CLOSED": return tokens.text.muted;
    default: return tokens.text.muted;
  }
};

const disputeStatusColor = (status, tokens) => {
  switch (status) {
    case "OPEN": return tokens.status.errorStrong;
    case "UNDER_REVIEW": return tokens.status.warningStrong;
    case "AWAITING_RESPONSE": return tokens.status.warning;
    case "RESOLVED": return tokens.status.successStrong;
    case "REJECTED": return tokens.text.muted;
    default: return tokens.text.muted;
  }
};

export default function SupportHomeScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [activeTab, setActiveTab] = useState("tickets");
  const [refreshing, setRefreshing] = useState(false);

  const tickets = useSelector((s) => s.support?.tickets || []);
  const disputes = useSelector((s) => s.support?.disputes || []);
  const ticketsLoading = useSelector((s) => s.support?.ticketsLoading);
  const disputesLoading = useSelector((s) => s.support?.disputesLoading);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchTickets()).unwrap?.().catch(() => {}),
        dispatch(fetchDisputes()).unwrap?.().catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const renderTicket = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("TicketDetail", { ticketId: item.id })}
      accessibilityRole="button"
      style={{
        backgroundColor: tokens.bg.surface,
        borderWidth: 1, borderColor: tokens.border.default,
        borderRadius: 14, padding: 14, marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: tokens.text.muted }}>#{item.number}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: ticketStatusColor(item.status, tokens) }}>
          {String(item.status || "").replace(/_/g, " ")}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
        {item.subject}
      </Text>
      <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4 }}>
        {item.category} · {new Date(item.lastActivityAt || item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const renderDispute = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("DisputeDetail", { disputeId: item.id })}
      accessibilityRole="button"
      style={{
        backgroundColor: tokens.bg.surface,
        borderWidth: 1, borderColor: tokens.border.default,
        borderRadius: 14, padding: 14, marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: tokens.text.muted }}>
          {t("support.disputeNumber", "Dispute")} #{item.number}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: disputeStatusColor(item.status, tokens) }}>
          {String(item.status || "").replace(/_/g, " ")}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }} numberOfLines={1}>
        {item.reason || item.description}
      </Text>
      <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4 }}>
        {String(item.category || "").replace(/_/g, " ")} · {new Date(item.lastActivityAt || item.createdAt).toLocaleDateString()}
      </Text>
      {item.refundAmount ? (
        <Text style={{ fontSize: 12, color: tokens.status.successStrong, marginTop: 4, fontWeight: "600" }}>
          ₦{Number(item.refundAmount).toLocaleString("en-NG")} {t("support.refundedToWallet", "credited to your wallet")}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  const list = activeTab === "tickets" ? tickets : disputes;
  const loading = activeTab === "tickets" ? ticketsLoading : disputesLoading;

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
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, flex: 1, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("support.myTickets", "My Support")}
        </Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, marginTop: 10 }}>
        {[
          { id: "tickets", label: t("support.ticketsTab", "Tickets"), count: tickets.length },
          { id: "disputes", label: t("support.disputesTab", "Disputes"), count: disputes.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{
                flex: 1, paddingVertical: 10,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? tokens.brand.default : tokens.border.default,
                alignItems: "center",
              }}
            >
              <Text style={{
                fontSize: 14, fontWeight: "700",
                color: isActive ? tokens.brand.strong : tokens.text.muted,
              }}>
                {tab.label} {tab.count > 0 ? `(${tab.count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === "tickets" && (
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("CreateTicket")}
            accessibilityRole="button"
            accessibilityLabel={t("support.createTicket", "Create a ticket")}
            style={{
              backgroundColor: tokens.brand.default,
              borderRadius: 12, paddingVertical: 12,
              alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color={tokens.text.onBrand} />
            <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 14 }}>
              {t("support.createTicket", "Create a ticket")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && list.length === 0 ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          <ActivityIndicator color={tokens.brand.default} />
        </View>
      ) : list.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={activeTab === "tickets"
            ? t("support.noTickets", "You haven't raised any tickets yet.")
            : t("support.noDisputes", "No order disputes filed.")}
          subtitle={activeTab === "tickets"
            ? t("support.noTicketsSub", "Need help? Open a ticket and our support team will follow up.")
            : t("support.noDisputesSub", "Disputes can be raised from a delivered trip.")}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === "tickets" ? renderTicket : renderDispute}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadAll}
              tintColor={tokens.brand.default}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
