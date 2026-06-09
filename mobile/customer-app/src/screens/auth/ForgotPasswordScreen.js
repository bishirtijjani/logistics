import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import FormInput from "../../components/FormInput";
import AuthErrorBanner from "../../components/AuthErrorBanner";
import AuthBrandMark from "../../components/AuthBrandMark";
import { requestPasswordReset, clearError } from "../../store/slices/authSlice";
import { useTheme } from "../../theme";

export default function ForgotPasswordScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { isLoading } = useSelector((state) => state.auth);

  const schema = useMemo(
    () => z.object({ email: z.string().email(t("auth.form.emailInvalid")) }),
    [t],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  // Clear any error left over from a prior screen so the banner starts empty.
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const onSubmit = async ({ email }) => {
    dispatch(clearError());
    const result = await dispatch(requestPasswordReset(email));
    if (requestPasswordReset.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: t("auth.toast.resetCodeSent"),
        text2: t("auth.toast.resetCodeSentSub"),
      });
      navigation.navigate("OtpVerification", { email, mode: "reset" });
    } else {
      Toast.show({
        type: "error",
        text1: t("errors.title"),
        text2: result.payload || t("errors.UNKNOWN_ERROR"),
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
    >
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 56,
          paddingBottom: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 32 }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.back")}
            >
              <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
            </TouchableOpacity>
            <AuthBrandMark style={{ marginBottom: 0, marginLeft: 16 }} />
          </View>

          <View style={{ marginBottom: 36 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 38,
                fontWeight: "900",
                color: tokens.text.primary,
                letterSpacing: -1.5,
                marginBottom: 8,
                lineHeight: 44,
              }}
            >
              {t("auth.forgotTitle")}
            </Text>
            <Text style={{ fontSize: 15, color: tokens.text.muted }}>
              {t("auth.forgotSubtitle")}
            </Text>
          </View>

          <AuthErrorBanner />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label={t("auth.email")}
                icon="mail-outline"
                placeholder="john@example.com"
                error={errors.email?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
                returnKeyType="go"
                onSubmitEditing={handleSubmit(onSubmit)}
              />
            )}
          />

          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              marginTop: 4,
              backgroundColor: isLoading ? tokens.brand.strong : tokens.brand.default,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("auth.forgotCta")}
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color={tokens.text.onBrand} />
            ) : (
              <Text style={{ color: tokens.text.onBrand, fontSize: 15, fontWeight: "800" }}>
                {t("auth.forgotCta")}
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
            <Text style={{ color: tokens.text.muted, fontSize: 14 }}>
              {t("auth.rememberPassword")}{" "}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              accessibilityRole="link"
              accessibilityLabel={t("auth.signIn")}
            >
              <Text
                style={{ color: tokens.brand.strong, fontSize: 14, fontWeight: "700" }}
              >
                {t("auth.signIn")}
              </Text>
            </TouchableOpacity>
          </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
