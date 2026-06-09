/**
 * CreateTicketScreen - rider-side ticket creation form. Category + priority
 * + subject + description + optional photo attachments. On success, replaces
 * to TicketDetail so the rider can immediately see + reply.
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
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { chooseImageSource } from "../../lib/chooseImageSource";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { createTicket } from "../../store/slices/supportSlice";
import { pickImage, uploadAttachment } from "./supportUploads";

const CATEGORIES = [
  { value: "ACCOUNT", label: "Account" },
  { value: "PAYMENT", label: "Payment" },
  { value: "ORDER", label: "Order" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "PRODUCT", label: "Product" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "OTHER", label: "Other" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export default function CreateTicketScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const presetSubject = route.params?.subject || "";
  const presetCategory = route.params?.category || "DELIVERY";
  const presetDescription = route.params?.description || "";

  const [category, setCategory] = useState(presetCategory);
  const [priority, setPriority] = useState("MEDIUM");
  const [subject, setSubject] = useState(presetSubject);
  const [description, setDescription] = useState(presetDescription);
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addAttachment = (source) => async () => {
    const uri = await pickImage(source);
    if (!uri) return;
    setUploading(true);
    try {
      const url = await uploadAttachment(uri, "ticket");
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
    if (!subject.trim() || !description.trim()) {
      Toast.show({
        type: "error",
        text1: t("support.fillRequired", "Please fill in all required fields."),
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await dispatch(
        createTicket({
          category,
          priority,
          subject: subject.trim(),
          description: description.trim(),
          attachmentUrls: attachments,
        }),
      ).unwrap();
      Toast.show({ type: "success", text1: t("support.ticketCreated", "Ticket created") });
      navigation.replace("TicketDetail", { ticketId: result.id });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("support.ticketFailed", "Couldn't create ticket"),
        text2: err?.message || "",
      });
    } finally {
      setSubmitting(false);
    }
  };

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
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("support.createTicketTitle", "New ticket")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginTop: 16, marginBottom: 8 }}>
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
          {t("support.priority", "Priority")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {PRIORITIES.map((p) => {
            const active = priority === p.value;
            return (
              <TouchableOpacity
                key={p.value}
                onPress={() => setPriority(p.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12,
                  backgroundColor: active ? tokens.brand.default : tokens.bg.surface,
                  borderWidth: 1, borderColor: active ? tokens.brand.default : tokens.border.default,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 12, color: active ? tokens.text.onBrand : tokens.text.primary, fontWeight: "600" }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>
          {t("support.subject", "Subject")}
        </Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          maxLength={200}
          placeholder={t("support.subjectPlaceholder", "Short summary of the issue")}
          placeholderTextColor={tokens.text.placeholder}
          accessibilityLabel={t("support.subject", "Subject")}
          style={{
            backgroundColor: tokens.bg.surface,
            borderWidth: 1, borderColor: tokens.border.default,
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
            fontSize: 14, color: tokens.text.primary, marginBottom: 14,
          }}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>
          {t("support.description", "Describe the issue")}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={5000}
          numberOfLines={6}
          placeholder={t("support.descriptionPlaceholder", "Explain in as much detail as you can. Screenshots help.")}
          placeholderTextColor={tokens.text.placeholder}
          accessibilityLabel={t("support.description", "Describe the issue")}
          style={{
            backgroundColor: tokens.bg.surface,
            borderWidth: 1, borderColor: tokens.border.default,
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
            fontSize: 14, color: tokens.text.primary,
            minHeight: 120, textAlignVertical: "top", marginBottom: 14,
          }}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>
          {t("support.attachments", "Attachments")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {attachments.map((url) => (
            <View key={url} style={{ position: "relative" }}>
              <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 10 }} />
              <TouchableOpacity
                onPress={() => removeAttachment(url)}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.removePhoto", "Remove photo")}
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
              accessibilityRole="button"
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
              {t("support.submit", "Submit ticket")}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
