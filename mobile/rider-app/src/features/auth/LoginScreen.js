import React, { useEffect, useMemo, useRef } from "react";
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
import { useDispatch, useSelector } from "react-redux";
import { login, clearError } from "../../store/slices/authSlice";
import { useForm, Controller } from "react-hook-form";
import FormInput from "../../components/FormInput";
import AuthErrorBanner from "../../components/AuthErrorBanner";
import AuthBrandMark from "../../components/AuthBrandMark";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { colors, light } from "../../theme";

const LAST_EMAIL_KEY = "vtu_last_email";

export default function LoginScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isLoading } = useSelector((state) => state.auth);
  const passwordRef = useRef(null);

  // Schema is memoized on `t` so the validation messages re-evaluate when
  // the locale changes mid-session (rare, but the right shape).
  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t("auth.form.emailInvalid")),
        password: z.string().min(1, t("auth.form.passwordRequired")),
      }),
    [t],
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Load last used email on mount; also clear any stale auth error left over
  // from a previous screen (e.g., session-expired bounce) so this screen
  // starts clean.
  useEffect(() => {
    dispatch(clearError());
    const loadLastEmail = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(LAST_EMAIL_KEY);
        if (savedEmail) {
          setValue("email", savedEmail);
        }
      } catch (e) {
        console.error("Failed to load email", e);
      }
    };
    loadLastEmail();
  }, [setValue, dispatch]);

  const onSubmit = async (data) => {
    dispatch(clearError());
    const resultAction = await dispatch(login(data));

    if (login.fulfilled.match(resultAction)) {
      // Remember email on success
      await AsyncStorage.setItem(LAST_EMAIL_KEY, data.email);
      Toast.show({ type: "success", text1: t("auth.toast.welcomeBack") });
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: light.bg.canvas }}
    >
      <View style={{ height: 4, backgroundColor: colors.primary }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <AuthBrandMark />

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
              {t("auth.loginTitle")}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted }}>
              {t("auth.loginSubtitle")}
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
                error={errors.password?.message}
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
            style={{ alignSelf: "flex-end", marginBottom: 20, marginTop: -8 }}
            onPress={() => navigation.navigate("ForgotPassword")}
            accessibilityRole="link"
            accessibilityLabel={t("auth.forgotPassword")}
          >
            <Text style={{ color: colors.primaryStrong, fontSize: 14, fontWeight: "600" }}>
              {t("auth.forgotPassword")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: isLoading ? "#EA580CB3" : colors.primary,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("auth.signIn")}
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                {t("auth.signIn")}
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
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {t("auth.noAccount")}{" "}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Register")}
              accessibilityRole="link"
              accessibilityLabel={t("auth.signUp")}
            >
              <Text
                style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}
              >
                {t("auth.signUp")}
              </Text>
            </TouchableOpacity>
          </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
