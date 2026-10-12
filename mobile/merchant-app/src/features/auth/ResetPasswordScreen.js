import React, { useState } from "react";
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useRoute } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import FormInput from "../../components/FormInput";
import { resetPassword } from "../../store/slices/authSlice";

export default function ResetPasswordScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const email = route.params?.email;
  const { isLoading } = useSelector((s) => s.auth);

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (code.trim().length !== 6) return setError("Enter the 6-digit code.");
    if (newPassword.length < 8) return setError("Password must be at least 8 characters.");
    setError("");
    const res = await dispatch(resetPassword({ email, code: code.trim(), newPassword }));
    if (resetPassword.fulfilled.match(res)) {
      Toast.show({ type: "success", text1: "Password reset", text2: "Sign in with your new password" });
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>
          {t("auth.resetTitle", "Set a new password")}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.text.muted, marginBottom: 24 }}>
          {t("auth.resetSubtitle", "Enter the code we sent to")} {email}
        </Text>
        {error ? <Text style={{ color: tokens.status.error, marginBottom: 12, fontWeight: "600" }}>{error}</Text> : null}
        <FormInput label={t("auth.otpCode", "Verification code")} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="••••••" />
        <FormInput label={t("auth.newPassword", "New password")} icon="lock-closed-outline" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 8 characters" />
        <TouchableOpacity
          onPress={submit}
          disabled={isLoading}
          style={{ backgroundColor: isLoading ? tokens.bg.surfaceMuted : tokens.brand.default, paddingVertical: 16, borderRadius: 14, alignItems: "center" }}
        >
          <Text style={{ color: isLoading ? tokens.text.muted : tokens.text.onBrand, fontWeight: "800", fontSize: 16 }}>
            {t("auth.resetCta", "Reset password")}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
