import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
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
import { resetPassword, clearError } from "../../store/slices/authSlice";
import { colors } from "../../theme";

export default function ResetPasswordScreen({ route, navigation }) {
  const { email, code } = route.params || {};
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isLoading } = useSelector((state) => state.auth);
  const confirmRef = useRef(null);

  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(8, t("auth.form.passwordTooShort")),
          confirmPassword: z.string().min(1, t("auth.form.passwordRequired")),
        })
        .refine((d) => d.password === d.confirmPassword, {
          message: t("auth.form.passwordMismatch"),
          path: ["confirmPassword"],
        }),
    [t],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Clear any error left over from a prior screen so the banner starts empty.
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const onSubmit = async ({ password }) => {
    dispatch(clearError());
    const result = await dispatch(
      resetPassword({ email, code, newPassword: password }),
    );

    if (resetPassword.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: t("auth.passwordResetToast"),
        text2: t("auth.passwordResetToastSub"),
      });
      // Navigate back to Login and clear the reset stack
      navigation.navigate("Login");
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
      behavior="padding"
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ height: 4, backgroundColor: colors.primary }} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginBottom: 32 }}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={{ marginBottom: 36 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 38,
                fontWeight: "900",
                color: colors.text,
                letterSpacing: -1.5,
                marginBottom: 8,
                lineHeight: 44,
              }}
            >
              {t("auth.resetTitle")}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted }}>
              {t("auth.resetSubtitle")}
            </Text>
          </View>

          <AuthErrorBanner />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label={t("auth.newPassword")}
                icon="lock-closed-outline"
                placeholder={t("auth.form.passwordTooShort")}
                error={errors.password?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                secureTextEntry
                editable={!isLoading}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                ref={confirmRef}
                label={t("auth.confirmPassword")}
                icon="lock-closed-outline"
                placeholder={t("auth.confirmPassword")}
                error={errors.confirmPassword?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                secureTextEntry
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
              backgroundColor: isLoading ? "#EA580CB3" : colors.primary,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("auth.resetCta")}
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                {t("auth.resetCta")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
