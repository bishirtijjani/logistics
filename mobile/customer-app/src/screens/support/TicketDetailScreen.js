import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { colors } from "../../theme";
import SupportThread from "./SupportThread";
import {
  fetchTicketDetail,
  postTicketMessage,
  closeTicket,
  clearTicketDetail,
} from "../../store/slices/supportSlice";

const statusColor = (status) => {
  switch (status) {
    case "OPEN": return "#DC2626";
    case "IN_PROGRESS": return "#D97706";
    case "PENDING_USER": return "#B45309";
    case "RESOLVED": return "#059669";
    case "CLOSED": return "#6B7280";
    default: return colors.textMuted;
  }
};

export default function TicketDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { ticketId } = route.params || {};
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { ticketDetail, ticketDetailLoading } = useSelector((s) => s.support);
  const currentUserId = useSelector((s) => s.auth.user?.id);

  const [posting, setPosting] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (ticketId) dispatch(fetchTicketDetail(ticketId));
    return () => dispatch(clearTicketDetail());
  }, [dispatch, ticketId]);

  const handleSubmit = async ({ body }) => {
    setPosting(true);
    try {
      await dispatch(postTicketMessage({ ticketId, body })).unwrap();
    } catch (err) {
      Toast.show({ type: "error", text1: err?.message || t("support.sendFailed") });
    } finally {
      setPosting(false);
    }
  };

  const handleClose = () => {
    Alert.alert(
      t("support.closeTicketConfirm"),
      t("support.closeTicketBody"),
      [
        { text: t("photo.cancel"), style: "cancel" },
        {
          text: t("support.close"),
          style: "destructive",
          onPress: async () => {
            setClosing(true);
            try {
              await dispatch(closeTicket(ticketId)).unwrap();
              Toast.show({ type: "success", text1: t("support.ticketClosed") });
            } catch (err) {
              Toast.show({ type: "error", text1: err?.message });
            } finally {
              setClosing(false);
            }
          },
        },
      ],
    );
  };

  if (ticketDetailLoading || !ticketDetail) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isClosed = ticketDetail.status === "CLOSED";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 14,
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
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>
              {t("support.ticketNumber")} #{ticketDetail.number}
            </Text>
            <Text
              style={{ fontSize: 16, fontWeight: "800", color: colors.text }}
              numberOfLines={1}
            >
              {ticketDetail.subject}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: statusColor(ticketDetail.status),
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {ticketDetail.status.replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginHorizontal: 20,
          marginBottom: 8,
          padding: 12,
          backgroundColor: colors.surfaceMuted,
          borderRadius: 12,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>
          {ticketDetail.description}
        </Text>
        {Array.isArray(ticketDetail.attachmentUrls) &&
          ticketDetail.attachmentUrls.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {ticketDetail.attachmentUrls.map((url, i) => (
                <TouchableOpacity key={i} onPress={() => Linking.openURL(url).catch(() => {})}>
                  <Image
                    source={{ uri: url }}
                    style={{ width: 64, height: 64, borderRadius: 8 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
      </View>

      {ticketDetail.resolution && (
        <View
          style={{
            marginHorizontal: 20,
            marginBottom: 8,
            padding: 12,
            backgroundColor: "#D1FAE5",
            borderRadius: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#065F46" }}>
            {t("support.resolution")}
          </Text>
          <Text style={{ fontSize: 13, color: "#064E3B", marginTop: 4 }}>
            {ticketDetail.resolution}
          </Text>
        </View>
      )}

      <SupportThread
        messages={ticketDetail.messages || []}
        currentUserId={currentUserId}
        canPost={!isClosed}
        posting={posting}
        onSubmit={handleSubmit}
        placeholder={t("support.replyPlaceholder")}
      />

      {!isClosed && (
        <TouchableOpacity
          onPress={handleClose}
          disabled={closing}
          style={{
            paddingVertical: 10,
            alignItems: "center",
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>
            {closing ? "..." : t("support.closeTicket")}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
