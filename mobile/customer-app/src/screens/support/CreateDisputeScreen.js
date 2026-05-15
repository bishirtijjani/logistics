import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { colors } from "../../theme";
import { createDispute } from "../../store/slices/supportSlice";
import { pickImage, uploadAttachment } from "./supportUploads";

const DISPUTE_CATEGORIES = [
  { value: "ITEM_NOT_RECEIVED", label: "Item not received" },
  { value: "ITEM_DAMAGED", label: "Item damaged" },
  { value: "WRONG_ITEM", label: "Wrong item" },
  { value: "PARTIAL_DELIVERY", label: "Partial delivery" },
  { value: "RIDER_BEHAVIOR", label: "Rider behavior" },
  { value: "MERCHANT_BEHAVIOR", label: "Merchant behavior" },
  { value: "PAYMENT_ISSUE", label: "Payment issue" },
  { value: "OTHER", label: "Other" },
];

export default function CreateDisputeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { requestId } = route.params || {};
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const [category, setCategory] = useState("ITEM_NOT_RECEIVED");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addAttachment = (source) => async () => {
    const uri = await pickImage(source);
    if (!uri) return;
    setUploading(true);
    try {
      const url = await uploadAttachment(uri, "dispute");
      setAttachments((prev) => [...prev, url]);
    } catch (err) {
      Toast.show({ type: "error", text1: t("support.uploadFailed"), text2: err?.message });
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (url) => setAttachments(attachments.filter((u) => u !== url));

  const submit = async () => {
    if (!reason.trim() || !description.trim()) {
      Toast.show({ type: "error", text1: t("support.fillRequired") });
      return;
    }
    setSubmitting(true);
    try {
      const result = await dispatch(
        createDispute({
          requestId,
          category,
          reason: reason.trim(),
          description: description.trim(),
          attachmentUrls: attachments,
        }),
      ).unwrap();
      Toast.show({ type: "success", text1: t("support.disputeFiled") });
      navigation.replace("SupportDisputeDetail", { disputeId: result.id });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("support.disputeFailed"),
        text2: err?.message || "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!requestId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ height: 4, backgroundColor: colors.primary }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="information-circle-outline" size={48} color={colors.textLight} />
          <Text
            style={{
              color: colors.textMuted,
              textAlign: "center",
              marginTop: 12,
              fontSize: 14,
            }}
          >
            {t("support.noRequestSelected")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
        }}
      >
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
          {t("support.reportIssue")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: "#FEF3C7",
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            flexDirection: "row",
          }}
        >
          <Ionicons name="warning-outline" size={18} color="#92400E" style={{ marginRight: 8 }} />
          <Text style={{ flex: 1, fontSize: 12, color: "#92400E", lineHeight: 18 }}>
            {t("support.disputeIntro")}
          </Text>
        </View>

        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          {t("support.category")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {DISPUTE_CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCategory(c.value)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 18,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontSize: 12, color: active ? "#fff" : colors.text, fontWeight: "600" }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          {t("support.reason")}
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          maxLength={200}
          placeholder={t("support.reasonPlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
            color: colors.text,
            marginBottom: 16,
          }}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          {t("support.description")}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={5000}
          placeholder={t("support.disputeDescriptionPlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
            color: colors.text,
            minHeight: 120,
            textAlignVertical: "top",
            marginBottom: 16,
          }}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          {t("support.evidence")}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
          {t("support.evidenceHint")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {attachments.map((url) => (
            <View key={url} style={{ position: "relative" }}>
              <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 10 }} />
              <TouchableOpacity
                onPress={() => removeAttachment(url)}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: "rgba(0,0,0,0.65)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {attachments.length < 5 && (
            <TouchableOpacity
              onPress={() =>
                Alert.alert(t("support.attachPhoto"), undefined, [
                  { text: t("photo.camera"), onPress: addAttachment("camera") },
                  { text: t("photo.library"), onPress: addAttachment("gallery") },
                  { text: t("photo.cancel"), style: "cancel" },
                ])
              }
              disabled={uploading}
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: colors.border,
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surfaceMuted,
              }}
            >
              {uploading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={submitting}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {t("support.fileDispute")}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
