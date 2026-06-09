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
    case "UNDER_REVIEW": return tokens.status.warning;
    case "AWAITING_RESPONSE": return tokens.status.warningStrong;
    case "RESOLVED": return tokens.status.successStrong;
    case "REJECTED": return tokens.text.muted;
    default: return tokens.text.muted;
  }
};

const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

export default function DisputeDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { disputeId } = route.params || {};
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
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
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.brand.default} />
        </View>
      </SafeAreaView>
    );
  }

  const isClosed = ["RESOLVED", "REJECTED"].includes(disputeDetail.status);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

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
              backgroundColor: tokens.bg.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: tokens.text.muted }}>
              {t("support.disputeNumber")} #{disputeDetail.number}
            </Text>
            <Text
              style={{ fontSize: 16, fontWeight: "800", color: tokens.text.primary }}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {disputeDetail.reason}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: statusColor(disputeDetail.status, tokens),
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontSize: 10, fontWeight: "700" }}>
            {disputeDetail.status.replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginHorizontal: 20,
          marginBottom: 8,
          padding: 12,
          backgroundColor: tokens.bg.surfaceMuted,
          borderRadius: 12,
        }}
      >
        <Text style={{ fontSize: 13, color: tokens.text.primary, lineHeight: 18 }}>
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
            backgroundColor: tokens.status.successSoft,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.status.successStrong }}>
            {t("support.outcome")}: {disputeDetail.resolution.replace(/_/g, " ")}
          </Text>
          {disputeDetail.resolutionNotes && (
            <Text style={{ fontSize: 13, color: tokens.status.successStrong, marginTop: 4 }}>
              {disputeDetail.resolutionNotes}
            </Text>
          )}
          {disputeDetail.refundAmount && (
            <Text style={{ fontSize: 13, color: tokens.status.successStrong, marginTop: 4, fontWeight: "700" }}>
              {naira(disputeDetail.refundAmount)} {t("support.refundedToWallet")}
            </Text>
          )}
          {disputeDetail.refundTransaction?.reference && (
            <Text style={{ fontSize: 11, color: tokens.status.successStrong, marginTop: 2 }}>
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
