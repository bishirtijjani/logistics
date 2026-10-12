import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import API from "../../services/api";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { logout, deleteAccount } from "../../store/slices/authSlice";
import { setLocale, getLocale } from "../../i18n";
import { isBiometricEnabled, setBiometricEnabled, isBiometricAvailable } from "../../services/biometric";
import ScreenHeader from "../../components/ScreenHeader";

function Section({ title, children }) {
  const { tokens } = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.text.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function Item({ icon, label, value, onPress, destructive, right }) {
  const { tokens } = useTheme();
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}>
      {icon ? <Ionicons name={icon} size={20} color={destructive ? tokens.status.error : tokens.text.muted} style={{ marginRight: 12 }} /> : null}
      <Text style={{ flex: 1, color: destructive ? tokens.status.errorStrong : tokens.text.primary, fontWeight: "600", fontSize: 15 }}>{label}</Text>
      {value ? <Text style={{ color: tokens.text.muted, marginRight: 8 }}>{value}</Text> : null}
      {right || (onPress ? <Ionicons name="chevron-forward" size={18} color={tokens.border.strong} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
}

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { tokens, mode, setMode } = useTheme();
  const { t } = useT();
  const user = useSelector((s) => s.auth.user);

  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [locale, setLocaleState] = useState(getLocale());

  useEffect(() => {
    (async () => {
      setBioAvailable(await isBiometricAvailable());
      setBioEnabled(await isBiometricEnabled());
    })();
  }, []);

  const toggleBio = async (val) => {
    if (val && !bioAvailable) {
      Alert.alert(t("settings.bioUnavailableTitle", "Not available"), t("settings.bioUnavailable", "This device has no biometrics set up."));
      return;
    }
    setBioEnabled(val);
    await setBiometricEnabled(val);
  };

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Merchant";
  const isDark = mode === "dark";

  const confirmDelete = () => {
    Alert.alert(
      t("settings.deleteAccount", "Delete account"),
      t("settings.deleteAccountConfirm", "This permanently deletes your account. This cannot be undone."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        { text: t("settings.delete", "Delete"), style: "destructive", onPress: () => dispatch(deleteAccount()) },
      ],
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} contentContainerStyle={{ paddingBottom: 48 }}>
      <ScreenHeader title={t("tabs.settings", "Settings")} showBack />
      <View style={{ paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 20 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: tokens.brand.soft, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
          <Ionicons name="storefront" size={26} color={tokens.brand.default} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary }}>{name}</Text>
          <Text style={{ color: tokens.text.muted, fontSize: 13 }}>{user?.email}</Text>
        </View>
      </View>

      <Section title={t("settings.account", "Account")}>
        <Item
          icon="person-outline"
          label={t("settings.profile", "Profile")}
          onPress={() => navigation.navigate("WebSection", { initialPath: "/dashboard/settings", title: t("settings.profile", "Profile") })}
        />
        <Item
          icon="lock-closed-outline"
          label={t("settings.security", "Security & PIN")}
          onPress={() => navigation.navigate("WebSection", { initialPath: "/dashboard/settings", title: t("settings.security", "Security & PIN") })}
        />
      </Section>

      <Section title={t("settings.appearance", "Appearance")}>
        <Item
          icon="moon-outline"
          label={t("settings.darkMode", "Dark mode")}
          right={
            <Switch value={isDark} onValueChange={(v) => setMode(v ? "dark" : "light")} trackColor={{ true: tokens.brand.default }} />
          }
        />
        <Item
          icon="language-outline"
          label={t("settings.language", "Language")}
          value={locale === "ha" ? "Hausa" : "English"}
          onPress={async () => {
            const next = locale === "ha" ? "en" : "ha";
            setLocaleState(next);
            await setLocale(next);
          }}
        />
      </Section>

      <Section title={t("settings.privacy", "Privacy & security")}>
        <Item
          icon="finger-print-outline"
          label={t("settings.biometricLock", "Biometric lock")}
          right={<Switch value={bioEnabled} onValueChange={toggleBio} trackColor={{ true: tokens.brand.default }} />}
        />
      </Section>

      <Section title={t("settings.legal", "Legal")}>
        <Item icon="shield-checkmark-outline" label={t("settings.privacyPolicy", "Privacy policy")} onPress={() => WebBrowser.openBrowserAsync("https://iprime.ng/legal/privacy")} />
        <Item icon="document-text-outline" label={t("settings.terms", "Terms of service")} onPress={() => WebBrowser.openBrowserAsync("https://iprime.ng/legal/terms")} />
      </Section>

      <Section title={t("settings.danger", "Account actions")}>
        <Item icon="log-out-outline" label={t("auth.signOut", "Sign out")} onPress={() => dispatch(logout())} />
        <Item icon="trash-outline" label={t("settings.deleteAccount", "Delete account")} destructive onPress={confirmDelete} />
      </Section>

      <Text style={{ textAlign: "center", color: tokens.text.placeholder, fontSize: 12, marginTop: 8 }}>
        {t("settings.version", "iPrime Merchant")} v1.0.0
      </Text>
      </View>
    </ScrollView>
  );
}
