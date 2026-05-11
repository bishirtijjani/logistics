import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { colors } from "../../theme";
import Toast from "react-native-toast-message";

export default function PhoneChangeScreen({ navigation }) {
  const [step, setStep] = useState("request"); // request | verify
  const [newPhone, setNewPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    const phone = newPhone.replace(/\D/g, "");
    if (phone.length < 10) {
      Toast.show({ type: "error", text1: "Enter a valid phone number" });
      return;
    }
    if (!password) {
      Toast.show({ type: "error", text1: "Enter your password" });
      return;
    }
    try {
      setLoading(true);
      await api.post("/auth/phone/request-change", { newPhone: phone, password });
      Toast.show({ type: "success", text1: "OTP sent to your new number" });
      setStep("verify");
    } catch (err) {
      Toast.show({ type: "error", text1: err.message || "Failed to send OTP" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.replace(/\D/g, "").length < 4) {
      Toast.show({ type: "error", text1: "Enter the OTP" });
      return;
    }
    try {
      setLoading(true);
      await api.post("/auth/phone/confirm-change", { newPhone: newPhone.replace(/\D/g, ""), otp });
      Toast.show({ type: "success", text1: "Phone number updated successfully" });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: "error", text1: err.message || "Invalid OTP" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ height: 4, backgroundColor: colors.primary }} />

        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => (step === "verify" ? setStep("request") : navigation.goBack())}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginLeft: 16, letterSpacing: -0.5 }}>
            Change Phone Number
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {step === "request" ? (
            <>
              <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 28, lineHeight: 20 }}>
                Enter your new phone number and current password. We'll send an OTP to verify the new number.
              </Text>

              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, letterSpacing: 0.8 }}>
                NEW PHONE NUMBER
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1.5, borderColor: newPhone ? colors.primary : colors.border }}>
                <Ionicons name="call-outline" size={18} color={colors.textMuted} />
                <TextInput
                  value={newPhone}
                  onChangeText={setNewPhone}
                  placeholder="08012345678"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  style={{ flex: 1, paddingVertical: 14, paddingLeft: 10, fontSize: 15, color: colors.text }}
                />
              </View>

              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, letterSpacing: 0.8 }}>
                CURRENT PASSWORD
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 32, borderWidth: 1.5, borderColor: password ? colors.primary : colors.border }}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  style={{ flex: 1, paddingVertical: 14, paddingLeft: 10, fontSize: 15, color: colors.text }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleRequest}
                disabled={loading}
                style={{ backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 14, alignItems: "center" }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={{ color: colors.white, fontWeight: "800", fontSize: 16 }}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 28, lineHeight: 20 }}>
                Enter the OTP sent to <Text style={{ fontWeight: "700", color: colors.text }}>{newPhone}</Text>.
              </Text>

              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, letterSpacing: 0.8 }}>
                OTP CODE
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 32, borderWidth: 1.5, borderColor: otp ? colors.primary : colors.border }}>
                <Ionicons name="key-outline" size={18} color={colors.textMuted} />
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="Enter OTP"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={{ flex: 1, paddingVertical: 14, paddingLeft: 10, fontSize: 18, letterSpacing: 4, color: colors.text }}
                />
              </View>

              <TouchableOpacity
                onPress={handleVerify}
                disabled={loading}
                style={{ backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 14, alignItems: "center" }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={{ color: colors.white, fontWeight: "800", fontSize: 16 }}>Confirm Change</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
