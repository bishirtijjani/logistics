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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Toast from "react-native-toast-message";
import FormInput from "../../components/FormInput";
import { updateProfile } from "../../store/slices/profileSlice";
import { retryProvisioning, fetchWallet } from "../../store/slices/walletSlice";
import { useTheme } from "../../theme";

// One-time phone capture for legacy riders created before phone became a signup
// requirement. KatPay mints the wallet NUBAN under the rider's phone, so these
// accounts can't be provisioned until a phone is on file. No OTP/verification -
// we just save it and kick off provisioning.
export default function PhoneCaptureScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const profile = useSelector((s) => s.profile?.profile);
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    phone: z
      .string()
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
          text1: t("common.error", "Couldn't save"),
          text2: saved.payload || t("common.tryAgain", "Please try again."),
        });
        return;
      }
      // Phone is on file - provision the NUBAN under it, then give the worker a
      // moment so the account is visible the instant we return to the wallet.
      await dispatch(retryProvisioning());
      for (let i = 0; i < 4; i += 1) {
        const w = await dispatch(fetchWallet());
        const acct = w?.payload?.accountNumber || w?.payload?.virtualAccountNumber;
        if (acct) break;
        await new Promise((r) => setTimeout(r, 4000));
      }
      Toast.show({
        type: "success",
        text1: t("wallet.phoneSaved", "Phone saved"),
        text2: t("wallet.accountSettingUp", "Setting up your wallet account."),
      });
      goBackOr(navigation);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={tokens.bg.canvas} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}
        >
          {t("wallet.addPhoneTitle", "Add your phone number")}
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {/* Info banner */}
          <View
            style={{
              backgroundColor: tokens.brand.soft,
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: tokens.brand.softBorder,
              flexDirection: "row",
              alignItems: "flex-start",
            }}
          >
            <Ionicons name="call" size={18} color={tokens.brand.strong} style={{ marginTop: 1 }} />
            <Text style={{ marginLeft: 8, flex: 1, fontSize: 13, color: tokens.text.primary, lineHeight: 19 }}>
              {t(
                "wallet.addPhoneBody",
                "We create your wallet account using your phone number. Add it once and your account is ready in seconds.",
              )}
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
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.saveAndActivate", "Save and activate")}
            style={{
              marginTop: 8,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: tokens.brand.default,
              alignItems: "center",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color={tokens.text.onBrand} />
            ) : (
              <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
                {t("wallet.saveAndActivate", "Save and activate")}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
