/**
 * Me tab — full profile aggregator. Phase 7 lights up everything: edit,
 * vehicle info, KYC status, performance, security, notifications,
 * language, theme, support, legal, about, sign out.
 *
 * Rating + delivery summary chips render at the top so the rider can see
 * their current standing without drilling into Performance.
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { logout } from "../../store/slices/authSlice";
import { fetchPerformance } from "../../store/slices/profileSlice";

export default function ProfileHomeScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const { tokens, mode } = useTheme();
  const user = useSelector((s) => s.auth?.user);
  const profile = useSelector((s) => s.profile?.profile);
  const rider = useSelector((s) => s.rider?.rider);
  const performance = useSelector((s) => s.profile?.performance);

  useEffect(() => {
    if (!performance) dispatch(fetchPerformance()).catch?.(() => {});
  }, [performance, dispatch]);

  const fullName = [profile?.firstName || user?.firstName, profile?.lastName || user?.lastName]
    .filter(Boolean).join(" ") || profile?.name || user?.name || "Rider";
  const photo = profile?.profilePicture;
  const rating = performance?.rating?.average ?? rider?.averageRating ?? 0;
  const deliveries = performance?.totalDeliveries ?? rider?.totalDeliveries ?? 0;
  const vehicle = rider?.vehicleType
    ? `${rider.vehicleType.toLowerCase()} · ${rider.plateNumber}`
    : "—";

  const confirmLogout = () => {
    Alert.alert(
      t("auth.logout", "Log out"),
      t("auth.logoutConfirm", "Are you sure you want to log out?"),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        { text: t("common.signOut", "Sign out"), style: "destructive", onPress: () => dispatch(logout()) },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 }}>
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "900", color: tokens.text.primary, marginBottom: 14, letterSpacing: -0.5 }}>
          {t("profile.title", "Me")}
        </Text>

        {/* Identity card */}
        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderRadius: 18, padding: 16,
            borderWidth: 1, borderColor: tokens.border.default,
            flexDirection: "row", alignItems: "center",
            marginBottom: 14,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate("ProfilePhoto")}
            accessibilityRole="button"
            accessibilityLabel={t("photo.tapToChange", "Tap to change photo")}
            style={{
              width: 64, height: 64, borderRadius: 32, overflow: "hidden",
              backgroundColor: tokens.brand.soft,
              alignItems: "center", justifyContent: "center",
              marginRight: 14,
            }}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={{ width: 64, height: 64 }} />
            ) : (
              <Ionicons name="person" size={28} color={tokens.brand.default} />
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>{fullName}</Text>
            <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>{user?.email || profile?.email || "—"}</Text>
            <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>{vehicle}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("EditProfile")}
            accessibilityRole="button"
            hitSlop={8}
            style={{
              backgroundColor: tokens.bg.surfaceMuted,
              paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
            }}
          >
            <Ionicons name="create-outline" size={18} color={tokens.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Stat chips */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
          <StatChip
            tokens={tokens}
            icon="star"
            iconColor={tokens.status.warning}
            label={t("profile.rating", "Rating")}
            value={rating > 0 ? rating.toFixed(1) : "—"}
            onPress={() => navigation.navigate("Performance")}
          />
          <StatChip
            tokens={tokens}
            icon="cube-outline"
            iconColor={tokens.brand.default}
            label={t("profile.deliveries", "Deliveries")}
            value={String(deliveries)}
            onPress={() => navigation.navigate("Performance")}
          />
        </View>

        {/* Section: Account */}
        <SectionLabel tokens={tokens} text={t("profile.sections.account", "Account")} />
        <Card tokens={tokens}>
          <Row tokens={tokens} icon="person-circle-outline" label={t("profile.editProfile", "Personal info")} sub={t("profile.editProfileSub", "Name, address, date of birth")} onPress={() => navigation.navigate("EditProfile")} />
          <Divider tokens={tokens} />
          <Row tokens={tokens} icon="bicycle-outline" label={t("profile.vehicle", "Vehicle")} sub={vehicle} onPress={() => navigation.navigate("VehicleInfo")} />
          <Divider tokens={tokens} />
          <Row tokens={tokens} icon="shield-checkmark-outline" label={t("profile.kyc", "KYC documents")} sub={t("profile.kycSub", "ID, licence, insurance")} onPress={() => navigation.navigate("KycStatus")} />
          <Divider tokens={tokens} />
          <Row tokens={tokens} icon="trending-up-outline" label={t("profile.performance", "Performance")} sub={t("profile.performanceSub", "Rating, acceptance, on-time")} onPress={() => navigation.navigate("Performance")} />
        </Card>

        {/* Section: Wallet shortcuts */}
        <SectionLabel tokens={tokens} text={t("profile.sections.money", "Money")} />
        <Card tokens={tokens}>
          <Row tokens={tokens} icon="wallet-outline" label={t("profile.wallet", "Wallet")} sub={t("profile.walletSub", "Balance, NUBAN, transactions")} onPress={() => navigation.navigate("MainTabs", { screen: "WalletTab" })} />
          <Divider tokens={tokens} />
          <Row tokens={tokens} icon="people-outline" label={t("profile.beneficiaries", "Saved beneficiaries")} onPress={() => navigation.navigate("Beneficiaries")} />
        </Card>

        {/* Section: Security */}
        <SectionLabel tokens={tokens} text={t("profile.sections.security", "Security")} />
        <Card tokens={tokens}>
          <Row tokens={tokens} icon="lock-closed-outline" label={t("profile.security", "Security & PIN")} sub={t("profile.securitySub", "PIN, biometrics, sessions")} onPress={() => navigation.navigate("SecuritySettings")} />
          <Divider tokens={tokens} />
          <Row tokens={tokens} icon="call-outline" label={t("profile.phone", "Phone number")} sub={profile?.phone || "—"} onPress={() => navigation.navigate("PhoneChange")} />
        </Card>

        {/* Section: Preferences */}
        <SectionLabel tokens={tokens} text={t("profile.sections.preferences", "Preferences")} />
        <Card tokens={tokens}>
          <Row tokens={tokens} icon="language-outline" label={t("profile.language", "Language")} sub={i18n.language === "ha" ? "Hausa" : "English"} onPress={() => navigation.navigate("Language")} />
          <Divider tokens={tokens} />
          <Row tokens={tokens} icon="contrast-outline" label={t("profile.theme", "Appearance")} sub={mode === "system" ? t("profile.themeSystem", "System") : mode === "dark" ? t("profile.themeDark", "Dark") : t("profile.themeLight", "Light")} onPress={() => navigation.navigate("Theme")} />
        </Card>

        {/* Section: Support */}
        <SectionLabel tokens={tokens} text={t("profile.sections.support", "Support")} />
        <Card tokens={tokens}>
          <Row tokens={tokens} icon="help-circle-outline" label={t("profile.support", "Help & disputes")} sub={t("profile.supportSub", "Tickets, dispute history")} onPress={() => navigation.navigate("SupportHome")} />
          <Divider tokens={tokens} />
          <Row tokens={tokens} icon="document-text-outline" label={t("profile.legal", "Legal")} sub={t("profile.legalSub", "Terms, privacy")} onPress={() => navigation.navigate("Legal")} />
        </Card>

        <TouchableOpacity
          onPress={confirmLogout}
          accessibilityRole="button"
          style={{
            marginTop: 18, paddingVertical: 14, borderRadius: 14,
            backgroundColor: tokens.status.errorSoft,
            borderWidth: 1, borderColor: tokens.status.errorSoftBorder,
            alignItems: "center",
          }}
        >
          <Text style={{ color: tokens.status.errorStrong, fontWeight: "800" }}>
            {t("common.signOut", "Sign out")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip({ tokens, icon, iconColor, label, value, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      activeOpacity={0.85}
      style={{
        flex: 1,
        backgroundColor: tokens.bg.surface,
        borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: tokens.border.default,
      }}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={{ marginTop: 6, fontSize: 11, color: tokens.text.muted, fontWeight: "700" }}>{label}</Text>
      <Text style={{ marginTop: 2, fontSize: 18, fontWeight: "900", color: tokens.text.primary }}>{value}</Text>
    </TouchableOpacity>
  );
}

function SectionLabel({ tokens, text }) {
  return (
    <Text style={{
      fontSize: 11, fontWeight: "800", letterSpacing: 0.8,
      color: tokens.text.muted, marginBottom: 6, marginTop: 4, marginLeft: 4,
      textTransform: "uppercase",
    }}>
      {text}
    </Text>
  );
}

function Card({ tokens, children }) {
  return (
    <View style={{
      backgroundColor: tokens.bg.surface,
      borderRadius: 14,
      marginBottom: 16,
      borderWidth: 1, borderColor: tokens.border.default,
      overflow: "hidden",
    }}>
      {children}
    </View>
  );
}

function Row({ tokens, icon, label, sub, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      activeOpacity={0.7}
      style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 14, paddingVertical: 14,
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: tokens.bg.surfaceMuted,
        alignItems: "center", justifyContent: "center",
        marginRight: 12,
      }}>
        <Ionicons name={icon} size={18} color={tokens.text.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>{label}</Text>
        {sub ? (
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
    </TouchableOpacity>
  );
}

function Divider({ tokens }) {
  return <View style={{ height: 1, backgroundColor: tokens.border.subtle, marginLeft: 60 }} />;
}
