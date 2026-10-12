import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { logout } from "../../store/slices/authSlice";
import ScreenHeader from "../../components/ScreenHeader";

// Secondary destinations that don't earn a slot in the bottom bar. Each opens
// the web dashboard section in a WebView (no web chrome - see WebAppScreen) or
// a native screen. Mirrors the vendor dashboard's "More" sheet.
const SECTIONS = [
  { key: "vtu", icon: "flash-outline", labelKey: "merchant.sectionVtu", fallback: "Pay Bills", path: "/dashboard/vtu" },
  { key: "analytics", icon: "bar-chart-outline", labelKey: "merchant.sectionAnalytics", fallback: "Analytics", path: "/dashboard/analytics" },
  { key: "marketing", icon: "megaphone-outline", labelKey: "merchant.sectionMarketing", fallback: "Marketing", path: "/dashboard/marketing" },
  { key: "support", icon: "chatbubbles-outline", labelKey: "merchant.sectionSupport", fallback: "Support", path: "/dashboard/support" },
];

export default function MoreScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <ScreenHeader title={t("tabs.more", "More")} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.border.default,
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          {SECTIONS.map((s, i) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => navigation.navigate("WebSection", { initialPath: s.path, title: t(s.labelKey, s.fallback) })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 16,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: tokens.border.subtle,
              }}
            >
              <Ionicons name={s.icon} size={20} color={tokens.text.muted} style={{ marginRight: 14 }} />
              <Text style={{ flex: 1, color: tokens.text.primary, fontWeight: "600", fontSize: 15 }}>
                {t(s.labelKey, s.fallback)}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={tokens.border.strong} />
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.border.default,
            overflow: "hidden",
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 }}
          >
            <Ionicons name="settings-outline" size={20} color={tokens.text.muted} style={{ marginRight: 14 }} />
            <Text style={{ flex: 1, color: tokens.text.primary, fontWeight: "600", fontSize: 15 }}>
              {t("tabs.settings", "Settings")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={tokens.border.strong} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => dispatch(logout())}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 20,
            paddingVertical: 14,
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={tokens.status.errorStrong} style={{ marginRight: 8 }} />
          <Text style={{ color: tokens.status.errorStrong, fontWeight: "700", fontSize: 15 }}>
            {t("auth.signOut", "Sign out")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
