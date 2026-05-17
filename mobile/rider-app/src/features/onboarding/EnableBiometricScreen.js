import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import {
  authenticateWithBiometric,
  isBiometricAvailable,
  setBiometricEnabled,
} from "../../services/biometric";

/**
 * Final onboarding step before MainTabs.
 *   - Probes whether the device has biometric hardware + enrollment.
 *   - If available: offers Enable / Skip. Enable prompts the OS dialog and
 *     persists `biometricEnabled=true` on success.
 *   - If unavailable: shows a skip-only state.
 * Either path advances to MainTabs via `navigation.reset` so the rider can't
 * navigate back into the onboarding stack from Home.
 */
export default function EnableBiometricScreen({ navigation }) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [probing, setProbing] = useState(true);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ok = await isBiometricAvailable();
        setAvailable(ok);
      } catch (_) {
        setAvailable(false);
      } finally {
        setProbing(false);
      }
    })();
  }, []);

  const goToMain = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      }),
    );
  };

  const onEnable = async () => {
    setBusy(true);
    try {
      const ok = await authenticateWithBiometric(t("auth.biometricPrompt", "Confirm with biometrics"));
      if (ok) {
        await setBiometricEnabled(true);
        Toast.show({
          type: "success",
          text1: t("auth.biometricEnabledToast", "Biometric unlock enabled"),
        });
        goToMain();
      } else {
        Toast.show({
          type: "error",
          text1: t("auth.biometricCancelledToast", "Biometric prompt cancelled"),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const onSkip = async () => {
    await setBiometricEnabled(false);
    goToMain();
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokens.brand.soft,
              borderWidth: 1,
              borderColor: tokens.brand.softBorder,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Ionicons name="finger-print-outline" size={48} color={tokens.brand.default} />
          </View>

          <Text
            accessibilityRole="header"
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: tokens.text.primary,
              marginBottom: 8,
              textAlign: "center",
              letterSpacing: -0.5,
            }}
          >
            {available
              ? t("auth.biometricTitle", "Enable biometric unlock")
              : t("auth.biometricUnavailableTitle", "Biometrics unavailable")}
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: tokens.text.muted,
              textAlign: "center",
              marginBottom: 32,
              lineHeight: 22,
            }}
          >
            {available
              ? t(
                  "auth.biometricBody",
                  "Use your fingerprint or face to unlock the app. Wallet actions will still require your 6-digit PIN.",
                )
              : t(
                  "auth.biometricUnavailableBody",
                  "Your device doesn't have biometrics enrolled. You can enable this later from Security settings.",
                )}
          </Text>

          {probing ? (
            <ActivityIndicator color={tokens.brand.default} />
          ) : available ? (
            <>
              <TouchableOpacity
                onPress={onEnable}
                disabled={busy}
                accessibilityRole="button"
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 16,
                  alignItems: "center",
                  backgroundColor: busy ? "#EA580CB3" : tokens.brand.default,
                  marginBottom: 12,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={tokens.text.onBrand} />
                ) : (
                  <Text style={{ color: tokens.text.onBrand, fontSize: 15, fontWeight: "800" }}>
                    {t("auth.biometricEnableCta", "Enable")}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSkip}
                disabled={busy}
                accessibilityRole="button"
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>
                  {t("common.skip", "Skip for now")}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={onSkip}
              accessibilityRole="button"
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
                backgroundColor: tokens.brand.default,
              }}
            >
              <Text style={{ color: tokens.text.onBrand, fontSize: 15, fontWeight: "800" }}>
                {t("common.continue", "Continue")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
