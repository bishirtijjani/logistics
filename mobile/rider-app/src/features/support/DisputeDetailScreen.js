/**
 * DisputeDetailScreen — thread + composer for a single dispute. Read-only
 * once status is RESOLVED or REJECTED.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
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
  fetchDisputeDetail,
  postDisputeMessage,
  clearDisputeDetail,
} from "../../store/slices/supportSlice";

const statusColor = (status, tokens) => {
  switch (status) {
    case "OPEN": return tokens.status.errorStrong;
    case "UNDER_REVIEW": return tokens.status.warningStrong;
    case "AWAITING_RESPONSE": return tokens.status.warning;
    case "RESOLVED": return tokens.status.successStrong;
    case "REJECTED": return tokens.text.muted;
    default: return tokens.text.muted;
  }
};

export default function DisputeDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { disputeId } = route.params || {};
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const dispute = useSelector((s) => s.support?.disputeDetail);
  const loading = useSelector((s) => s.support?.disputeDetailLoading);
  const currentUserId = useSelector((s) => s.auth?.user?.id);

  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (disputeId) dispatch(fetchDisputeDetail(disputeId));
    return () => dispatch(clearDisputeDetail());
  }, [dispatch, disputeId]);

  const handleSubmit = async ({ body }) => {
    setPosting(true);
    try {
      await dispatch(postDisputeMessage({ disputeId, body })).unwrap();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: err?.message || t("support.sendFailed", "Failed to send"),
      });
    } finally {
      setPosting(false);
    }
  };

  if (loading || !dispute) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.brand.default} />
        </View>
      </SafeAreaView>
    );
  }

  const closed = ["RESOLVED", "REJECTED"].includes(dispute.status);

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
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={{ fontSize: 11, color: tokens.text.muted }}>
              {t("support.disputeNumber", "Dispute")} #{dispute.number}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary }} numberOfLines={1} accessibilityRole="header">
              {dispute.reason || dispute.description?.slice(0, 60)}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: statusColor(dispute.status, tokens),
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontSize: 10, fontWeight: "700" }}>
            {String(dispute.status || "").replace(/_/g, " ")}
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
          {dispute.description}
        </Text>
        {Array.isArray(dispute.attachmentUrls) && dispute.attachmentUrls.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {dispute.attachmentUrls.map((url, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => Linking.openURL(url).catch(() => {})}
              >
                <Image source={{ uri: url }} style={{ width: 64, height: 64, borderRadius: 8 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {dispute.resolutionNotes ? (
        <View
          style={{
            marginHorizontal: 14, marginTop: 8,
            padding: 12,
            backgroundColor: dispute.status === "RESOLVED" ? tokens.status.successSoft : tokens.bg.surfaceMuted,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: dispute.status === "RESOLVED" ? tokens.status.successStrong : tokens.text.primary }}>
            {t("support.outcome", "Outcome")}: {String(dispute.resolution || "").replace(/_/g, " ")}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.text.primary, marginTop: 4 }}>
            {dispute.resolutionNotes}
          </Text>
          {dispute.refundAmount ? (
            <Text style={{ fontSize: 13, color: tokens.status.successStrong, marginTop: 4, fontWeight: "700" }}>
              ₦{Number(dispute.refundAmount).toLocaleString("en-NG")} {t("support.refundedToWallet", "credited to your wallet")}
            </Text>
          ) : null}
        </View>
      ) : null}

      <SupportThread
        messages={dispute.messages || []}
        currentUserId={currentUserId}
        canPost={!closed}
        posting={posting}
        onSubmit={handleSubmit}
        placeholder={t("support.replyPlaceholder", "Type a reply...")}
      />
    </SafeAreaView>
  );
}
