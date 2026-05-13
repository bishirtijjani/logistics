import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { logout } from "../../store/slices/authSlice";
import { fetchProfile } from "../../store/slices/profileSlice";
import { colors } from "../../theme";
import { useTheme } from "../../theme";
import LocaleSheet from "../../components/LocaleSheet";
import ThemeSheet from "../../components/ThemeSheet";

// KYC badge metadata. `labelKey` resolves via t() at render so labels switch
// with locale; colors are status-coded and locale-agnostic.
const KYC_BADGE = {
  NONE: { labelKey: "settings.rows.kycNotVerified", color: "#6B7280", bg: "#F3F4F6" },
  PENDING: { labelKey: "settings.rows.kycPending", color: "#D97706", bg: "#FEF3C7" },
  VERIFIED: { labelKey: "settings.rows.kycVerified", color: "#059669", bg: "#D1FAE5" },
  FAILED: { labelKey: "settings.rows.kycFailed", color: "#EF4444", bg: "#FEE2E2" },
};

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const { profile, isLoading } = useSelector((state) => state.profile);
  // Phase 9 — locale picker visibility. State lives on the Profile screen
  // (rather than inside <LocaleSheet>) so we can re-render the chip on close
  // with the updated language label.
  const [localeSheetVisible, setLocaleSheetVisible] = useState(false);
  const [themeSheetVisible, setThemeSheetVisible] = useState(false);
  const { mode } = useTheme();
  const themeSubLabel =
    mode === 'light' ? t('theme.rowSubLight')
    : mode === 'dark' ? t('theme.rowSubDark')
    : t('theme.rowSubSystem');

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  const p = profile || user || {};
  const kycMeta = KYC_BADGE[p.kycStatus] || KYC_BADGE.NONE;
  const kycLabel = t(kycMeta.labelKey);
  const initials = (p.firstName?.[0] || "") + (p.lastName?.[0] || "");

  const accountItems = [
    {
      icon: "person-outline",
      label: t("settings.rows.personalInfo"),
      sub: t("settings.rows.personalInfoSub"),
      screen: "EditProfile",
    },
    {
      icon: "image-outline",
      label: t("settings.rows.profilePhoto"),
      sub: p.profilePicture ? t("settings.rows.profilePhotoChange") : t("settings.rows.profilePhotoAdd"),
      screen: "ProfilePhoto",
    },
  ];

  const verificationItems = [
    {
      icon: "shield-checkmark-outline",
      label: t("settings.rows.kyc"),
      sub: kycLabel,
      badgeColor: kycMeta.color,
      badgeBg: kycMeta.bg,
      screen: "BvnVerification",
      disabled: p.kycStatus === "VERIFIED",
    },
    {
      icon: "keypad-outline",
      label: t("settings.rows.transactionPin"),
      sub: p.hasPinSet ? t("settings.rows.transactionPinChange") : t("settings.rows.transactionPinSet"),
      screen: p.hasPinSet ? "ChangePin" : "SetPin",
    },
  ];

  const settingsItems = [
    {
      icon: "color-palette-outline",
      label: t("theme.rowLabel"),
      sub: themeSubLabel,
      onPress: () => setThemeSheetVisible(true),
    },
    {
      icon: "lock-closed-outline",
      label: t("settings.rows.security"),
      sub: t("settings.rows.securitySub"),
      screen: "SecuritySettings",
    },
    {
      icon: "notifications-outline",
      label: t("settings.rows.notifications"),
      sub: t("settings.rows.notificationsSub"),
      screen: "NotificationSettings",
    },
    {
      icon: "location-outline",
      label: t("settings.rows.addresses"),
      sub: t("settings.rows.addressesSub"),
      screen: "SavedAddresses",
    },
  ];

  const supportItems = [
    {
      icon: "help-circle-outline",
      label: t("settings.rows.help"),
      sub: t("settings.rows.helpSub"),
      screen: "HelpSupport",
    },
    {
      icon: "document-text-outline",
      label: t("settings.rows.legal"),
      sub: t("settings.rows.legalSub"),
      screen: "Legal",
    },
    {
      icon: "information-circle-outline",
      label: t("settings.rows.about"),
      sub: t("settings.rows.aboutSub", { version: "1.0.0" }),
      screen: "About",
    },
  ];

  const renderSection = (title, items) => (
    <View style={{ marginHorizontal: 20, marginTop: 24 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: colors.textMuted,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
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
            onPress={() => {
              if (item.disabled) return;
              if (item.onPress) { item.onPress(); return; }
              if (item.screen) navigation.navigate(item.screen);
            }}
            activeOpacity={item.disabled ? 1 : 0.6}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityHint={item.sub}
            accessibilityState={{ disabled: !!item.disabled }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: index < items.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
              opacity: item.disabled ? 0.5 : 1,
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
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.text,
                  marginBottom: 1,
                }}
              >
                {item.label}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {item.sub}
              </Text>
            </View>
            {item.badgeColor ? (
              <View
                style={{
                  backgroundColor: item.badgeBg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: item.badgeColor,
                  }}
                >
                  {item.sub}
                </Text>
              </View>
            ) : null}
            <Ionicons
              name="chevron-forward"
              size={17}
              color={colors.textLight}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Header */}
        <View
          style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 4 }}
        >
          {/* Phase 9 — Title + language pill on one row so a non-English
              reader can spot the language switch immediately on the Profile
              tab, before scrolling. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              {/* Profile is now a stack screen reached from the home avatar.
                  The back button gives iOS users (no hardware back) and
                  every user a clear way out without relying on swipe-back. */}
              {navigation.canGoBack() && (
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.back")}
                  style={{ padding: 6, marginRight: 8, marginLeft: -6 }}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
              )}
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "900",
                  color: colors.text,
                  letterSpacing: -1,
                }}
              >
                {t("tabs.profile")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setLocaleSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t("locale.title")}
              accessibilityHint={t("locale.subtitle")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surface,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: 1.5,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="language-outline" size={16} color={colors.text} />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                {t(`locale.${i18n.language === "ha" ? "ha" : "en"}`)}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {/* Avatar Card */}
          <TouchableOpacity
            onPress={() => navigation.navigate("EditProfile")}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("settings.rows.personalInfo")}
            accessibilityHint={t("settings.rows.personalInfoSub")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.dark,
              borderRadius: 20,
              padding: 18,
            }}
          >
            {p.profilePicture ? (
              <Image
                source={{ uri: p.profilePicture }}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  marginRight: 16,
                  borderWidth: 2,
                  borderColor: colors.primary,
                }}
              />
            ) : (
              <View
                style={{
                  width: 58,
                  height: 58,
                  backgroundColor: colors.primary,
                  borderRadius: 29,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontSize: 22,
                    fontWeight: "900",
                  }}
                >
                  {initials.toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.white,
                  fontSize: 18,
                  fontWeight: "800",
                  marginBottom: 2,
                }}
              >
                {p.firstName} {p.lastName}
              </Text>
              <Text
                style={{ color: colors.textMuted, fontSize: 13 }}
                numberOfLines={1}
              >
                {p.email}
              </Text>
              {p.phone ? (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {p.phone}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <View
                style={{
                  backgroundColor: kycMeta.bg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: kycMeta.color,
                  }}
                >
                  {kycLabel}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </View>
          </TouchableOpacity>

          {/* KYC Prompt Banner */}
          {p.kycStatus !== "VERIFIED" && (
            <TouchableOpacity
              onPress={() => navigation.navigate("BvnVerification")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t("settings.kycBanner.title")}
              accessibilityHint={t("settings.kycBanner.subtitle")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#FFF7ED",
                borderRadius: 14,
                padding: 14,
                marginTop: 14,
                borderWidth: 1,
                borderColor: "#FED7AA",
              }}
            >
              <Ionicons
                name="alert-circle"
                size={22}
                color={colors.primary}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 1,
                  }}
                >
                  {t("settings.kycBanner.title")}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {t("settings.kycBanner.subtitle")}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* PIN Prompt Banner */}
          {!p.hasPinSet && (
            <TouchableOpacity
              onPress={() => navigation.navigate("SetPin")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t("settings.pinBanner.title")}
              accessibilityHint={t("settings.pinBanner.subtitle")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#EFF6FF",
                borderRadius: 14,
                padding: 14,
                marginTop: 10,
                borderWidth: 1,
                borderColor: "#BFDBFE",
              }}
            >
              <Ionicons
                name="keypad"
                size={22}
                color="#2563EB"
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 1,
                  }}
                >
                  {t("settings.pinBanner.title")}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {t("settings.pinBanner.subtitle")}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#2563EB" />
            </TouchableOpacity>
          )}
        </View>

        {renderSection(t("settings.sections.account"), accountItems)}
        {renderSection(t("settings.sections.verification"), verificationItems)}
        {renderSection(t("settings.sections.settings"), settingsItems)}
        {renderSection(t("settings.sections.support"), supportItems)}

        {/* Logout */}
        <View style={{ marginHorizontal: 20, marginTop: 28, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => dispatch(logout())}
            accessibilityRole="button"
            accessibilityLabel={t("auth.logout")}
            style={{
              backgroundColor: "#FEE2E2",
              paddingVertical: 16,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: "#FECACA",
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text
              style={{
                color: colors.error,
                fontWeight: "800",
                fontSize: 15,
                marginLeft: 8,
              }}
            >
              {t("auth.logout")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <Text
          style={{
            textAlign: "center",
            color: colors.textLight,
            fontSize: 12,
            marginTop: 12,
          }}
        >
          {t("settings.version", { version: "1.0.0" })}
        </Text>
      </ScrollView>

      {isLoading && (
        <View
          style={{
            position: "absolute",
            top: 60,
            alignSelf: "center",
          }}
        >
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      <LocaleSheet
        visible={localeSheetVisible}
        onClose={() => setLocaleSheetVisible(false)}
      />
      <ThemeSheet
        visible={themeSheetVisible}
        onClose={() => setThemeSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
