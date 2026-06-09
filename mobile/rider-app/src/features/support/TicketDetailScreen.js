/**
 * TicketDetailScreen - thread view + composer for a single support ticket.
 * Pulls detail via `fetchTicketDetail` on mount and posts replies via
 * `postTicketMessage`. Closing a ticket is owner-only and prompts to
 * confirm.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
import { useTheme } from "../../theme";
import SupportThread from "./SupportThread";
import {
  fetchTicketDetail,
  postTicketMessage,
  closeTicket,
  clearTicketDetail,
} from "../../store/slices/supportSlice";

const statusColor = (status, tokens) => {
  switch (status) {
    case "OPEN": return tokens.status.errorStrong;
    case "IN_PROGRESS": return tokens.status.warningStrong;
    case "PENDING_USER": return tokens.status.warning;
    case "RESOLVED": return tokens.status.successStrong;
    case "CLOSED": return tokens.text.muted;
    default: return tokens.text.muted;
  }
};

export default function TicketDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { ticketId } = route.params || {};
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const ticketDetail = useSelector((s) => s.support?.ticketDetail);
  const ticketDetailLoading = useSelector((s) => s.support?.ticketDetailLoading);
  const currentUserId = useSelector((s) => s.auth?.user?.id);

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
      Toast.show({
        type: "error",
        text1: err?.message || t("support.sendFailed", "Failed to send"),
      });
    } finally {
      setPosting(false);
    }
  };

  const handleClose = () => {
    Alert.alert(
      t("support.closeTicketConfirm", "Close ticket?"),
      t("support.closeTicketBody", "You won't be able to reply once closed. You can always raise a new ticket later."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("support.close", "Close"),
          style: "destructive",
          onPress: async () => {
            setClosing(true);
            try {
              await dispatch(closeTicket(ticketId)).unwrap();
              Toast.show({ type: "success", text1: t("support.ticketClosed", "Ticket closed") });
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
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.brand.default} />
        </View>
      </SafeAreaView>
    );
  }

  const isClosed = ticketDetail.status === "CLOSED";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("common.back", "Back")}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={{ fontSize: 11, color: tokens.text.muted }}>
              {t("support.ticketNumber", "Ticket")} #{ticketDetail.number}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary }} numberOfLines={1} accessibilityRole="header">
              {ticketDetail.subject}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: statusColor(ticketDetail.status, tokens),
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontSize: 10, fontWeight: "700" }}>
            {String(ticketDetail.status || "").replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginHorizontal: 14, marginTop: 12,
          padding: 12,
          backgroundColor: tokens.bg.surfaceMuted,
          borderRadius: 12,
        }}
      >
        <Text style={{ fontSize: 13, color: tokens.text.primary, lineHeight: 18 }}>
          {ticketDetail.description}
        </Text>
        {Array.isArray(ticketDetail.attachmentUrls) && ticketDetail.attachmentUrls.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {ticketDetail.attachmentUrls.map((url, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => Linking.openURL(url).catch(() => {})}
                accessibilityRole="imagebutton"
                accessibilityLabel={t("support.thread.attachmentA11y", "Open attachment")}
              >
                <Image source={{ uri: url }} style={{ width: 64, height: 64, borderRadius: 8 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {ticketDetail.resolution ? (
        <View
          style={{
            marginHorizontal: 14, marginTop: 8,
            padding: 12,
            backgroundColor: tokens.status.successSoft,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.status.successStrong }}>
            {t("support.resolution", "Resolution")}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.text.primary, marginTop: 4 }}>
            {ticketDetail.resolution}
          </Text>
        </View>
      ) : null}

      <SupportThread
        messages={ticketDetail.messages || []}
        currentUserId={currentUserId}
        canPost={!isClosed}
        posting={posting}
        onSubmit={handleSubmit}
        placeholder={t("support.replyPlaceholder", "Type a reply...")}
      />

      {!isClosed && (
        <TouchableOpacity
          onPress={handleClose}
          disabled={closing}
          accessibilityRole="button"
          accessibilityState={{ disabled: closing, busy: closing }}
          style={{
            paddingVertical: 10,
            alignItems: "center",
            borderTopWidth: 1,
            borderTopColor: tokens.border.default,
            backgroundColor: tokens.bg.surface,
          }}
        >
          <Text style={{ color: tokens.status.errorStrong, fontSize: 13, fontWeight: "600" }}>
            {closing ? "…" : t("support.closeTicket", "Close this ticket")}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
