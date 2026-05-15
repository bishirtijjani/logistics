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
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { colors } from "../../theme";
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
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const [category, setCategory] = useState("OTHER");
  const [priority, setPriority] = useState("MEDIUM");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
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
      Toast.show({ type: "error", text1: t("support.uploadFailed"), text2: err?.message });
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (url) => setAttachments(attachments.filter((u) => u !== url));

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      Toast.show({ type: "error", text1: t("support.fillRequired") });
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
      Toast.show({ type: "success", text1: t("support.ticketCreated") });
      navigation.replace("SupportTicketDetail", { ticketId: result.id });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("support.ticketFailed"),
        text2: err?.message || "",
      });
    } finally {
      setSubmitting(false);
    }
  };

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
          {t("support.createTicketTitle")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          {t("support.category")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCategory(c.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 18,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontSize: 13, color: active ? "#fff" : colors.text, fontWeight: "600" }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          {t("support.priority")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {PRIORITIES.map((p) => {
            const active = priority === p.value;
            return (
              <TouchableOpacity
                key={p.value}
                onPress={() => setPriority(p.value)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 12, color: active ? "#fff" : colors.text, fontWeight: "600" }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          {t("support.subject")}
        </Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          maxLength={200}
          placeholder={t("support.subjectPlaceholder")}
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
          numberOfLines={6}
          placeholder={t("support.descriptionPlaceholder")}
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
          {t("support.attachments")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {attachments.map((url) => (
            <View key={url} style={{ position: "relative" }}>
              <Image
                source={{ uri: url }}
                style={{ width: 72, height: 72, borderRadius: 10 }}
              />
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
              {t("support.submit")}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
