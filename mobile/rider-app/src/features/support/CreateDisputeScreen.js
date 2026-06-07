/**
 * CreateDisputeScreen — rider files a dispute against a delivered request.
 * The route param `requestId` is required. Server enforces:
 *   - rider must be the assigned rider on the request
 *   - request must be DELIVERED or SETTLED
 *   - within the 7-day dispute window
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { chooseImageSource } from "../../lib/chooseImageSource";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { createDispute } from "../../store/slices/supportSlice";
import { pickImage, uploadAttachment } from "./supportUploads";

const CATEGORIES = [
  { value: "ITEM_NOT_RECEIVED", label: "Recipient unavailable" },
  { value: "ITEM_DAMAGED", label: "Items damaged" },
  { value: "ITEM_INCORRECT", label: "Wrong items" },
  { value: "REFUND_REQUEST", label: "Refund issue" },
  { value: "OTHER", label: "Other" },
];

export default function CreateDisputeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const requestId = route.params?.requestId;

  const [category, setCategory] = useState("OTHER");
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
      Toast.show({
        type: "error",
        text1: t("support.uploadFailed", "Photo upload failed"),
        text2: err?.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (url) =>
    setAttachments(attachments.filter((u) => u !== url));

  const submit = async () => {
    if (!requestId) {
      Toast.show({
        type: "error",
        text1: t("support.noRequestSelected", "No order selected. Open the order and tap 'Report an issue'."),
      });
      return;
    }
    if (!reason.trim() || !description.trim()) {
      Toast.show({ type: "error", text1: t("support.fillRequired", "Please fill in all required fields.") });
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
      Toast.show({ type: "success", text1: t("support.disputeFiled", "Dispute filed") });
      navigation.replace("DisputeDetail", { disputeId: result.id });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("support.disputeFailed", "Couldn't file dispute"),
        text2: err?.message || "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!requestId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={36} color={tokens.text.muted} />
          <Text style={{ fontSize: 14, color: tokens.text.muted, textAlign: "center", marginTop: 12 }}>
            {t("support.noRequestSelected", "No order selected. Open the order and tap 'Report an issue'.")}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              marginTop: 16, paddingHorizontal: 20, paddingVertical: 10,
              borderRadius: 10, backgroundColor: tokens.brand.default,
            }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>
              {t("common.back", "Back")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("support.fileDispute", "File dispute")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            marginTop: 16, padding: 12,
            borderRadius: 12, backgroundColor: tokens.status.infoSoft,
            borderWidth: 1, borderColor: tokens.status.infoSoftBorder,
          }}
        >
          <Text style={{ fontSize: 12, color: tokens.text.primary, lineHeight: 18 }}>
            {t("support.disputeIntro", "Disputes are reviewed by our support team. Provide as much evidence as you can.")}
          </Text>
        </View>

        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginTop: 18, marginBottom: 8 }}>
          {t("support.category", "Category")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCategory(c.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
                  backgroundColor: active ? tokens.brand.default : tokens.bg.surface,
                  borderWidth: 1, borderColor: active ? tokens.brand.default : tokens.border.default,
                }}
              >
                <Text style={{ fontSize: 13, color: active ? tokens.text.onBrand : tokens.text.primary, fontWeight: "600" }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>
          {t("support.reason", "Headline")}
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          maxLength={200}
          placeholder={t("support.reasonPlaceholder", "One-line summary, e.g. 'Recipient was rude / unreachable'")}
          placeholderTextColor={tokens.text.placeholder}
          style={{
            backgroundColor: tokens.bg.surface,
            borderWidth: 1, borderColor: tokens.border.default,
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
            fontSize: 14, color: tokens.text.primary, marginBottom: 14,
          }}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>
          {t("support.description", "Describe what happened")}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={5000}
          placeholder={t("support.disputeDescriptionPlaceholder", "Explain what happened. Be specific.")}
          placeholderTextColor={tokens.text.placeholder}
          style={{
            backgroundColor: tokens.bg.surface,
            borderWidth: 1, borderColor: tokens.border.default,
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
            fontSize: 14, color: tokens.text.primary,
            minHeight: 120, textAlignVertical: "top", marginBottom: 14,
          }}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 4 }}>
          {t("support.evidence", "Evidence (photos)")}
        </Text>
        <Text style={{ fontSize: 11, color: tokens.text.muted, marginBottom: 10 }}>
          {t("support.evidenceHint", "Up to 5 photos. Strong evidence helps resolve disputes faster.")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {attachments.map((url) => (
            <View key={url} style={{ position: "relative" }}>
              <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 10 }} />
              <TouchableOpacity
                onPress={() => removeAttachment(url)}
                accessibilityRole="button"
                style={{
                  position: "absolute", top: 2, right: 2,
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: tokens.overlay.scrim,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={14} color={tokens.text.onBrand} />
              </TouchableOpacity>
            </View>
          ))}
          {attachments.length < 5 && (
            <TouchableOpacity
              onPress={() =>
                chooseImageSource(addAttachment("camera"), addAttachment("gallery"), {
                  title: t("support.attachPhoto", "Attach a photo"),
                  camera: t("photo.camera", "Camera"),
                  gallery: t("photo.library", "Photo Library"),
                  cancel: t("photo.cancel", "Cancel"),
                })
              }
              disabled={uploading}
              style={{
                width: 72, height: 72, borderRadius: 10,
                borderWidth: 2, borderColor: tokens.border.default, borderStyle: "dashed",
                alignItems: "center", justifyContent: "center",
                backgroundColor: tokens.bg.surfaceMuted,
              }}
            >
              {uploading ? (
                <ActivityIndicator color={tokens.brand.default} />
              ) : (
                <Ionicons name="camera-outline" size={24} color={tokens.text.muted} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={{
            backgroundColor: tokens.brand.default,
            borderRadius: 14, paddingVertical: 14,
            alignItems: "center",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color={tokens.text.onBrand} />
          ) : (
            <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 15 }}>
              {t("support.fileDispute", "File dispute")}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
