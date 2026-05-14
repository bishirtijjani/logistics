import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { register, clearError } from "../../store/slices/authSlice";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import FormInput from "../../components/FormInput";
import AuthErrorBanner from "../../components/AuthErrorBanner";
import { colors } from "../../theme";

export default function RegisterScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isLoading } = useSelector((state) => state.auth);

  // Focus Refs for Keyboard Navigation
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Schema lives inside the component so validation messages localize.
  // Memoized on `t` so it only rebuilds when the locale changes.
  const registerSchema = useMemo(
    () =>
      z.object({
        firstName: z.string().min(2, t("auth.form.firstNameRequired")),
        lastName: z.string().min(2, t("auth.form.lastNameRequired")),
        email: z.string().email(t("auth.form.emailInvalid")),
        password: z.string().min(8, t("auth.form.passwordTooShort")),
      }),
    [t],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  // Start with a clean error state so a previous screen's failure doesn't
  // appear in this screen's banner.
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const onSubmit = async (data) => {
    dispatch(clearError());
    const resultAction = await dispatch(
      register({
        ...data,
        role: "CUSTOMER",
      }),
    );

    if (register.fulfilled.match(resultAction)) {
      Toast.show({
        type: "success",
        text1: t("auth.toast.accountCreated"),
        text2: t("auth.toast.otpSent"),
      });
      navigation.navigate("OtpVerification", { email: data.email });
    } else {
      Toast.show({
        type: "error",
        text1: t("errors.title"),
        text2: resultAction.payload || t("errors.UNKNOWN_ERROR"),
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1 }}
    >
      <View style={{ height: 4, backgroundColor: colors.primary }} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 52 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={{ marginBottom: 32 }}>
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
              {t("auth.registerTitle")}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted }}>
              {t("auth.registerSubtitle")}
            </Text>
          </View>

          <AuthErrorBanner />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label={t("auth.firstName")}
                    icon="person-outline"
                    placeholder="John"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.firstName?.message}
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    ref={lastNameRef}
                    label={t("auth.lastName")}
                    icon="person-outline"
                    placeholder="Doe"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.lastName?.message}
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                ref={emailRef}
                label={t("auth.email")}
                icon="mail-outline"
                placeholder="john@example.com"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                ref={passwordRef}
                label={t("auth.password")}
                icon="lock-closed-outline"
                placeholder={t("auth.password")}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.password?.message}
                secureTextEntry
                editable={!isLoading}
                returnKeyType="join"
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
            accessibilityLabel={t("auth.signUp")}
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                {t("auth.signUp")}
              </Text>
            )}
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginTop: 20,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {t("auth.hasAccount")}{" "}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              accessibilityRole="link"
              accessibilityLabel={t("auth.signIn")}
            >
              <Text
                style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}
              >
                {t("auth.signIn")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
