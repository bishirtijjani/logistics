import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import FormInput from "../../components/FormInput";
import { verifyOtp, resendOtp } from "../../store/slices/authSlice";
import Toast from "react-native-toast-message";

export default function OtpVerificationScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const email = route.params?.email;
  const { isLoading } = useSelector((s) => s.auth);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const submit = async () => {
    if (code.trim().length !== 6) return setError("Enter the 6-digit code.");
    setError("");
    const res = await dispatch(verifyOtp({ email, code: code.trim() }));
    if (verifyOtp.fulfilled.match(res)) {
      Toast.show({ type: "success", text1: "Email verified", text2: "Please sign in to continue" });
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    await dispatch(resendOtp(email));
    setCooldown(60);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>
          {t("auth.otpTitle", "Verify your email")}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.text.muted, marginBottom: 24 }}>
          {t("auth.otpSubtitle", "We sent a 6-digit code to")} {email}
        </Text>

        {error ? <Text style={{ color: tokens.status.error, marginBottom: 12, fontWeight: "600" }}>{error}</Text> : null}

        <FormInput
          label={t("auth.otpCode", "Verification code")}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="••••••"
        />

        <TouchableOpacity
          onPress={submit}
          disabled={isLoading}
          style={{ backgroundColor: isLoading ? tokens.bg.surfaceMuted : tokens.brand.default, paddingVertical: 16, borderRadius: 14, alignItems: "center" }}
        >
          <Text style={{ color: isLoading ? tokens.text.muted : tokens.text.onBrand, fontWeight: "800", fontSize: 16 }}>
            {isLoading ? t("common.loading", "Please wait…") : t("auth.verify", "Verify")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={resend} disabled={cooldown > 0} style={{ alignItems: "center", paddingVertical: 16 }}>
          <Text style={{ color: cooldown > 0 ? tokens.text.muted : tokens.brand.strong, fontWeight: "700" }}>
            {cooldown > 0 ? `${t("auth.resendIn", "Resend in")} ${cooldown}s` : t("auth.resend", "Resend code")}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
