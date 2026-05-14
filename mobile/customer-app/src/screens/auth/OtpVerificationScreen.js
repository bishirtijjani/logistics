import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { verifyOtp, clearError } from "../../store/slices/authSlice";
import api from "../../services/api";
import AuthErrorBanner from "../../components/AuthErrorBanner";
import { colors } from "../../theme";

const RESEND_COOLDOWN = 60;

export default function OtpVerificationScreen({ route, navigation }) {
  // mode: 'register' | 'reset'
  const { email, mode = "register" } = route.params || {};
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isLoading } = useSelector((state) => state.auth);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // Clear any error left over from a prior screen so the banner starts empty.
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) {
      Toast.show({
        type: "error",
        text1: t("auth.form.otpInvalid"),
      });
      return;
    }

    if (mode === "reset") {
      // For password reset: don't verify here — pass code to ResetPassword screen
      // The backend will verify OTP atomically with the password update
      navigation.navigate("ResetPassword", { email, code });
      return;
    }

    // Registration flow — verify OTP and activate account
    dispatch(clearError());
    const resultAction = await dispatch(verifyOtp({ email, code }));

    if (verifyOtp.fulfilled.match(resultAction)) {
      Toast.show({
        type: "success",
        text1: t("auth.toast.accountCreated"),
        text2: t("auth.signIn"),
      });
      navigation.navigate("Login");
    } else {
      Toast.show({
        type: "error",
        text1: t("errors.title"),
        text2: resultAction.payload || t("errors.UNKNOWN_ERROR"),
      });
    }
  }, [code, mode, email, dispatch, navigation, t]);

  const handleResend = useCallback(async () => {
    if (isResending || countdown > 0) return;
    setIsResending(true);
    try {
      const endpoint =
        mode === "reset" ? "/auth/password/forgot" : "/auth/otp/send";
      await api.post(endpoint, { email });
      setCountdown(RESEND_COOLDOWN);
      Toast.show({
        type: "success",
        text1: t("auth.toast.otpSent"),
      });
    } catch {
      // Toast already shown by api interceptor
    } finally {
      setIsResending(false);
    }
  }, [isResending, countdown, mode, email, t]);

  const isReset = mode === "reset";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 4, backgroundColor: colors.primary }} />
      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 56 }}
      >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginBottom: 32 }}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={{ marginBottom: 36 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 38,
                fontWeight: "900",
                color: colors.text,
                letterSpacing: -1.5,
                marginBottom: 8,
                lineHeight: 44,
              }}
            >
              {t("auth.otpTitle")}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, lineHeight: 22 }}>
              {t("auth.otpSubtitle", { email })}
            </Text>
          </View>

          <AuthErrorBanner />

          <View style={{ marginBottom: 28 }}>
            <TextInput
              accessibilityLabel={t("auth.otpTitle")}
              accessibilityHint={t("auth.form.otpInvalid")}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderColor: colors.border,
                textAlign: "center",
                padding: 20,
                borderRadius: 16,
                color: colors.text,
                fontSize: 32,
                fontWeight: "900",
                letterSpacing: 12,
              }}
              placeholder="000000"
              placeholderTextColor={colors.border}
              keyboardType="numeric"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              editable={!isLoading}
              autoComplete="one-time-code"
              selectionColor={colors.primary}
              onSubmitEditing={handleVerify}
              returnKeyType="done"
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: isLoading ? "#EA580CB3" : colors.primary,
            }}
            onPress={handleVerify}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isReset ? t("common.continue") : t("common.confirm")}
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                {isReset ? t("common.continue") : t("common.confirm")}
              </Text>
            )}
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginTop: 20,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {t("auth.otpResend")}{" "}
            </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={countdown > 0 || isResending}
              accessibilityRole="button"
              accessibilityLabel={t("auth.otpResendCta")}
              accessibilityState={{ disabled: countdown > 0 || isResending }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: countdown > 0 ? colors.textMuted : colors.primary,
                }}
              >
                {isResending
                  ? t("common.loading")
                  : countdown > 0
                    ? t("auth.otpResendIn", { seconds: countdown })
                    : t("auth.otpResendCta")}
              </Text>
            </TouchableOpacity>
          </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
