import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { verifyOtp, clearError } from "../../store/slices/authSlice";
import api from "../../services/api";

const RESEND_COOLDOWN = 60;

export default function OtpVerificationScreen({ route, navigation }) {
  // mode: 'register' | 'reset'
  const { email, mode = "register" } = route.params || {};
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) {
      Toast.show({
        type: "error",
        text1: "Enter your 6-digit code",
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
        text1: "Email verified!",
        text2: "You can now sign in.",
      });
      navigation.navigate("Login");
    }
  }, [code, mode, email, dispatch, navigation]);

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
        text1: "Code resent",
        text2: "Check your email for a new code.",
      });
    } catch {
      // Toast already shown by api interceptor
    } finally {
      setIsResending(false);
    }
  }, [isResending, countdown, mode, email]);

  const isReset = mode === "reset";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#FAFAFA" }}
    >
      <View style={{ height: 4, backgroundColor: "#EA580C" }} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginBottom: 32 }}
          >
            <Ionicons name="arrow-back" size={24} color="#09090b" />
          </TouchableOpacity>

          <View style={{ marginBottom: 36 }}>
            <Text
              style={{
                fontSize: 38,
                fontWeight: "900",
                color: "#09090b",
                letterSpacing: -1.5,
                marginBottom: 8,
                lineHeight: 44,
              }}
            >
              {isReset ? "Enter reset\ncode." : "Check your\nemail."}
            </Text>
            <Text style={{ fontSize: 15, color: "#6B7280", lineHeight: 22 }}>
              We sent a 6-digit code to{" "}
              <Text style={{ fontWeight: "700", color: "#09090b" }}>
                {email}
              </Text>
            </Text>
          </View>

          <View style={{ marginBottom: 28 }}>
            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1.5,
                borderColor: "#E5E7EB",
                textAlign: "center",
                padding: 20,
                borderRadius: 16,
                color: "#09090b",
                fontSize: 32,
                fontWeight: "900",
                letterSpacing: 12,
              }}
              placeholder="000000"
              placeholderTextColor="#E5E7EB"
              keyboardType="numeric"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              editable={!isLoading}
              autoComplete="one-time-code"
              selectionColor="#EA580C"
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
              backgroundColor: isLoading ? "#EA580CB3" : "#EA580C",
            }}
            onPress={handleVerify}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                {isReset ? "Continue" : "Confirm"}
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
            <Text style={{ color: "#6B7280", fontSize: 14 }}>
              Didn't receive it?{" "}
            </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={countdown > 0 || isResending}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: countdown > 0 ? "#6B7280" : "#EA580C",
                }}
              >
                {isResending
                  ? "Sending..."
                  : countdown > 0
                    ? `Resend in ${countdown}s`
                    : "Resend code"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
