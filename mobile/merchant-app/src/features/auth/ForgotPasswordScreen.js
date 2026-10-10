import React, { useState } from "react";
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import FormInput from "../../components/FormInput";
import { requestPasswordReset } from "../../store/slices/authSlice";

export default function ForgotPasswordScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { isLoading } = useSelector((s) => s.auth);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim().includes("@")) return setError("Enter a valid email.");
    setError("");
    const res = await dispatch(requestPasswordReset(email.trim().toLowerCase()));
    if (requestPasswordReset.fulfilled.match(res)) {
      navigation.navigate("ResetPassword", { email: email.trim().toLowerCase() });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>
          {t("auth.forgotTitle", "Reset your password")}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.text.muted, marginBottom: 24 }}>
          {t("auth.forgotSubtitle", "Enter your email and we'll send you a 6-digit code.")}
        </Text>
        {error ? <Text style={{ color: tokens.status.error, marginBottom: 12, fontWeight: "600" }}>{error}</Text> : null}
        <FormInput label={t("auth.email", "Email")} icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
        <TouchableOpacity
          onPress={submit}
          disabled={isLoading}
          style={{ backgroundColor: isLoading ? tokens.bg.surfaceMuted : tokens.brand.default, paddingVertical: 16, borderRadius: 14, alignItems: "center" }}
        >
          <Text style={{ color: isLoading ? tokens.text.muted : tokens.text.onBrand, fontWeight: "800", fontSize: 16 }}>
            {t("auth.sendCode", "Send code")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ alignItems: "center", paddingVertical: 16 }}>
          <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>{t("common.back", "Back")}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
