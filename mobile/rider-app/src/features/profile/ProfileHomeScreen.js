import React from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { logout } from "../../store/slices/authSlice";

/**
 * Me tab — Phase 2 ships a polished read-only profile summary so the tab
 * isn't a stub. The full settings / KYC / sessions / support sub-screens
 * land in Phase 7.
 */
export default function ProfileHomeScreen() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth?.user);
  const rider = useSelector((s) => s.rider?.rider);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.name || "Rider";
  const email = user?.email || "—";
  const phone = user?.phone || "—";
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
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: tokens.text.primary,
            marginBottom: 18,
            letterSpacing: -0.5,
          }}
        >
          {t("profile.title", "Me")}
        </Text>

        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderWidth: 1,
            borderColor: tokens.border.default,
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: tokens.brand.soft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons name="person" size={26} color={tokens.brand.default} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, letterSpacing: -0.3 }}>
            {fullName}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 2 }}>{email}</Text>
        </View>

        <InfoRow tokens={tokens} icon="call-outline" label="Phone" value={phone} />
        <InfoRow tokens={tokens} icon="bicycle-outline" label="Vehicle" value={vehicle} />
        {rider?.status ? (
          <InfoRow tokens={tokens} icon="shield-checkmark-outline" label="Status" value={rider.status} />
        ) : null}

        <View
          style={{
            marginTop: 16,
            backgroundColor: tokens.bg.surface,
            borderWidth: 1,
            borderColor: tokens.border.default,
            borderRadius: 16,
            padding: 16,
            alignItems: "center",
          }}
        >
          <Ionicons name="construct-outline" size={26} color={tokens.text.muted} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginTop: 8 }}>
            More settings coming soon
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: tokens.text.muted,
              marginTop: 4,
              textAlign: "center",
              lineHeight: 17,
            }}
          >
            KYC re-uploads, performance stats, sessions, support, language, theme — all on the way.
          </Text>
        </View>

        <TouchableOpacity
          onPress={confirmLogout}
          accessibilityRole="button"
          style={{
            marginTop: 20,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: tokens.status.errorSoft,
            borderWidth: 1,
            borderColor: tokens.status.errorSoftBorder,
            alignItems: "center",
          }}
        >
          <Text style={{ color: tokens.status.errorStrong, fontWeight: "700" }}>
            {t("common.signOut", "Sign out")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ tokens, icon, label, value }) {
  return (
    <View
      style={{
        backgroundColor: tokens.bg.surface,
        borderWidth: 1,
        borderColor: tokens.border.default,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Ionicons name={icon} size={20} color={tokens.text.muted} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 11, color: tokens.text.muted }}>{label}</Text>
        <Text style={{ fontSize: 14, color: tokens.text.primary, fontWeight: "600", marginTop: 2 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
