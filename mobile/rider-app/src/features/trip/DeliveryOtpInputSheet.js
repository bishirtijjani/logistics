import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { generatePodOtp } from "../../store/slices/tripSlice";

const OTP_LENGTH = 6;

/**
 * DeliveryOtpInputSheet - rider enters the 6-digit code the customer reads
 * aloud. The sheet also hosts the "Send code to customer" CTA which calls
 * `POST /requests/:id/pod-otp/generate` (rate-limited to 3/10min on the
 * server). On submit, the parent's `onSubmit(otp)` callback runs - typically
 * the cockpit's "complete delivery" thunk.
 *
 * The sheet does NOT validate the OTP itself - the server does that during
 * the DELIVERED PATCH. We trap `POD_OTP_MISMATCH` upstream and surface a
 * shake animation + "Wrong code" toast.
 */
export default function DeliveryOtpInputSheet({
  visible,
  onClose,
  onSubmit,
  requestId,
  submitting,
  errorCode,
}) {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const otpRequested = useSelector((s) => s.trip.pod?.otpRequested);
  const otpAttempts = useSelector((s) => s.trip.pod?.otpAttempts || 0);
  const otpError = useSelector((s) => s.trip.error?.phase === "podOtpGenerate" ? s.trip.error : null);

  const [otp, setOtp] = useState("");
  const [generating, setGenerating] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // Auto-focus the input on open after a brief delay so the modal
      // animation completes first.
      const id = setTimeout(() => inputRef.current?.focus?.(), 250);
      return () => clearTimeout(id);
    } else {
      setOtp("");
    }
  }, [visible]);

  // Bounce the input when the server reports a bad OTP (POD_OTP_MISMATCH).
  useEffect(() => {
    if (errorCode === "POD_OTP_MISMATCH") {
      try { Vibration.vibrate(150); } catch (_) {}
      setOtp("");
      setTimeout(() => inputRef.current?.focus?.(), 100);
    }
  }, [errorCode]);

  const sendCode = async () => {
    if (!requestId || generating) return;
    setGenerating(true);
    try {
      const action = await dispatch(generatePodOtp({ requestId }));
      if (action.meta.requestStatus === "fulfilled") {
        Toast.show({
          type: "success",
          text1: t("pod.otp.sentTitle", "Code sent"),
          text2: t("pod.otp.sentSub", "Ask the customer to read the 6-digit code."),
        });
      } else {
        const code = action.payload?.code;
        if (code === "POD_OTP_RATE_LIMITED") {
          const retry = action.payload?.retryAfterSeconds || 0;
          const mins = Math.max(1, Math.ceil(retry / 60));
          Toast.show({
            type: "error",
            text1: t("pod.otp.rateLimitedTitle", "Slow down"),
            text2: t("pod.otp.rateLimitedSub", "Try again in {{minutes}} min.", { minutes: mins }),
          });
        } else if (code === "POD_OTP_NOT_REQUIRED") {
          Toast.show({
            type: "info",
            text1: t("pod.otp.notRequiredTitle", "No code needed"),
            text2: t("pod.otp.notRequiredSub", "This order doesn't require an OTP."),
          });
        } else {
          Toast.show({
            type: "error",
            text1: t("pod.otp.sendFailed", "Couldn't send the code"),
            text2: action.payload?.message || t("pod.otp.tryAgain", "Try again."),
          });
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  const onChange = (text) => {
    // Numeric only, max OTP_LENGTH.
    const clean = String(text || "").replace(/\D/g, "").slice(0, OTP_LENGTH);
    setOtp(clean);
  };

  const canSubmit = otp.length === OTP_LENGTH && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit?.(otp);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: tokens.overlay.scrim, justifyContent: "flex-end" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            backgroundColor: tokens.bg.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
          }}
        >
          <SafeAreaView edges={["bottom"]}>
            <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 }}>
              <View
                style={{
                  alignSelf: "center", width: 38, height: 4, borderRadius: 2,
                  backgroundColor: tokens.border.strong, marginBottom: 14,
                }}
              />

              <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 8 }}>
                <View
                  style={{
                    width: 38, height: 38, borderRadius: 19,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: tokens.brand.soft,
                    borderWidth: 1, borderColor: tokens.brand.softBorder,
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="keypad-outline" size={20} color={tokens.brand.strong} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
                    {t("pod.otp.title", "Customer's delivery code")}
                  </Text>
                  <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 3 }}>
                    {t("pod.otp.subtitle", "Ask the customer for the 6-digit code their app shows.")}
                  </Text>
                </View>
              </View>

              {/* Send code CTA */}
              <TouchableOpacity
                onPress={sendCode}
                disabled={generating || submitting}
                accessibilityRole="button"
                accessibilityState={{ disabled: generating || submitting, busy: generating }}
                accessibilityLabel={otpRequested
                  ? t("pod.otp.resendAria", "Resend code")
                  : t("pod.otp.sendAria", "Send code to customer")}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "center",
                  paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
                  backgroundColor: otpRequested ? tokens.bg.surfaceMuted : tokens.brand.soft,
                  borderWidth: 1,
                  borderColor: otpRequested ? tokens.border.default : tokens.brand.softBorder,
                  marginTop: 14, marginBottom: 18,
                  opacity: (generating || submitting) ? 0.6 : 1,
                }}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={tokens.brand.strong} />
                ) : (
                  <>
                    <Ionicons
                      name={otpRequested ? "refresh-outline" : "paper-plane-outline"}
                      size={16}
                      color={otpRequested ? tokens.text.primary : tokens.brand.strong}
                    />
                    <Text
                      style={{
                        marginLeft: 8,
                        fontWeight: "700",
                        color: otpRequested ? tokens.text.primary : tokens.brand.strong,
                        fontSize: 13,
                      }}
                    >
                      {otpRequested
                        ? t("pod.otp.resend", "Resend code ({{count}}/3)", { count: otpAttempts })
                        : t("pod.otp.send", "Send code to customer")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* 6-digit input - using a single TextInput with letter-spacing for visual chunking. */}
              <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 8, letterSpacing: 0.5 }}>
                {t("pod.otp.inputLabel", "ENTER CODE")}
              </Text>
              <TextInput
                ref={inputRef}
                value={otp}
                onChangeText={onChange}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                accessibilityLabel={t("pod.otp.inputAria", "Delivery code input")}
                placeholder="••••••"
                placeholderTextColor={tokens.text.placeholder}
                style={{
                  borderWidth: 2,
                  borderColor: errorCode === "POD_OTP_MISMATCH" ? tokens.status.error : tokens.border.strong,
                  borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 14,
                  fontSize: 22, fontWeight: "700",
                  letterSpacing: 10,
                  color: tokens.text.primary,
                  textAlign: "center",
                  backgroundColor: tokens.bg.surfaceMuted,
                }}
              />

              {errorCode === "POD_OTP_MISMATCH" ? (
                <Text style={{ marginTop: 8, fontSize: 13, fontWeight: "600", color: tokens.status.errorStrong, textAlign: "center" }}>
                  {t("pod.otp.mismatch", "That code doesn't match. Ask the customer to read it again.")}
                </Text>
              ) : errorCode === "POD_OTP_NOT_ISSUED" ? (
                <Text style={{ marginTop: 8, fontSize: 13, fontWeight: "600", color: tokens.status.warningStrong, textAlign: "center" }}>
                  {t("pod.otp.notIssued", "No code issued yet. Tap Send code first.")}
                </Text>
              ) : otpError ? (
                <Text style={{ marginTop: 8, fontSize: 13, fontWeight: "600", color: tokens.status.errorStrong, textAlign: "center" }}>
                  {otpError.message}
                </Text>
              ) : null}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={t("pod.otp.notNow", "Not now")}
                  style={{
                    flex: 1, paddingVertical: 14, borderRadius: 12,
                    alignItems: "center", backgroundColor: tokens.bg.surfaceMuted,
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: tokens.text.primary, fontWeight: "700", fontSize: 14 }}>
                    {t("pod.otp.notNow", "Not now")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submit}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSubmit, busy: submitting }}
                  accessibilityLabel={t("pod.otp.submitAria", "Submit code and complete delivery")}
                  style={{
                    flex: 2, paddingVertical: 14, borderRadius: 12,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: canSubmit ? tokens.brand.default : tokens.border.strong,
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color={tokens.text.onBrand} />
                  ) : (
                    <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
                      {t("pod.otp.submit", "Complete delivery")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
