import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme";
import {
  fetchMyTickets,
  fetchMyDisputes,
} from "../../store/slices/supportSlice";

const ticketStatusColor = (status) => {
  switch (status) {
    case "OPEN": return "#DC2626";
    case "IN_PROGRESS": return "#D97706";
    case "PENDING_USER": return "#B45309";
    case "RESOLVED": return "#059669";
    case "CLOSED": return "#6B7280";
    default: return colors.textMuted;
  }
};

const disputeStatusColor = (status) => {
  switch (status) {
    case "OPEN": return "#DC2626";
    case "UNDER_REVIEW": return "#D97706";
    case "AWAITING_RESPONSE": return "#B45309";
    case "RESOLVED": return "#059669";
    case "REJECTED": return "#6B7280";
    default: return colors.textMuted;
  }
};

export default function MyTicketsScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("tickets");
  const {
    tickets,
    ticketsLoading,
    disputes,
    disputesLoading,
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
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: colors.textMuted }}>#{item.number}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: ticketStatusColor(item.status) }}>
          {item.status.replace(/_/g, " ")}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }} numberOfLines={1}>
        {item.subject}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
        {item.category} · {new Date(item.lastActivityAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const renderDispute = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("SupportDisputeDetail", { disputeId: item.id })}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: colors.textMuted }}>Dispute #{item.number}</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: disputeStatusColor(item.status) }}>
          {item.status.replace(/_/g, " ")}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }} numberOfLines={1}>
        {item.reason}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
        {item.category.replace(/_/g, " ")} ·{" "}
        {new Date(item.lastActivityAt).toLocaleDateString()}
      </Text>
      {item.refundAmount && (
        <Text style={{ fontSize: 12, color: "#059669", marginTop: 4, fontWeight: "600" }}>
          ₦{Number(item.refundAmount).toLocaleString("en-NG")} refunded
        </Text>
      )}
    </TouchableOpacity>
  );

  const list = activeTab === "tickets" ? tickets : disputes;
  const loading = activeTab === "tickets" ? ticketsLoading : disputesLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

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
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
            {t("support.myTickets")}
          </Text>
        </View>
        <TouchableOpacity onPress={refresh} style={{ padding: 8 }}>
          <Ionicons name="refresh" size={20} color={colors.text} />
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
              style={{
                flex: 1,
                paddingVertical: 10,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? colors.primary : colors.border,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: isActive ? colors.primary : colors.textMuted,
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
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              {t("support.createTicket")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="document-text-outline" size={48} color={colors.textLight} />
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 12, textAlign: "center" }}>
            {activeTab === "tickets" ? t("support.noTickets") : t("support.noDisputes")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === "tickets" ? renderTicket : renderDispute}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
