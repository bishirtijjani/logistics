import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";

/**
 * ChatChannelPicker - the persistent chat icon in the cockpit header opens
 * this instead of a thread directly, since a rider has two private channels
 * per trip (CUSTOMER_RIDER, RIDER_MERCHANT) and isn't limited to only the
 * one implied by the current pickup/dropoff stage - ContactPartiesSheet's
 * "Chat" row remains the fast path for that stage-implied counterpart, this
 * is for reaching the other one too (e.g. messaging the merchant about a
 * substitution while already en route to the customer).
 */
export default function ChatChannelPicker({ visible, onClose, hasMerchant, unreadCustomer = 0, unreadMerchant = 0, onPickCustomer, onPickMerchant }) {
  const { tokens } = useTheme();
  const { t } = useT();

  const UnreadBadge = ({ count }) => (
    count > 0 ? (
      <View
        style={{
          minWidth: 18, height: 18, paddingHorizontal: 5, marginRight: 6,
          borderRadius: 9, backgroundColor: tokens.status.error,
          alignItems: "center", justifyContent: "center",
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={{ color: tokens.text.onBrand, fontSize: 10, fontWeight: "800" }}>
          {count > 99 ? "99+" : count}
        </Text>
      </View>
    ) : null
  );

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
          <View
            style={{
              alignSelf: "center", width: 38, height: 4, borderRadius: 2,
              backgroundColor: tokens.border.strong, marginBottom: 14,
            }}
          />
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary, marginBottom: 16 }}>
            {t("trip.chatPicker.title", "Who do you want to message?")}
          </Text>

          <TouchableOpacity
            onPress={onPickCustomer}
            accessibilityRole="button"
            accessibilityLabel={t("trip.chatPicker.customerAria", "Message customer")}
            style={{
              flexDirection: "row", alignItems: "center",
              paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12,
              backgroundColor: tokens.bg.surfaceMuted, borderWidth: 1, borderColor: tokens.border.default,
              marginBottom: 10,
            }}
          >
            <Ionicons name="person-outline" size={22} color={tokens.text.primary} />
            <Text style={{ marginLeft: 12, flex: 1, fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>
              {t("trip.chatPicker.customer", "Message customer")}
            </Text>
            <UnreadBadge count={unreadCustomer} />
            <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
          </TouchableOpacity>

          {hasMerchant ? (
            <TouchableOpacity
              onPress={onPickMerchant}
              accessibilityRole="button"
              accessibilityLabel={t("trip.chatPicker.merchantAria", "Message merchant")}
              style={{
                flexDirection: "row", alignItems: "center",
                paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12,
                backgroundColor: tokens.bg.surfaceMuted, borderWidth: 1, borderColor: tokens.border.default,
              }}
            >
              <Ionicons name="storefront-outline" size={22} color={tokens.text.primary} />
              <Text style={{ marginLeft: 12, flex: 1, fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>
                {t("trip.chatPicker.merchant", "Message merchant")}
              </Text>
              <UnreadBadge count={unreadMerchant} />
              <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
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
