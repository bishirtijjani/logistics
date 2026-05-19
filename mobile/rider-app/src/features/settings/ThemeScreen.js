/**
 * ThemeScreen — pick app appearance (system / light / dark). Wraps the
 * ThemeProvider's `setMode` so the choice persists via AsyncStorage.
 */

import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";

const MODES = [
  { code: "system", icon: "phone-portrait-outline", labelKey: "profile.themeSystem", fallback: "System default" },
  { code: "light", icon: "sunny-outline", labelKey: "profile.themeLight", fallback: "Light" },
  { code: "dark", icon: "moon-outline", labelKey: "profile.themeDark", fallback: "Dark" },
];

export default function ThemeScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tokens, mode, setMode } = useTheme();

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
          {t("profile.theme", "Appearance")}
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
          {MODES.map((m, i) => {
            const isActive = mode === m.code;
            return (
              <TouchableOpacity
                key={m.code}
                onPress={async () => {
                  if (!isActive) await setMode(m.code);
                  navigation.goBack();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                style={{
                  flexDirection: "row", alignItems: "center",
                  paddingHorizontal: 14, paddingVertical: 14,
                  borderBottomWidth: i < MODES.length - 1 ? 1 : 0,
                  borderBottomColor: tokens.border.subtle,
                  backgroundColor: isActive ? tokens.brand.soft : "transparent",
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
                  <Ionicons name={m.icon} size={18} color={tokens.text.primary} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>
                  {t(m.labelKey, m.fallback)}
                </Text>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={20} color={tokens.brand.default} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
