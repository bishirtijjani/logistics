import React, { useState } from "react";
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
import { verifyBvn } from "../../store/slices/profileSlice";
import { colors } from "../../theme";

const schema = z.object({
  bvn: z
    .string()
    .length(11, "BVN must be exactly 11 digits")
    .regex(/^\d{11}$/, "BVN must contain only digits"),
  firstName: z.string().min(2, "Enter your first name as on BVN"),
  lastName: z.string().min(2, "Enter your last name as on BVN"),
});

export default function BvnVerificationScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { profile, isUpdating } = useSelector((state) => state.profile);
  // Server response after a successful KYC: { kycStatus, wallet, virtualAccountReady }.
  // Stashed locally so we can render the NUBAN immediately without waiting for
  // a profile refetch round-trip.
  const [verificationResult, setVerificationResult] = useState(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      bvn: "",
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
    },
  });

  const onSubmit = async (data) => {
    const result = await dispatch(verifyBvn(data));
    if (verifyBvn.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "BVN Verified",
        text2: "Your wallet account is being set up.",
      });
      setVerificationResult(result.payload);
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
          onPress={() => navigation.goBack()}
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
              {"\u2022"} Confirms your identity to prevent fraud{"\n"}
              {"\u2022"} Required by CBN regulations for financial services
              {"\n"}
              {"\u2022"} We never store your BVN in plain text{"\n"}
              {"\u2022"} Your data is encrypted and secure
            </Text>
          </View>

          {/* Form */}
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
                editable={!isUpdating}
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
                editable={!isUpdating}
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
                editable={!isUpdating}
              />
            )}
          />

          {/* Disclaimer */}
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
              Your BVN is securely hashed and never stored in plain text. We
              only use it to verify your identity.
            </Text>
          </View>

          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: isUpdating ? "#EA580CB3" : colors.primary,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            {isUpdating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                Verify BVN
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
