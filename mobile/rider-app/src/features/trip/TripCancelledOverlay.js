import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { acknowledgeCancellation } from "../../store/slices/tripSlice";
import { setOnDelivery } from "../../store/slices/riderSlice";

/**
 * Non-dismissible banner shown when an external party (admin, customer, etc.)
 * cancels the active trip while the rider is in the cockpit. Tapping
 * "Back to Home" wipes the trip state and the navigator routes the rider
 * back to MainTabs/HomeTab via the conditional Trip tab in MainTabNavigator.
 */
export default function TripCancelledOverlay() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const cancelled = useSelector((s) => s.trip.cancelled);

  if (!cancelled) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.overlay.scrim,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%", maxWidth: 360,
            backgroundColor: tokens.bg.surface,
            borderRadius: 16, padding: 22,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 56, height: 56, borderRadius: 28,
              alignItems: "center", justifyContent: "center",
              backgroundColor: tokens.status.errorSoft,
              borderWidth: 1, borderColor: tokens.status.errorSoftBorder,
              marginBottom: 14,
            }}
          >
            <Ionicons name="close-circle" size={32} color={tokens.status.errorStrong} />
          </View>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, textAlign: "center" }}
          >
            {t("trip.cancelled.title", "Trip cancelled")}
          </Text>
          <Text
            style={{ marginTop: 8, fontSize: 14, color: tokens.text.muted, textAlign: "center" }}
            numberOfLines={3}
          >
            {cancelled.reason || t("trip.cancelled.fallback", "This trip was cancelled.")}
          </Text>
          {cancelled.cancelledBy ? (
            <Text style={{ marginTop: 4, fontSize: 12, color: tokens.text.placeholder, textAlign: "center" }}>
              {t("trip.cancelled.by", "by {{actor}}", { actor: cancelled.cancelledBy })}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              dispatch(setOnDelivery(false)).catch?.(() => {});
              dispatch(acknowledgeCancellation());
            }}
            accessibilityRole="button"
            accessibilityLabel={t("trip.cancelled.backAria", "Back to Home")}
            style={{
              marginTop: 22, alignSelf: "stretch",
              paddingVertical: 13, borderRadius: 12,
              alignItems: "center",
              backgroundColor: tokens.brand.default,
            }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
              {t("trip.cancelled.back", "Back to Home")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
