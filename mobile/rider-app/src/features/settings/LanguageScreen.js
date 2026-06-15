/**
 * LanguageScreen - pick app language (English / Hausa). Persists via the
 * existing `setLocale` helper which writes to SecureStore and calls
 * `i18n.changeLanguage` so every screen flips immediately.
 */

import React from "react";
import { goBackOr } from "../../lib/goBack";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { SUPPORTED_LOCALES, setLocale } from "../../i18n";

const LABEL = { en: "English", ha: "Hausa" };
const NATIVE = { en: "English", ha: "Hausa" };

export default function LanguageScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();

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
        <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("profile.language", "Language")}
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
          {SUPPORTED_LOCALES.map((code, i) => {
            const isActive = i18n.language === code;
            return (
              <TouchableOpacity
                key={code}
                onPress={async () => {
                  if (!isActive) await setLocale(code);
                  goBackOr(navigation);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                style={{
                  flexDirection: "row", alignItems: "center",
                  paddingHorizontal: 14, paddingVertical: 14,
                  borderBottomWidth: i < SUPPORTED_LOCALES.length - 1 ? 1 : 0,
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
                  <Text style={{ fontSize: 11, fontWeight: "900", color: tokens.text.primary }}>
                    {code.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>
                    {LABEL[code] || code}
                  </Text>
                  {NATIVE[code] && NATIVE[code] !== LABEL[code] ? (
                    <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                      {NATIVE[code]}
                    </Text>
                  ) : null}
                </View>
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
