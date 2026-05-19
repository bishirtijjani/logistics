import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";

/**
 * ContactPartiesSheet — bottom sheet with two rows: Call + Chat.
 * The cockpit picks which counterparty to surface based on the active stage
 * (pickup → merchant/sender, dropoff → customer/recipient).
 */
export default function ContactPartiesSheet({
  visible,
  onClose,
  counterpartName,
  counterpartPhone,
  callAttempts = 0,
  onCall,
  onChat,
  onReportUnreachable,
}) {
  const { tokens } = useTheme();
  const { t } = useT();
  // Stage 1: a single failed attempt isn't enough to nudge. After 3 we
  // surface the "Customer not reachable?" CTA — matches roadmap.
  const showUnreachableCta = callAttempts >= 3;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: tokens.overlay.scrim, justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28,
          }}
        >
          {/* Grab handle */}
          <View
            style={{
              alignSelf: "center", width: 38, height: 4, borderRadius: 2,
              backgroundColor: tokens.border.strong, marginBottom: 14,
            }}
          />
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary, marginBottom: 4 }}>
            {t("trip.contact.title", "Contact {{name}}", { name: counterpartName || t("trip.contact.fallbackName", "party") })}
          </Text>
          {counterpartPhone ? (
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 16 }}>
              {counterpartPhone}
            </Text>
          ) : (
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 16 }}>
              {t("trip.contact.noPhone", "No phone number on file — try chat.")}
            </Text>
          )}

          {counterpartPhone ? (
            <TouchableOpacity
              onPress={onCall}
              accessibilityRole="button"
              accessibilityLabel={`${t("trip.contact.callAriaPrefix", "Call")} ${counterpartName || t("trip.contact.fallbackName", "party")}`}
              style={{
                flexDirection: "row", alignItems: "center",
                paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12,
                backgroundColor: tokens.brand.soft, borderWidth: 1, borderColor: tokens.brand.softBorder,
                marginBottom: 10,
              }}
            >
              <Ionicons name="call" size={22} color={tokens.brand.strong} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>{t("trip.contact.call", "Call")}</Text>
                <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                  {t("trip.contact.callSub", "Opens your phone dialer")}
                </Text>
              </View>
              {callAttempts > 0 ? (
                <View
                  style={{
                    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
                    backgroundColor: tokens.bg.surface,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.text.muted }}>
                    {t("trip.contact.tried", "Tried {{count}}×", { count: callAttempts })}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={onChat}
            accessibilityRole="button"
            accessibilityLabel={t("trip.contact.chatAria", "Open chat thread")}
            style={{
              flexDirection: "row", alignItems: "center",
              paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12,
              backgroundColor: tokens.bg.surfaceMuted, borderWidth: 1, borderColor: tokens.border.default,
            }}
          >
            <Ionicons name="chatbubbles-outline" size={22} color={tokens.text.primary} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>{t("trip.contact.chat", "Chat")}</Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                {t("trip.contact.chatSub", "Message inside the app")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
          </TouchableOpacity>

          {showUnreachableCta ? (
            <TouchableOpacity
              onPress={onReportUnreachable}
              accessibilityRole="button"
              accessibilityLabel={t("trip.contact.unreachableAria", "Report customer unreachable to support")}
              style={{
                flexDirection: "row", alignItems: "center",
                paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
                backgroundColor: tokens.status.errorSoft, borderWidth: 1, borderColor: tokens.status.errorSoftBorder,
                marginTop: 14,
              }}
            >
              <Ionicons name="warning" size={20} color={tokens.status.errorStrong} />
              <Text style={{ marginLeft: 10, color: tokens.status.errorStrong, fontWeight: "700", fontSize: 13, flex: 1 }}>
                {t("trip.contact.unreachable", "Can't reach them? Open a support ticket")}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={tokens.status.errorStrong} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("trip.contact.close", "Close")}
            style={{ alignSelf: "center", marginTop: 18, padding: 8 }}
          >
            <Text style={{ fontSize: 14, color: tokens.text.muted, fontWeight: "600" }}>{t("trip.contact.close", "Close")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
