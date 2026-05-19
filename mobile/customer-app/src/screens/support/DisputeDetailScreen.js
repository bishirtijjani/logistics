import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
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
import { colors } from "../../theme";
import SupportThread from "./SupportThread";
import {
  fetchDisputeDetail,
  postDisputeMessage,
  clearDisputeDetail,
} from "../../store/slices/supportSlice";

const statusColor = (status) => {
  switch (status) {
    case "OPEN": return "#DC2626";
    case "UNDER_REVIEW": return "#D97706";
    case "AWAITING_RESPONSE": return "#B45309";
    case "RESOLVED": return "#059669";
    case "REJECTED": return "#6B7280";
    default: return colors.textMuted;
  }
};

const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

export default function DisputeDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { disputeId } = route.params || {};
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { disputeDetail, disputeDetailLoading } = useSelector((s) => s.support);
  const currentUserId = useSelector((s) => s.auth.user?.id);

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
      Toast.show({ type: "error", text1: err?.message || t("support.sendFailed") });
    } finally {
      setPosting(false);
    }
  };

  if (disputeDetailLoading || !disputeDetail) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isClosed = ["RESOLVED", "REJECTED"].includes(disputeDetail.status);

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
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
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
              {t("support.disputeNumber")} #{disputeDetail.number}
            </Text>
            <Text
              style={{ fontSize: 16, fontWeight: "800", color: colors.text }}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {disputeDetail.reason}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: statusColor(disputeDetail.status),
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {disputeDetail.status.replace(/_/g, " ")}
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
          {disputeDetail.description}
        </Text>
        {Array.isArray(disputeDetail.attachmentUrls) &&
          disputeDetail.attachmentUrls.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {disputeDetail.attachmentUrls.map((url, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => Linking.openURL(url).catch(() => {})}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={t("support.thread.attachmentA11y")}
                >
                  <Image
                    source={{ uri: url }}
                    style={{ width: 64, height: 64, borderRadius: 8 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
      </View>

      {disputeDetail.resolution && (
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
            {t("support.outcome")}: {disputeDetail.resolution.replace(/_/g, " ")}
          </Text>
          {disputeDetail.resolutionNotes && (
            <Text style={{ fontSize: 13, color: "#064E3B", marginTop: 4 }}>
              {disputeDetail.resolutionNotes}
            </Text>
          )}
          {disputeDetail.refundAmount && (
            <Text style={{ fontSize: 13, color: "#065F46", marginTop: 4, fontWeight: "700" }}>
              {naira(disputeDetail.refundAmount)} {t("support.refundedToWallet")}
            </Text>
          )}
          {disputeDetail.refundTransaction?.reference && (
            <Text style={{ fontSize: 11, color: "#065F46", marginTop: 2 }}>
              Ref: {disputeDetail.refundTransaction.reference}
            </Text>
          )}
        </View>
      )}

      <SupportThread
        messages={disputeDetail.messages || []}
        currentUserId={currentUserId}
        canPost={!isClosed}
        posting={posting}
        onSubmit={handleSubmit}
        placeholder={t("support.replyPlaceholder")}
      />
    </SafeAreaView>
  );
}
