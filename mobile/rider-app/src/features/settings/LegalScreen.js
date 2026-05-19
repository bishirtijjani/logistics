/**
 * LegalScreen — links to Terms / Privacy / About via the device's browser.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";

const URLS = {
  terms: "https://iprime.ng/terms",
  privacy: "https://iprime.ng/privacy",
  about: "https://iprime.ng/about",
};

export default function LegalScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const items = [
    { icon: "document-text-outline", label: t("legal.terms", "Terms of Service"), url: URLS.terms },
    { icon: "shield-outline", label: t("legal.privacy", "Privacy Policy"), url: URLS.privacy },
    { icon: "information-circle-outline", label: t("legal.about", "About iPrime"), url: URLS.about },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("legal.title", "Legal")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderRadius: 14,
            borderWidth: 1, borderColor: tokens.border.default,
            overflow: "hidden",
          }}
        >
          {items.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => Linking.openURL(item.url).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityHint={t("legal.openInBrowser", "Open in browser")}
              style={{
                flexDirection: "row", alignItems: "center",
                paddingHorizontal: 14, paddingVertical: 14,
                borderBottomWidth: i < items.length - 1 ? 1 : 0,
                borderBottomColor: tokens.border.subtle,
              }}
            >
              <View
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: tokens.bg.surfaceMuted,
                  alignItems: "center", justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name={item.icon} size={18} color={tokens.text.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
                {item.label}
              </Text>
              <Ionicons name="open-outline" size={16} color={tokens.text.muted} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 16, textAlign: "center" }}>
          {t("legal.termsBody", "Read the full terms in your browser.")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
