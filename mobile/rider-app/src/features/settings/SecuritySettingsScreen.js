/**
 * SecuritySettingsScreen - aggregator for security-adjacent actions:
 *   - Change transaction PIN
 *   - Biometric login toggle (sub-screen)
 *   - Active sessions
 *   - Change phone number
 *   - Sign out all other devices
 *   - Delete account (irreversible - gated by confirmation prompts and
 *     a server-side guard that refuses if a delivery is active or the
 *     wallet still has balance).
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import api from "../../services/api";
import { deleteAccount } from "../../store/slices/profileSlice";
import { forceLogout } from "../../store/slices/authSlice";
import { isBiometricAvailable, isBiometricEnabled } from "../../services/biometric";

export default function SecuritySettingsScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const isUpdating = useSelector((s) => s.profile?.isUpdating);
  const hasPinSet = useSelector((s) => s.profile?.profile?.hasPinSet);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioReady, setBioReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [av, en] = await Promise.all([isBiometricAvailable(), isBiometricEnabled()]);
      setBioAvailable(av);
      setBioEnabled(en && av);
      setBioReady(true);
    })();
  }, []);

  const revokeOthers = () => {
    Alert.alert(
      t("security.logoutAllTitle", "Log Out All Devices"),
      t("security.logoutAllBody", "This will sign you out of all active sessions. You will need to log in again on each device."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("security.logoutAllCta", "Log Out All"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/auth/sessions/others");
              Toast.show({ type: "success", text1: t("security.othersSignedOut", "Other sessions revoked") });
            } catch (_) {
              Toast.show({ type: "error", text1: t("security.logoutAllFailed", "Failed to revoke sessions") });
            }
          },
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      t("security.deleteAccountTitle", "Delete Account"),
      t("security.deleteAccountBody", "This action is permanent and cannot be undone. All your data will be deleted.\n\n• Complete all active deliveries first\n• Withdraw your wallet balance\n• This cannot be reversed"),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("security.deleteAccountCta", "Delete Forever"),
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(deleteAccount()).unwrap();
              Toast.show({
                type: "success",
                text1: t("security.deleteSuccess", "Account Deleted"),
                text2: t("security.deleteSuccessSub", "Your account has been permanently deleted"),
              });
              dispatch(forceLogout());
            } catch (err) {
              Toast.show({
                type: "error",
                text1: t("security.deleteFailed", "Cannot Delete Account"),
                text2: err?.message || t("security.deleteFailedSub", "Please complete deliveries and withdraw balance first"),
              });
            }
          },
        },
      ],
    );
  };

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
          {t("security.title", "Security")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Authentication */}
        <SectionLabel tokens={tokens} text={t("security.sectionAuth", "Authentication")} />
        <Card tokens={tokens}>
          <Row
            tokens={tokens}
            icon="key-outline"
            label={t("security.pin", "Change Transaction PIN")}
            sub={hasPinSet ? t("security.pinSub", "Update your 6-digit PIN") : t("security.pinSetSub", "You haven't set a PIN yet")}
            onPress={() => navigation.navigate("ChangePin")}
          />
          <Divider tokens={tokens} />
          <Row
            tokens={tokens}
            icon="call-outline"
            label={t("security.phone", "Change Phone Number")}
            sub={t("security.phoneSub", "Update your registered phone number")}
            onPress={() => navigation.navigate("PhoneChange")}
          />
        </Card>

        {/* Biometrics */}
        <SectionLabel tokens={tokens} text={t("security.sectionBiometrics", "Biometrics")} />
        <Card tokens={tokens}>
          <Row
            tokens={tokens}
            icon="finger-print-outline"
            label={t("security.biometric", "Biometric Login")}
            sub={
              !bioReady
                ? t("common.loading", "Loading…")
                : bioAvailable
                  ? bioEnabled
                    ? t("security.biometricEnabled", "Enabled")
                    : t("security.biometricSubAvailable", "Use fingerprint or Face ID to sign in")
                  : t("security.biometricSubUnavailable", "No biometrics enrolled on this device")
            }
            onPress={() => navigation.navigate("BiometricSettings")}
          />
        </Card>

        {/* Sessions */}
        <SectionLabel tokens={tokens} text={t("security.sectionSessions", "Sessions")} />
        <Card tokens={tokens}>
          <Row
            tokens={tokens}
            icon="phone-portrait-outline"
            label={t("security.sessions", "Active Sessions")}
            sub={t("security.sessionsSub", "View and manage logged-in devices")}
            onPress={() => navigation.navigate("Sessions")}
          />
          <Divider tokens={tokens} />
          <Row
            tokens={tokens}
            icon="log-out-outline"
            label={t("security.logoutAll", "Log Out All Other Devices")}
            sub={t("security.logoutAllSub", "Sign out everywhere except here")}
            onPress={revokeOthers}
            destructive
          />
        </Card>

        {/* Danger */}
        <SectionLabel tokens={tokens} text={t("security.sectionDanger", "Danger Zone")} />
        <Card tokens={tokens} danger>
          <Row
            tokens={tokens}
            icon="trash-outline"
            label={t("security.deleteAccount", "Delete Account")}
            sub={t("security.deleteAccountSub", "Permanently delete your account and data")}
            onPress={confirmDelete}
            destructive
          />
        </Card>

        {isUpdating ? (
          <ActivityIndicator color={tokens.brand.default} style={{ marginTop: 16 }} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ tokens, text }) {
  return (
    <Text style={{
      fontSize: 11, fontWeight: "800", letterSpacing: 0.8,
      color: tokens.text.muted, marginBottom: 6, marginTop: 6, marginLeft: 4,
      textTransform: "uppercase",
    }}>
      {text}
    </Text>
  );
}

function Card({ tokens, danger, children }) {
  return (
    <View style={{
      backgroundColor: tokens.bg.surface,
      borderRadius: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: danger ? tokens.status.errorSoftBorder : tokens.border.default,
      overflow: "hidden",
    }}>
      {children}
    </View>
  );
}

function Row({ tokens, icon, label, sub, onPress, destructive }) {
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
        backgroundColor: destructive ? tokens.status.errorSoft : tokens.bg.surfaceMuted,
        alignItems: "center", justifyContent: "center",
        marginRight: 12,
      }}>
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? tokens.status.errorStrong : tokens.text.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 14, fontWeight: "700",
          color: destructive ? tokens.status.errorStrong : tokens.text.primary,
        }}>
          {label}
        </Text>
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
