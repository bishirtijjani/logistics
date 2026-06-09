import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme";

export default function LegalScreen({ navigation }) {
  const { t } = useTranslation();
  // Public legal docs are hosted on the marketing site (see /website in this
  // repo, route /legal/[slug]). The URLs are referenced from the App Store
  // privacy questionnaire and the Play Console data-safety form, so they
  // must stay stable across releases - coordinate a migration if the
  // marketing domain ever changes.
  const items = [
    {
      icon: "document-text-outline",
      label: t("legal.terms"),
      url: "https://iprime.ng/legal/terms",
    },
    {
      icon: "shield-outline",
      label: t("legal.privacy"),
      url: "https://iprime.ng/legal/privacy",
    },
  ];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          {t("legal.title")}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.6}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityHint={t("legal.openInBrowser")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: index < items.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <Ionicons name={item.icon} size={19} color={colors.text} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.text,
                }}
              >
                {item.label}
              </Text>
              <Ionicons
                name="open-outline"
                size={17}
                color={colors.textLight}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text
          style={{
            fontSize: 12,
            color: colors.textMuted,
            textAlign: "center",
            marginTop: 24,
            marginHorizontal: 20,
            lineHeight: 18,
          }}
        >
          {t("legal.termsBody")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
