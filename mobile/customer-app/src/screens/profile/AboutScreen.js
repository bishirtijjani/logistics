import React from "react";
import { goBackOr } from "../../lib/goBack";
import { View, Text, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";

export default function AboutScreen({ navigation }) {
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={tokens.bg.canvas}
      />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: tokens.text.primary,
            letterSpacing: -0.5,
          }}
        >
          {t("about.title")}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 40,
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 22,
            backgroundColor: tokens.bg.elevated,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Ionicons name="cube" size={42} color={tokens.brand.default} />
        </View>

        <Text
          style={{
            fontSize: 24,
            fontFamily: "Roboto_700Bold",
            color: tokens.text.primary,
            marginBottom: 4,
          }}
        >
          {t("about.appName")}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: tokens.text.muted,
            marginBottom: 24,
          }}
        >
          {t("about.version", { version: "1.0.0" })} ({t("about.build", { build: "1" })})
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: tokens.text.muted,
            textAlign: "center",
            lineHeight: 22,
            marginBottom: 32,
          }}
        >
          {t("about.tagline")}
        </Text>

        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: tokens.border.default,
            width: "100%",
            padding: 16,
          }}
        >
          {[
            { label: "Platform", value: "React Native + Expo" },
            { label: "Backend", value: "Node.js + PostgreSQL" },
            { label: "Region", value: "Nigeria" },
          ].map((item, index) => (
            <View
              key={item.label}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 8,
                borderBottomWidth: index < 2 ? 1 : 0,
                borderBottomColor: tokens.border.default,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: tokens.text.muted,
                  fontWeight: "600",
                }}
              >
                {item.label}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: tokens.text.primary,
                  fontWeight: "600",
                }}
              >
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text
        style={{
          textAlign: "center",
          color: tokens.text.muted,
          fontSize: 12,
          paddingBottom: 24,
        }}
      >
        {"\u00A9"} 2026 QuickDrop. All rights reserved.
      </Text>
    </SafeAreaView>
  );
}
