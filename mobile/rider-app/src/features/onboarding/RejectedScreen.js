import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { logout } from "../../store/slices/authSlice";
import { onboardingStepSet } from "../../store/slices/onboardingSlice";

/**
 * Shown when `Rider.status === REJECTED`. The rejection reason (if the backend
 * surfaces one on `Rider.rejectionReason` — surfaced as part of BLK-RiderKycExpansion)
 * renders inline. Tapping "Re-apply" sets onboarding step back to Documents
 * with the previous draft preserved.
 */
export default function RejectedScreen() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const reason = useSelector((s) => s.rider?.rider?.rejectionReason);

  const onReapply = () => {
    dispatch(onboardingStepSet(2)); // Documents step — pre-loaded with the previous draft.
    navigation.navigate("BecomeRiderDocuments");
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <View style={{ height: 4, backgroundColor: tokens.status.error }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokens.status.errorSoft,
              borderWidth: 1,
              borderColor: tokens.status.errorSoftBorder,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Ionicons name="close-circle-outline" size={48} color={tokens.status.errorStrong} />
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
            {t("onboarding.rejectedTitle", "Application rejected")}
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: tokens.text.muted,
              textAlign: "center",
              marginBottom: 16,
              lineHeight: 22,
            }}
          >
            {t(
              "onboarding.rejectedBody",
              "Your rider application wasn't approved. Review the reason below and re-submit the affected documents to try again.",
            )}
          </Text>

          {reason ? (
            <View
              style={{
                padding: 16,
                borderRadius: 12,
                backgroundColor: tokens.status.errorSoft,
                borderWidth: 1,
                borderColor: tokens.status.errorSoftBorder,
                width: "100%",
                marginBottom: 32,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.status.errorStrong, marginBottom: 4 }}>
                {t("onboarding.rejectedReasonLabel", "Reason from reviewer")}
              </Text>
              <Text style={{ fontSize: 14, color: tokens.text.primary, lineHeight: 20 }}>
                {reason}
              </Text>
            </View>
          ) : (
            <View style={{ marginBottom: 32 }} />
          )}

          <TouchableOpacity
            onPress={onReapply}
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
              {t("onboarding.rejectedReapplyCta", "Re-apply")}
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
