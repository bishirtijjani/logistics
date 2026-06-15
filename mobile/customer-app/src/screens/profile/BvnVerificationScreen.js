import React, { useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { verifyBvn } from "../../store/slices/profileSlice";
import { useTheme } from "../../theme";

// Trust-based KYC details. The user supplies their BVN, name, and the phone
// linked to their BVN. There is no SMS OTP step - submitting opens a
// confirmation sheet, and confirming there provisions the wallet.
const detailsSchema = z.object({
  bvn: z
    .string()
    .length(11, "BVN must be exactly 11 digits")
    .regex(/^\d{11}$/, "BVN must contain only digits"),
  firstName: z.string().min(2, "Enter your first name as on BVN"),
  lastName: z.string().min(2, "Enter your last name as on BVN"),
  // The phone tied to the BVN - may differ from user.phone.
  bvnPhone: z
    .string()
    .regex(/^0[789][01]\d{8}$/, "Enter a valid Nigerian phone number"),
});

export default function BvnVerificationScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  const { profile } = useSelector((state) => state.profile);
  // Recovery mode: caller (FundWallet) detected the user is verified but has
  // no NUBAN/phone, and routed here to re-submit. We need to render the form
  // (not the "Already Verified" success view) because the recovery branch in
  // verifyBvn requires the same BVN + a bvnPhone to finish provisioning.
  const isRecovery = Boolean(route?.params?.recovery);

  // Details captured from the form so the confirmation sheet can replay them
  // on verify without making the user re-enter anything.
  const [kycDraft, setKycDraft] = useState(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  // Server response after a successful verify: { kycStatus, wallet, virtualAccountReady }.
  // Held locally so we can render the NUBAN immediately without a profile refetch round-trip.
  const [verificationResult, setVerificationResult] = useState(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      bvn: "",
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      // Seed from signup phone but let the user override - BVN-linked phone
      // may differ from the one they registered with.
      bvnPhone: profile?.phone || "",
    },
  });

  // KYC is trust-based: submitting the form opens the confirmation sheet, and
  // confirming there provisions the wallet. No SMS OTP step.
  const onSubmitDetails = (data) => {
    setKycDraft(data);
    setConfirmError(null);
    setShowConfirmSheet(true);
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

  const copyAccountNumber = async (acct) => {
    try {
      Clipboard.setString(acct);
      Toast.show({ type: "success", text1: "Account number copied" });
    } catch {
      // Clipboard is best-effort - not worth interrupting the flow.
    }
  };

  // Recovery mode: account was verified but has no phone on file (legacy users
  // verified before bvnPhone-adoption landed). Either the caller set
  // route.params.recovery (FundWallet's BVN_PHONE_MISSING handler) or we
  // detect the same condition from profile state. Force the form view so the
  // user can re-submit - backend's RECOVERY branch enforces same-BVN.
  const needsRecovery =
    isRecovery ||
    (profile?.kycStatus === "VERIFIED" && !profile?.phone && !verificationResult);

  // Render the success view either: (a) right after a successful verification
  // in this session (verificationResult set), or (b) on revisit of an
  // already-verified account - but NOT when the account is in recovery mode.
  const isVerified =
    verificationResult || (profile?.kycStatus === "VERIFIED" && !needsRecovery);
  if (isVerified) {
    const wallet =
      verificationResult?.wallet || profile?.wallet || null;
    const nuban = wallet?.virtualAccountNumber || null;
    const provisioningPending =
      verificationResult && !verificationResult.virtualAccountReady && !nuban;

    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
        edges={["top"]}
      >
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />
        <View style={{ height: 4, backgroundColor: tokens.brand.default }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => goBackOr(navigation)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: tokens.bg.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "900",
              color: tokens.text.primary,
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
              backgroundColor: tokens.status.successSoft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Ionicons name="checkmark-circle" size={44} color={tokens.status.successStrong} />
          </View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "900",
              color: tokens.text.primary,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            {verificationResult ? "BVN Verified" : "Already Verified"}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: tokens.text.muted,
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
                backgroundColor: tokens.bg.surface,
                borderRadius: 18,
                padding: 20,
                borderWidth: 1.5,
                borderColor: tokens.border.default,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: tokens.text.muted,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Your wallet account
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ flex: 1, fontSize: 24, fontWeight: "900", color: tokens.text.primary, letterSpacing: 1 }}>
                  {nuban}
                </Text>
                <TouchableOpacity onPress={() => copyAccountNumber(nuban)} style={{ padding: 8 }}>
                  <Ionicons name="copy-outline" size={20} color={tokens.brand.default} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 14, color: tokens.text.primary, fontWeight: "600", marginBottom: 4 }}>
                {wallet.virtualAccountBank || "-"}
              </Text>
              <Text style={{ fontSize: 13, color: tokens.text.muted }}>
                {wallet.virtualAccountName || "-"}
              </Text>
              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  color: tokens.text.muted,
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
                backgroundColor: tokens.status.warningSoft,
                borderRadius: 18,
                padding: 20,
                borderWidth: 1,
                borderColor: tokens.status.warning,
                alignItems: "center",
              }}
            >
              <ActivityIndicator color={tokens.status.warningStrong} />
              <Text style={{ marginTop: 12, fontSize: 13, color: tokens.status.warningStrong, fontWeight: "600", textAlign: "center" }}>
                Setting up your wallet account…
              </Text>
              <Text style={{ marginTop: 6, fontSize: 12, color: tokens.status.warningStrong, textAlign: "center", lineHeight: 18 }}>
                We'll notify you the moment it's ready (usually a few seconds).
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => goBackOr(navigation)}
            style={{
              marginTop: 28,
              backgroundColor: tokens.brand.default,
              paddingVertical: 14,
              paddingHorizontal: 32,
              borderRadius: 14,
              alignSelf: "stretch",
              alignItems: "center",
            }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
              Done
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      edges={["top"]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

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
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: tokens.text.primary,
            letterSpacing: -0.5,
          }}
        >
          {t("bvn.title")}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {needsRecovery && (
            <View
              style={{
                backgroundColor: tokens.status.warningSoft,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: tokens.status.warning,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <Ionicons name="warning" size={20} color={tokens.status.warningStrong} style={{ marginRight: 10, marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: tokens.status.warningStrong, marginBottom: 4 }}>
                  Finish setting up your wallet
                </Text>
                <Text style={{ fontSize: 12, lineHeight: 18, color: tokens.status.warningStrong }}>
                  Your identity is verified, but we still need the phone number linked to your BVN to
                  create your wallet account. Please re-enter the same BVN you used before, plus your
                  BVN-linked phone.
                </Text>
              </View>
            </View>
          )}
          {/* Info Banner */}
          <View
            style={{
              backgroundColor: tokens.status.infoSoft,
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: tokens.status.infoSoftBorder,
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
                color={tokens.status.info}
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: tokens.text.primary,
                }}
              >
                Why we need your BVN
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: tokens.text.muted,
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
                editable={!isConfirming}
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
                editable={!isConfirming}
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
                editable={!isConfirming}
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
                editable={!isConfirming}
              />
            )}
          />

          <Text
            style={{
              fontSize: 12,
              color: tokens.text.muted,
              lineHeight: 18,
              marginTop: -4,
              marginBottom: 12,
              paddingHorizontal: 4,
            }}
          >
            Use the phone your BVN is registered with, it may differ from the one you signed up with. You'll get to double-check before submitting.
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
              color={tokens.text.placeholder}
              style={{ marginRight: 6, marginTop: 2 }}
            />
            <Text
              style={{
                fontSize: 12,
                color: tokens.text.muted,
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
              backgroundColor: tokens.brand.default,
            }}
            onPress={handleSubmit(onSubmitDetails)}
            disabled={isConfirming}
            activeOpacity={0.8}
          >
            <Text style={{ color: tokens.text.onBrand, fontSize: 15, fontWeight: "800" }}>
              Review & confirm
            </Text>
          </TouchableOpacity>
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
