/**
 * BiometricSettingsScreen - toggle biometric login. Enabling requires a
 * successful auth challenge so we don't lock the user out behind a
 * biometric they can't actually pass.
 */

import React, { useEffect, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
  authenticateWithBiometric,
} from "../../services/biometric";

export default function BiometricSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [av, en] = await Promise.all([isBiometricAvailable(), isBiometricEnabled()]);
      if (cancelled) return;
      setAvailable(av);
      setEnabled(en && av);
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async (next) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        if (!available) {
          Alert.alert(
            t("security.biometricUnavailable", "Biometrics unavailable"),
            t("security.biometricUnavailableSub", "Enroll a fingerprint or Face ID in your device settings first."),
          );
          return;
        }
        const ok = await authenticateWithBiometric(t("security.biometricEnablePrompt", "Enable biometric login"));
        if (!ok) {
          Toast.show({ type: "error", text1: t("security.biometricCancelled", "Cancelled") });
          return;
        }
        await setBiometricEnabled(true);
        setEnabled(true);
        Toast.show({ type: "success", text1: t("security.biometricEnabled", "Biometric login enabled") });
      } else {
        await setBiometricEnabled(false);
        setEnabled(false);
        Toast.show({ type: "success", text1: t("security.biometricDisabled", "Biometric login disabled") });
      }
    } catch (err) {
      Toast.show({ type: "error", text1: t("security.biometricUpdateFailed", "Could not update biometrics") });
    } finally {
      setBusy(false);
    }
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
        <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("security.biometric", "Biometric Login")}
        </Text>
      </View>

      {!hydrated ? (
        <ActivityIndicator color={tokens.brand.default} style={{ marginTop: 40 }} />
      ) : (
        <View style={{ padding: 20 }}>
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 14, padding: 16,
              borderWidth: 1, borderColor: tokens.border.default,
              flexDirection: "row", alignItems: "center",
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: tokens.brand.soft,
              alignItems: "center", justifyContent: "center",
              marginRight: 14,
            }}>
              <Ionicons name="finger-print" size={22} color={tokens.brand.default} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary }}>
                {t("security.biometric", "Biometric Login")}
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                {available
                  ? t("security.biometricSubAvailable", "Use fingerprint or Face ID to sign in")
                  : t("security.biometricSubUnavailable", "No biometrics enrolled on this device")}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggle}
              disabled={busy || !available}
              trackColor={{ true: tokens.brand.default, false: tokens.bg.surfaceMuted }}
              thumbColor={tokens.text.onBrand}
            />
          </View>

          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 14, lineHeight: 18 }}>
            {t("security.biometricExplain", "When enabled, you'll be asked to verify with your fingerprint or Face ID each time you open the app.")}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
