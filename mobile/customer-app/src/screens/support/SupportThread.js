import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";

const initials = (u) =>
  `${u?.firstName?.[0] || ""}${u?.lastName?.[0] || ""}`.toUpperCase() || "?";

const roleLabelKey = (role) => {
  if (role === "ADMIN") return "support.thread.roleSupport";
  if (role === "MERCHANT") return "support.thread.roleMerchant";
  if (role === "RIDER") return "support.thread.roleRider";
  return "support.thread.you";
};

function MessageBubble({ message, currentUserId }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const isMine = message.fromUserId === currentUserId;
  const isInternal = message.isInternal;
  const senderName = isMine
    ? t("support.thread.you")
    : `${message.fromUser?.firstName || ""} ${message.fromUser?.lastName || ""}`.trim() || t(roleLabelKey(message.fromUser?.role));
  const roleText = t(roleLabelKey(message.fromUser?.role));
  return (
    <View
      style={{
        flexDirection: isMine ? "row-reverse" : "row",
        marginVertical: 6,
        paddingHorizontal: 12,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: tokens.bg.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
          marginHorizontal: 8,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.text.primary }}>
          {initials(message.fromUser)}
        </Text>
      </View>
      <View
        style={{
          maxWidth: "78%",
          alignItems: isMine ? "flex-end" : "flex-start",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 3,
          }}
        >
          <Text
            style={{ fontSize: 11, color: tokens.text.muted, fontWeight: "600" }}
            accessibilityRole="text"
          >
            {senderName}
          </Text>
          <Text style={{ fontSize: 10, color: tokens.text.muted, marginLeft: 6 }}>
            · {roleText}
          </Text>
          {isInternal && (
            <Text style={{ fontSize: 10, color: tokens.status.warningStrong, marginLeft: 6 }}>
              · {t("support.thread.internalTag")}
            </Text>
          )}
        </View>
        <View
          style={{
            backgroundColor: isInternal
              ? tokens.status.warningSoft
              : isMine
                ? tokens.brand.default
                : tokens.bg.surface,
            borderColor: isInternal ? tokens.status.warning : tokens.border.default,
            borderWidth: isInternal ? 1 : 0,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isMine && !isInternal ? tokens.text.onBrand : tokens.text.primary,
              lineHeight: 20,
            }}
          >
            {message.body}
          </Text>
        </View>
        {Array.isArray(message.attachmentUrls) && message.attachmentUrls.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6, gap: 6 }}>
            {message.attachmentUrls.map((url, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => Linking.openURL(url).catch(() => {})}
                accessibilityRole="imagebutton"
                accessibilityLabel={t("support.thread.attachmentA11y")}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: tokens.bg.surfaceMuted,
                }}
              >
                <Image source={{ uri: url }} style={{ width: 60, height: 60 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={{ fontSize: 10, color: tokens.text.muted, marginTop: 3 }}>
          {new Date(message.createdAt).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

export default function SupportThread({
  messages = [],
  currentUserId,
  canPost = true,
  posting = false,
  onSubmit,
  placeholder,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [body, setBody] = useState("");
  const listRef = useRef(null);
  const resolvedPlaceholder = placeholder || t("support.thread.messagePh");

  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      setTimeout(() => {
        try {
          listRef.current.scrollToEnd({ animated: true });
        } catch (_) {}
      }, 100);
    }
  }, [messages.length]);

  const submit = async () => {
    if (!body.trim() || posting) return;
    await onSubmit({ body: body.trim() });
    setBody("");
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MessageBubble message={item} currentUserId={currentUserId} />
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 13, color: tokens.text.muted }}>
              {t("support.thread.noMessages")}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 12 }}
      />

      {canPost && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderTopWidth: 1,
              borderTopColor: tokens.border.default,
              backgroundColor: tokens.bg.surface,
            }}
          >
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={resolvedPlaceholder}
              placeholderTextColor={tokens.text.muted}
              multiline
              maxLength={2000}
              accessibilityLabel={resolvedPlaceholder}
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 120,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: tokens.bg.surfaceMuted,
                borderRadius: 20,
                fontSize: 14,
                color: tokens.text.primary,
              }}
            />
            <TouchableOpacity
              onPress={submit}
              disabled={posting || !body.trim()}
              accessibilityRole="button"
              accessibilityLabel={t("support.thread.sendA11y")}
              accessibilityState={{ disabled: posting || !body.trim(), busy: posting }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: tokens.brand.default,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 8,
                opacity: posting || !body.trim() ? 0.5 : 1,
              }}
            >
              {posting ? (
                <ActivityIndicator color={tokens.text.onBrand} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={tokens.text.onBrand} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
