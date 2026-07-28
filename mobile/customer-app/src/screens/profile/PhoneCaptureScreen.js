import React, { useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
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
import { updateProfile } from "../../store/slices/profileSlice";
import { retryProvisioning } from "../../store/slices/walletSlice";
import { useTheme } from "../../theme";

// One-time phone capture for legacy accounts created before phone became a
// signup requirement. KatPay mints the wallet NUBAN under the user's phone, so
// these accounts can't be provisioned until a phone is on file. We save it via
// the normal profile update, then kick off provisioning right away.
export default function PhoneCaptureScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  const { profile } = useSelector((state) => state.profile);
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    phone: z
      .string()
      .trim()
      .regex(/^0[789][01]\d{8}$/, t("auth.form.phoneInvalid")),
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { phone: profile?.phone || "" },
  });

  const onSubmit = async ({ phone }) => {
    setSubmitting(true);
    try {
      const saved = await dispatch(updateProfile({ phone }));
      if (updateProfile.rejected.match(saved)) {
        Toast.show({
          type: "error",
          text1: t("errors.title"),
          text2: saved.payload || t("errors.UNKNOWN_ERROR"),
        });
        return;
      }
      // Phone is on file now - provision the NUBAN under it. The worker is
      // idempotent and FundWallet will poll for the account, so we don't need
      // to block on the result here.
      await dispatch(retryProvisioning());
      Toast.show({
        type: "success",
        text1: "Phone saved",
        text2: "Setting up your wallet account.",
      });
      navigation.replace("FundWallet");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
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
          Add your phone number
        </Text>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {/* Info Banner */}
          <View
            style={{
              backgroundColor: tokens.status.infoSoft,
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: tokens.status.infoSoftBorder,
              flexDirection: "row",
              alignItems: "flex-start",
            }}
          >
            <Ionicons
              name="call"
              size={20}
              color={tokens.status.info}
              style={{ marginRight: 10, marginTop: 1 }}
            />
            <Text style={{ flex: 1, fontSize: 13, color: tokens.text.muted, lineHeight: 20 }}>
              We create your wallet account using your phone number. Add it once
              and your account is ready in seconds.
            </Text>
          </View>

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label={t("auth.phone")}
                icon="call-outline"
                placeholder="08012345678"
                error={errors.phone?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={11}
                editable={!submitting}
              />
            )}
          />

          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              marginTop: 8,
              backgroundColor: tokens.brand.default,
              opacity: submitting ? 0.7 : 1,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Save and activate"
          >
            {submitting ? (
              <ActivityIndicator color={tokens.text.onBrand} />
            ) : (
              <Text style={{ color: tokens.text.onBrand, fontSize: 15, fontWeight: "800" }}>
                Save and activate
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
