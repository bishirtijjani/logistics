import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { fetchMessages, sendMessage } from "../../store/slices/tripSlice";

/**
 * ChatThread — modal sheet hosting the in-app chat for the active trip.
 * The notifications bus pipes incoming `request:message:new` events into
 * `tripMessageReceived` so the thread updates in real time. We still
 * dispatch `fetchMessages` on open to make sure historic context is loaded.
 */
export default function ChatThread({ visible, onClose }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const myUserId = useSelector((s) => s.auth?.user?.id);
  const activeRequestId = useSelector((s) => s.trip.activeRequestId);
  const messages = useSelector((s) => s.trip.messages);
  const messagesLoading = useSelector((s) => s.trip.messagesLoading);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (visible && activeRequestId) {
      dispatch(fetchMessages({ requestId: activeRequestId }));
    }
  }, [visible, activeRequestId, dispatch]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeRequestId || sending) return;
    setSending(true);
    try {
      const action = await dispatch(sendMessage({ requestId: activeRequestId, body }));
      if (action.meta.requestStatus === "fulfilled") {
        setDraft("");
        setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
      } else {
        const errMsg = action.payload?.message || t("trip.sendFailedFallback", "Couldn't send message");
        Toast.show({ type: "error", text1: t("trip.sendFailed", "Send failed"), text2: errMsg });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: tokens.overlay.scrim, justifyContent: "flex-end" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            backgroundColor: tokens.bg.surface,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            height: "78%",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row", alignItems: "center",
              paddingHorizontal: 16, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: tokens.border.default,
            }}
          >
            <Ionicons name="chatbubbles" size={20} color={tokens.brand.default} />
            <Text
              accessibilityRole="header"
              style={{ marginLeft: 10, fontWeight: "800", color: tokens.text.primary, flex: 1, fontSize: 16 }}
            >
              {t("trip.chatTitle", "Trip chat")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("trip.closeChat", "Close chat")}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={tokens.text.muted} />
            </TouchableOpacity>
          </View>

          {/* Messages list */}
          {messagesLoading && messages.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={tokens.brand.default} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id || `${m.fromUserId}-${m.createdAt}`}
              contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
              renderItem={({ item }) => <Bubble message={item} myUserId={myUserId} />}
              onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
              ListEmptyComponent={
                <Text style={{ textAlign: "center", color: tokens.text.muted, marginTop: 30 }}>
                  {t("trip.noMessages", "No messages yet. Say hi.")}
                </Text>
              }
            />
          )}

          {/* Composer */}
          <View
            style={{
              flexDirection: "row",
              padding: 10,
              borderTopWidth: 1,
              borderTopColor: tokens.border.default,
              alignItems: "flex-end",
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t("trip.messagePlaceholder", "Write a message…")}
              placeholderTextColor={tokens.text.placeholder}
              multiline
              accessibilityLabel={t("trip.messagePlaceholder", "Write a message…")}
              style={{
                flex: 1,
                maxHeight: 110,
                minHeight: 40,
                backgroundColor: tokens.bg.surfaceMuted,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                color: tokens.text.primary,
              }}
            />
            <TouchableOpacity
              onPress={send}
              disabled={!draft.trim() || sending}
              accessibilityRole="button"
              accessibilityState={{ disabled: !draft.trim() || sending, busy: sending }}
              accessibilityLabel={t("trip.sendMessage", "Send message")}
              style={{
                marginLeft: 8,
                padding: 11,
                borderRadius: 22,
                backgroundColor: (!draft.trim() || sending) ? tokens.border.strong : tokens.brand.default,
              }}
            >
              {sending ? (
                <ActivityIndicator color={tokens.text.onBrand} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={tokens.text.onBrand} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Bubble({ message, myUserId }) {
  const { tokens } = useTheme();
  const isMine = message?.fromUserId === myUserId;
  const roleLabel = (() => {
    const r = message?.fromUser?.role;
    if (!r) return null;
    if (r === "CUSTOMER") return "Customer";
    if (r === "MERCHANT") return "Merchant";
    if (r === "RIDER") return "You";
    if (r === "ADMIN") return "Support";
    return r;
  })();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: isMine ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <View
        style={{
          maxWidth: "80%",
          backgroundColor: isMine ? tokens.brand.default : tokens.bg.surfaceMuted,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 14,
          borderBottomRightRadius: isMine ? 4 : 14,
          borderBottomLeftRadius: isMine ? 14 : 4,
        }}
      >
        {!isMine && roleLabel ? (
          <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.text.muted, marginBottom: 2 }}>
            {roleLabel}
            {message?.fromUser?.firstName ? ` · ${message.fromUser.firstName}` : ""}
          </Text>
        ) : null}
        <Text style={{ color: isMine ? tokens.text.onBrand : tokens.text.primary, fontSize: 14 }}>
          {message?.body}
        </Text>
      </View>
    </View>
  );
}
