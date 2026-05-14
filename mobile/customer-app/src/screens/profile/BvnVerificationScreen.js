import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Toast from "react-native-toast-message";
import FormInput from "../../components/FormInput";
import BvnConfirmSheet from "../../components/BvnConfirmSheet";
import { verifyBvn, requestKycPhoneOtp } from "../../store/slices/profileSlice";
import { colors } from "../../theme";

// Step 1 schema — full KYC details. OTP isn't collected yet because we haven't
// SMSed one. Submitting this triggers requestKycPhoneOtp(bvnPhone) which sends
// the code; only then do we move to the step-2 OTP entry.
const detailsSchema = z.object({
  bvn: z
    .string()
    .length(11, "BVN must be exactly 11 digits")
    .regex(/^\d{11}$/, "BVN must contain only digits"),
  firstName: z.string().min(2, "Enter your first name as on BVN"),
  lastName: z.string().min(2, "Enter your last name as on BVN"),
  // The phone tied to the BVN — must match the BVN record, not user.phone.
  bvnPhone: z
    .string()
    .regex(/^0[789][01]\d{8}$/, "Enter a valid Nigerian phone number"),
});

const RESEND_COOLDOWN = 60;

export default function BvnVerificationScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { profile, isUpdating } = useSelector((state) => state.profile);

  // Two-step KYC flow:
  //   step="details" → user enters BVN/name/phone, taps "Send code" → SMS goes out
  //   step="otp"     → user enters the 6-digit code, taps "Verify" → KatPay provisions NUBAN
  const [step, setStep] = useState("details");
  // Details captured at step 1 so step 2 can replay them on verify without
  // making the user re-enter anything if we navigate back.
  const [kycDraft, setKycDraft] = useState(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(null);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  // Server-driven flag. When false, the phone-OTP step is bypassed and the
  // BVN confirmation sheet stands in for the OTP entry as the only friction
  // between the form and KatPay account provisioning.
  const phoneOtpEnabled = profile?.kycPhoneOtpEnabled !== false;
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  // Server response after a successful verify: { kycStatus, wallet, virtualAccountReady }.
  // Held locally so we can render the NUBAN immediately without a profile refetch round-trip.
  const [verificationResult, setVerificationResult] = useState(null);
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef(null);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      bvn: "",
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      // Seed from signup phone but let the user override — BVN-linked phone
      // may differ from the one they registered with.
      bvnPhone: profile?.phone || "",
    },
  });

  // Start (or restart) the resend countdown. The server enforces a 60s cooldown
  // anyway; this just stops users tapping resend during that window.
  const startResendCooldown = () => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    setResendIn(RESEND_COOLDOWN);
    resendTimerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          clearInterval(resendTimerRef.current);
          resendTimerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  const onSubmitDetails = async (data) => {
    if (!phoneOtpEnabled) {
      // SMS-OTP bypass active — show the confirmation sheet in place of the
      // OTP entry step. The sheet's Confirm button submits straight to
      // verifyBvn.
      setKycDraft(data);
      setConfirmError(null);
      setShowConfirmSheet(true);
      return;
    }
    setIsRequestingOtp(true);
    try {
      const result = await dispatch(requestKycPhoneOtp({ bvnPhone: data.bvnPhone }));
      if (requestKycPhoneOtp.fulfilled.match(result)) {
        setKycDraft(data);
        setStep("otp");
        setOtp("");
        setOtpError(null);
        startResendCooldown();
        Toast.show({
          type: "success",
          text1: "Code sent",
          text2: `We sent a 6-digit code to ${data.bvnPhone}.`,
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Couldn't send code",
          text2: result.payload || "Please try again.",
        });
      }
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const onConfirmTrustedBvn = async () => {
    if (!kycDraft) return;
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const result = await dispatch(verifyBvn(kycDraft));
      if (verifyBvn.fulfilled.match(result)) {
        Toast.show({
          type: "success",
          text1: "BVN Verified",
          text2: "Your wallet account is being set up.",
        });
        setVerificationResult(result.payload);
        setShowConfirmSheet(false);
      } else {
        setConfirmError(result.payload || "Verification failed. Please try again.");
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const onResend = async () => {
    if (resendIn > 0 || isRequestingOtp || !kycDraft) return;
    setIsRequestingOtp(true);
    try {
      const result = await dispatch(requestKycPhoneOtp({ bvnPhone: kycDraft.bvnPhone }));
      if (requestKycPhoneOtp.fulfilled.match(result)) {
        startResendCooldown();
        setOtp("");
        setOtpError(null);
        Toast.show({ type: "success", text1: "Code resent" });
      } else {
        Toast.show({
          type: "error",
          text1: "Couldn't resend",
          text2: result.payload || "Please try again.",
        });
      }
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const onSubmitOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setOtpError("Enter the 6-digit code");
      return;
    }
    setOtpError(null);
    const result = await dispatch(verifyBvn({ ...kycDraft, otp }));
    if (verifyBvn.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "BVN Verified",
        text2: "Your wallet account is being set up.",
      });
      setVerificationResult(result.payload);
    } else {
      // The backend uses code KYC_OTP_INVALID / KYC_OTP_EXPIRED — surface a
      // generic message; the inline field error is enough.
      setOtpError(result.payload || "Verification failed. Try again.");
    }
  };

  const copyAccountNumber = async (acct) => {
    try {
      Clipboard.setString(acct);
      Toast.show({ type: "success", text1: "Account number copied" });
    } catch {
      // Clipboard is best-effort — not worth interrupting the flow.
    }
  };

  // Render the success view either: (a) right after a successful verification
  // in this session (verificationResult set), or (b) on revisit of an
  // already-verified account.
  const isVerified = verificationResult || profile?.kycStatus === "VERIFIED";
  if (isVerified) {
    const wallet =
      verificationResult?.wallet || profile?.wallet || null;
    const nuban = wallet?.virtualAccountNumber || null;
    const provisioningPending =
      verificationResult && !verificationResult.virtualAccountReady && !nuban;

    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={["top"]}
      >
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={{ height: 4, backgroundColor: colors.primary }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "900",
              color: colors.text,
              letterSpacing: -0.5,
            }}
          >
            Identity Verification
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, alignItems: "center" }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#D1FAE5",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Ionicons name="checkmark-circle" size={44} color="#059669" />
          </View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "900",
              color: colors.text,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            {verificationResult ? "BVN Verified" : "Already Verified"}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textMuted,
              textAlign: "center",
              lineHeight: 20,
              marginBottom: 28,
            }}
          >
            {verificationResult
              ? "Your identity is confirmed. Below is your wallet funding account."
              : "Your BVN has been verified. You have full access to all features."}
          </Text>

          {nuban ? (
            <View
              style={{
                width: "100%",
                backgroundColor: colors.surface,
                borderRadius: 18,
                padding: 20,
                borderWidth: 1.5,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.textMuted,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Your wallet account
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ flex: 1, fontSize: 24, fontWeight: "900", color: colors.text, letterSpacing: 1 }}>
                  {nuban}
                </Text>
                <TouchableOpacity onPress={() => copyAccountNumber(nuban)} style={{ padding: 8 }}>
                  <Ionicons name="copy-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 14, color: colors.text, fontWeight: "600", marginBottom: 4 }}>
                {wallet.virtualAccountBank || "—"}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                {wallet.virtualAccountName || "—"}
              </Text>
              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 18,
                }}
              >
                Transfer to this account from any bank to fund your wallet. Funds reflect within seconds.
              </Text>
            </View>
          ) : provisioningPending ? (
            <View
              style={{
                width: "100%",
                backgroundColor: "#FEF3C7",
                borderRadius: 18,
                padding: 20,
                borderWidth: 1,
                borderColor: "#FDE68A",
                alignItems: "center",
              }}
            >
              <ActivityIndicator color="#B45309" />
              <Text style={{ marginTop: 12, fontSize: 13, color: "#92400E", fontWeight: "600", textAlign: "center" }}>
                Setting up your wallet account…
              </Text>
              <Text style={{ marginTop: 6, fontSize: 12, color: "#92400E", textAlign: "center", lineHeight: 18 }}>
                We'll notify you the moment it's ready (usually a few seconds).
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              marginTop: 28,
              backgroundColor: colors.primary,
              paddingVertical: 14,
              paddingHorizontal: 32,
              borderRadius: 14,
              alignSelf: "stretch",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
              Done
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const onHeaderBack = () => {
    if (step === "otp") {
      // Let the user go back to edit details (e.g. fix a typo'd phone) without
      // leaving the screen entirely.
      setStep("details");
      setOtpError(null);
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={onHeaderBack}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          {t("bvn.title")}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {step === "details" ? (
            <>
              {/* Info Banner */}
              <View
                style={{
                  backgroundColor: "#EFF6FF",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: "#BFDBFE",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={22}
                    color="#2563EB"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: colors.text,
                    }}
                  >
                    Why we need your BVN
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    lineHeight: 20,
                  }}
                >
                  {"•"} Confirms your identity to prevent fraud{"\n"}
                  {"•"} Required by CBN regulations for financial services{"\n"}
                  {"•"} We never store your BVN in plain text{"\n"}
                  {"•"} Your data is encrypted and secure
                </Text>
              </View>

              <Controller
                control={control}
                name="bvn"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Bank Verification Number (BVN)"
                    icon="finger-print-outline"
                    placeholder="Enter 11-digit BVN"
                    error={errors.bvn?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    keyboardType="number-pad"
                    maxLength={11}
                    editable={!isRequestingOtp}
                  />
                )}
              />

              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="First name (as on BVN)"
                    icon="person-outline"
                    placeholder="First name"
                    error={errors.firstName?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isRequestingOtp}
                  />
                )}
              />

              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Last name (as on BVN)"
                    icon="person-outline"
                    placeholder="Last name"
                    error={errors.lastName?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isRequestingOtp}
                  />
                )}
              />

              <Controller
                control={control}
                name="bvnPhone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Phone number linked to BVN"
                    icon="call-outline"
                    placeholder="e.g. 08012345678"
                    error={errors.bvnPhone?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    keyboardType="phone-pad"
                    maxLength={11}
                    editable={!isRequestingOtp}
                  />
                )}
              />

              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 18,
                  marginTop: -4,
                  marginBottom: 12,
                  paddingHorizontal: 4,
                }}
              >
                {phoneOtpEnabled
                  ? "We'll send a verification code to this number. Use the phone your BVN is registered with — it may differ from the one you signed up with."
                  : "Use the phone your BVN is registered with — it may differ from the one you signed up with. You'll get to double-check before submitting."}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginTop: 8,
                  marginBottom: 20,
                  paddingHorizontal: 4,
                }}
              >
                <Ionicons
                  name="lock-closed"
                  size={14}
                  color={colors.textLight}
                  style={{ marginRight: 6, marginTop: 2 }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textLight,
                    flex: 1,
                    lineHeight: 18,
                  }}
                >
                  Your BVN is securely hashed and never stored in plain text.
                  We only use it to verify your identity.
                </Text>
              </View>

              <TouchableOpacity
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 16,
                  alignItems: "center",
                  backgroundColor: isRequestingOtp ? "#EA580CB3" : colors.primary,
                }}
                onPress={handleSubmit(onSubmitDetails)}
                disabled={isRequestingOtp}
                activeOpacity={0.8}
              >
                {isRequestingOtp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                    {phoneOtpEnabled ? "Send verification code" : "Review & confirm"}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View
                style={{
                  backgroundColor: "#EFF6FF",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: "#BFDBFE",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Ionicons
                    name="chatbox-ellipses"
                    size={22}
                    color="#2563EB"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>
                    Enter your verification code
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 20 }}>
                  We sent a 6-digit code to{" "}
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    {kycDraft?.bvnPhone || getValues("bvnPhone")}
                  </Text>
                  . It expires in 10 minutes.
                </Text>
              </View>

              <FormInput
                label="Verification code"
                icon="keypad-outline"
                placeholder="6-digit code"
                value={otp}
                onChangeText={(v) => {
                  setOtp(v.replace(/\D/g, ""));
                  if (otpError) setOtpError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                error={otpError}
                editable={!isUpdating}
              />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 4,
                  marginBottom: 20,
                  paddingHorizontal: 4,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setStep("details");
                    setOtpError(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit phone number"
                  disabled={isUpdating}
                >
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "700" }}>
                    Wrong number? Edit
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onResend}
                  disabled={resendIn > 0 || isRequestingOtp || isUpdating}
                  accessibilityRole="button"
                  accessibilityLabel="Resend verification code"
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: resendIn > 0 ? colors.textMuted : colors.primary,
                    }}
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 16,
                  alignItems: "center",
                  backgroundColor: isUpdating ? "#EA580CB3" : colors.primary,
                }}
                onPress={onSubmitOtp}
                disabled={isUpdating}
                activeOpacity={0.8}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                    Verify & activate wallet
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BvnConfirmSheet
        isVisible={showConfirmSheet}
        onClose={() => {
          if (!isConfirming) {
            setShowConfirmSheet(false);
            setConfirmError(null);
          }
        }}
        onConfirm={onConfirmTrustedBvn}
        details={kycDraft}
        submitting={isConfirming}
        error={confirmError}
      />
    </SafeAreaView>
  );
}
