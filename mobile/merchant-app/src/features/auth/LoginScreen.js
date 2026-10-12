import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import FormInput from "../../components/FormInput";
import AuthBrandMark from "../../components/AuthBrandMark";
import AuthErrorBanner from "../../components/AuthErrorBanner";
import { login } from "../../store/slices/authSlice";

export default function LoginScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { isLoading } = useSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const onSubmit = async () => {
    setLocalError("");
    if (!email.trim() || !password) {
      setLocalError(t("auth.errors.requireEmailPassword", "Enter your email and password."));
      return;
    }
    await dispatch(login({ email: email.trim().toLowerCase(), password }));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <AuthBrandMark />
        <Text style={{ fontSize: 26, fontWeight: "800", color: tokens.text.primary, marginBottom: 4 }}>
          {t("auth.loginTitle", "Welcome back")}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.text.muted, marginBottom: 24 }}>
          {t("auth.loginSubtitle", "Sign in to manage your store")}
        </Text>

        <AuthErrorBanner />
        {localError ? (
          <Text style={{ color: tokens.status.error, marginBottom: 12, fontWeight: "600" }}>{localError}</Text>
        ) : null}

        <FormInput
          label={t("auth.email", "Email")}
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
          textContentType="emailAddress"
        />
        <FormInput
          label={t("auth.password", "Password")}
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          textContentType="password"
          onSubmitEditing={onSubmit}
          returnKeyType="go"
        />

        <TouchableOpacity
          onPress={() => navigation.navigate("ForgotPassword")}
          style={{ alignSelf: "flex-end", marginBottom: 20 }}
        >
          <Text style={{ color: tokens.brand.strong, fontWeight: "700", fontSize: 13 }}>
            {t("auth.forgotPassword", "Forgot password?")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSubmit}
          disabled={isLoading}
          style={{
            backgroundColor: isLoading ? tokens.bg.surfaceMuted : tokens.brand.default,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
          }}
          accessibilityRole="button"
        >
          <Text style={{ color: isLoading ? tokens.text.muted : tokens.text.onBrand, fontWeight: "800", fontSize: 16 }}>
            {isLoading ? t("common.loading", "Please wait…") : t("auth.signIn", "Sign in")}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <Text style={{ color: tokens.text.muted }}>{t("auth.noAccount", "New to iPrime? ")}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={{ color: tokens.brand.strong, fontWeight: "800" }}>
              {t("auth.registerCta", "Register your store")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
