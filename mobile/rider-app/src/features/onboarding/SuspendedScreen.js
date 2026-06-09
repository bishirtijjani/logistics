import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { logout } from "../../store/slices/authSlice";

/**
 * Shown when `Rider.status === SUSPENDED`. Suspension is admin-driven (or
 * automatic when performance metrics breach a threshold - Phase 7 work).
 * Rider can read the reason and open a support ticket to appeal.
 */
export default function SuspendedScreen() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const reason = useSelector((s) => s.rider?.rider?.suspensionReason);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <View style={{ height: 4, backgroundColor: tokens.status.warningStrong }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokens.status.warningSoft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Ionicons name="pause-circle-outline" size={48} color={tokens.status.warningStrong} />
          </View>

          <Text
            accessibilityRole="header"
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: tokens.text.primary,
              marginBottom: 8,
              textAlign: "center",
              letterSpacing: -0.5,
            }}
          >
            {t("onboarding.suspendedTitle", "Account suspended")}
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: tokens.text.muted,
              textAlign: "center",
              marginBottom: 24,
              lineHeight: 22,
            }}
          >
            {t(
              "onboarding.suspendedBody",
              "Your rider account has been suspended. You can't take new jobs while suspended. Open a support ticket to appeal.",
            )}
          </Text>

          {reason ? (
            <View
              style={{
                padding: 16,
                borderRadius: 12,
                backgroundColor: tokens.status.warningSoft,
                width: "100%",
                marginBottom: 32,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.status.warningStrong, marginBottom: 4 }}>
                {t("onboarding.suspendedReasonLabel", "Reason")}
              </Text>
              <Text style={{ fontSize: 14, color: tokens.text.primary, lineHeight: 20 }}>
                {reason}
              </Text>
            </View>
          ) : (
            <View style={{ marginBottom: 32 }} />
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate("CreateTicket", { category: "SUSPENSION_APPEAL" })}
            accessibilityRole="button"
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: tokens.brand.default,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: tokens.text.onBrand, fontSize: 15, fontWeight: "800" }}>
              {t("onboarding.suspendedAppealCta", "Open support ticket")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => dispatch(logout())}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tokens.border.default,
            }}
          >
            <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>
              {t("common.signOut", "Sign out")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
