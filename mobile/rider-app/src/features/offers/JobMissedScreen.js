import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";

/**
 * Shown when the rider taps an offer push notification AFTER the offer
 * already resolved (taken by another rider, expired, or the rider rejected
 * it before the push arrived). Falls back to Home with a clear explanation
 * so the user isn't dropped onto an empty offer sheet.
 */
export default function JobMissedScreen({ route }) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const reason = route?.params?.reason || "missed";

  const title =
    reason === "expired"
      ? t("offer.missedExpiredTitle", "Offer expired")
      : reason === "taken"
        ? t("offer.missedTakenTitle", "Another rider got it")
        : t("offer.missedTitle", "You missed this one");

  const body =
    reason === "expired"
      ? t(
          "offer.missedExpiredBody",
          "The offer's 60 seconds ran out before you could open it. New offers will appear when you're online.",
        )
      : reason === "taken"
        ? t(
            "offer.missedTakenBody",
            "Another rider accepted before you. Stay online for the next offer.",
          )
        : t(
            "offer.missedBody",
            "This offer is no longer available. Stay online and another one will come along.",
          );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top", "bottom"]}>
      <View style={{ height: 4, backgroundColor: tokens.text.muted }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokens.bg.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Ionicons name="time-outline" size={42} color={tokens.text.muted} />
          </View>

          <Text
            accessibilityRole="header"
            style={{
              fontSize: 26,
              fontWeight: "800",
              color: tokens.text.primary,
              marginBottom: 8,
              textAlign: "center",
              letterSpacing: -0.5,
            }}
          >
            {title}
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: tokens.text.muted,
              textAlign: "center",
              marginBottom: 32,
              lineHeight: 22,
            }}
          >
            {body}
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate("MainTabs", { screen: "HomeTab" })}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: tokens.brand.default,
            }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>
              {t("offer.missedHomeCta", "Back to Home")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
