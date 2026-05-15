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
import { colors } from "../../theme";

const initials = (u) =>
  `${u?.firstName?.[0] || ""}${u?.lastName?.[0] || ""}`.toUpperCase() || "?";

const roleLabel = (role) => {
  if (role === "ADMIN") return "Support";
  if (role === "MERCHANT") return "Merchant";
  if (role === "RIDER") return "Rider";
  return "You";
};

function MessageBubble({ message, currentUserId }) {
  const isMine = message.fromUserId === currentUserId;
  const isInternal = message.isInternal;
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
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
          marginHorizontal: 8,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>
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
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600" }}>
            {isMine ? "You" : `${message.fromUser?.firstName || ""} ${message.fromUser?.lastName || ""}`}
          </Text>
          <Text style={{ fontSize: 10, color: colors.textLight, marginLeft: 6 }}>
            · {roleLabel(message.fromUser?.role)}
          </Text>
          {isInternal && (
            <Text style={{ fontSize: 10, color: "#92400E", marginLeft: 6 }}>
              · INTERNAL
            </Text>
          )}
        </View>
        <View
          style={{
            backgroundColor: isInternal
              ? "#FEF3C7"
              : isMine
                ? colors.primary
                : colors.surface,
            borderColor: isInternal ? "#FCD34D" : colors.border,
            borderWidth: isInternal ? 1 : 0,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isMine && !isInternal ? "#fff" : colors.text,
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
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Image source={{ uri: url }} style={{ width: 60, height: 60 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 3 }}>
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
  placeholder = "Type a message...",
}) {
  const [body, setBody] = useState("");
  const listRef = useRef(null);

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
            <Text style={{ fontSize: 13, color: colors.textMuted }}>
              No messages yet. Start the conversation.
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
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 120,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: colors.surfaceMuted,
                borderRadius: 20,
                fontSize: 14,
                color: colors.text,
              }}
            />
            <TouchableOpacity
              onPress={submit}
              disabled={posting || !body.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 8,
                opacity: posting || !body.trim() ? 0.5 : 1,
              }}
            >
              {posting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
