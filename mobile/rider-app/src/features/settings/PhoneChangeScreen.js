/**
 * PhoneChangeScreen — two-step phone change: request OTP → confirm.
 * Calls `/auth/phone/request-change` and `/auth/phone/confirm-change`.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import api from "../../services/api";

export default function PhoneChangeScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [step, setStep] = useState("request"); // request | verify
  const [newPhone, setNewPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    const phone = newPhone.replace(/\D/g, "");
    if (phone.length < 10) {
      Toast.show({ type: "error", text1: t("phoneChange.invalid", "Enter a valid phone number") });
      return;
    }
    if (!password) {
      Toast.show({ type: "error", text1: t("phoneChange.passwordRequired", "Enter your password") });
      return;
    }
    try {
      setLoading(true);
      await api.post("/auth/phone/request-change", { newPhone: phone, password });
      Toast.show({ type: "success", text1: t("phoneChange.otpSent", "OTP sent to your new number") });
      setStep("verify");
    } catch (err) {
      Toast.show({ type: "error", text1: err?.message || t("phoneChange.otpFailed", "Failed to send OTP") });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.replace(/\D/g, "").length < 4) {
      Toast.show({ type: "error", text1: t("phoneChange.otpRequired", "Enter the OTP") });
      return;
    }
    try {
      setLoading(true);
      await api.post("/auth/phone/confirm-change", { newPhone: newPhone.replace(/\D/g, ""), otp });
      Toast.show({ type: "success", text1: t("phoneChange.success", "Phone number updated") });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: "error", text1: err?.message || t("phoneChange.otpInvalid", "Invalid OTP") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row", alignItems: "center",
            paddingHorizontal: 14, paddingVertical: 12,
            backgroundColor: tokens.bg.surface,
            borderBottomWidth: 1, borderBottomColor: tokens.border.default,
          }}
        >
          <TouchableOpacity
            onPress={() => (step === "verify" ? setStep("request") : navigation.goBack())}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
            {t("phoneChange.title", "Change Phone Number")}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {step === "request" ? (
            <>
              <Text style={{ fontSize: 14, color: tokens.text.muted, marginBottom: 24, lineHeight: 20 }}>
                {t("phoneChange.intro", "Enter your new phone number and current password. We'll send an OTP to verify the new number.")}
              </Text>

              <Field
                tokens={tokens}
                icon="call-outline"
                label={t("phoneChange.newLabel", "New phone number")}
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="08012345678"
                keyboardType="phone-pad"
              />
              <Field
                tokens={tokens}
                icon="lock-closed-outline"
                label={t("phoneChange.currentPassword", "Current password")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                rightAction={() => setShowPassword(!showPassword)}
                rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
              />

              <TouchableOpacity
                onPress={handleRequest}
                disabled={loading}
                style={{
                  backgroundColor: tokens.brand.default,
                  paddingVertical: 14, borderRadius: 14,
                  alignItems: "center", marginTop: 8,
                }}
              >
                {loading ? (
                  <ActivityIndicator color={tokens.text.onBrand} />
                ) : (
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 16 }}>
                    {t("phoneChange.sendOtpCta", "Send code")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 14, color: tokens.text.muted, marginBottom: 24, lineHeight: 20 }}>
                {t("phoneChange.verifySub", "We sent a 6-digit code to {{phone}}", { phone: newPhone })}
              </Text>

              <Field
                tokens={tokens}
                icon="key-outline"
                label={t("phoneChange.otpLabel", "Verification code")}
                value={otp}
                onChangeText={setOtp}
                placeholder="——————"
                keyboardType="number-pad"
              />

              <TouchableOpacity
                onPress={handleVerify}
                disabled={loading}
                style={{
                  backgroundColor: tokens.brand.default,
                  paddingVertical: 14, borderRadius: 14,
                  alignItems: "center", marginTop: 8,
                }}
              >
                {loading ? (
                  <ActivityIndicator color={tokens.text.onBrand} />
                ) : (
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 16 }}>
                    {t("phoneChange.verifyCta", "Verify and change")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Field({ tokens, icon, label, value, onChangeText, placeholder, keyboardType, secureTextEntry, rightAction, rightIcon }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: tokens.bg.surface,
        borderRadius: 12, paddingHorizontal: 14,
        borderWidth: 1, borderColor: value ? tokens.brand.default : tokens.border.default,
      }}>
        <Ionicons name={icon} size={18} color={tokens.text.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.text.placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          style={{ flex: 1, paddingVertical: 14, paddingLeft: 10, fontSize: 15, color: tokens.text.primary }}
        />
        {rightAction ? (
          <TouchableOpacity onPress={rightAction}>
            <Ionicons name={rightIcon} size={18} color={tokens.text.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
