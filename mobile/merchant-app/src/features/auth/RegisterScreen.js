import React, { useState, useEffect } from "react";
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
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import FormInput from "../../components/FormInput";
import AuthBrandMark from "../../components/AuthBrandMark";
import AuthErrorBanner from "../../components/AuthErrorBanner";
import { register } from "../../store/slices/authSlice";
import api from "../../services/api";

const PHONE_RE = /^0[789][01]\d{8}$/;

export default function RegisterScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { isLoading } = useSelector((s) => s.auth);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    categoryId: "",
    businessPhone: "",
    businessEmail: "",
    openingTime: "08:00",
    closingTime: "22:00",
  });
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data || res || []))
      .catch(() => {});
  }, []);

  const validateStep1 = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return "Enter your first and last name.";
    if (!form.email.trim() || !form.email.includes("@")) return "Enter a valid email.";
    if (!PHONE_RE.test(form.phone)) return "Enter a valid Nigerian phone number (e.g. 08012345678).";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    return null;
  };

  const validateStep2 = () => {
    if (!form.businessName.trim()) return "Enter your business name.";
    if (!form.categoryId) return "Select a business category.";
    if (!PHONE_RE.test(form.businessPhone)) return "Enter a valid business phone number.";
    return null;
  };

  const next = () => {
    const err = validateStep1();
    if (err) return setError(err);
    setError("");
    setStep(2);
  };

  const submit = async () => {
    const err = validateStep2();
    if (err) return setError(err);
    setError("");
    const payload = { ...form, email: form.email.trim().toLowerCase() };
    const res = await dispatch(register(payload));
    if (register.fulfilled.match(res)) {
      navigation.replace("OtpVerification", { email: payload.email });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ marginTop: 24 }}>
          <AuthBrandMark />
        </View>
        <Text style={{ fontSize: 24, fontWeight: "800", color: tokens.text.primary, marginBottom: 4 }}>
          {t("auth.registerTitle", "Register your store")}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.text.muted, marginBottom: 8 }}>
          {step === 1 ? t("auth.stepPersonal", "Step 1 of 2 · Your details") : t("auth.stepBusiness", "Step 2 of 2 · Business details")}
        </Text>

        <AuthErrorBanner />
        {error ? <Text style={{ color: tokens.status.error, marginBottom: 12, fontWeight: "600" }}>{error}</Text> : null}

        {step === 1 ? (
          <>
            <FormInput label={t("auth.firstName", "First name")} icon="person-outline" value={form.firstName} onChangeText={set("firstName")} placeholder="First name" />
            <FormInput label={t("auth.lastName", "Last name")} icon="person-outline" value={form.lastName} onChangeText={set("lastName")} placeholder="Last name" />
            <FormInput label={t("auth.email", "Email")} icon="mail-outline" value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
            <FormInput label={t("auth.phone", "Phone")} icon="call-outline" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="08012345678" />
            <FormInput label={t("auth.password", "Password")} icon="lock-closed-outline" value={form.password} onChangeText={set("password")} secureTextEntry placeholder="At least 8 characters" />
            <FormInput label={t("auth.confirmPassword", "Confirm password")} icon="lock-closed-outline" value={form.confirmPassword} onChangeText={set("confirmPassword")} secureTextEntry placeholder="Re-enter password" />

            <TouchableOpacity
              onPress={next}
              style={{ backgroundColor: tokens.brand.default, paddingVertical: 16, borderRadius: 14, alignItems: "center" }}
            >
              <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 16 }}>
                {t("common.continue", "Continue")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <FormInput label={t("auth.businessName", "Business name")} icon="storefront-outline" value={form.businessName} onChangeText={set("businessName")} placeholder="e.g. Aminu Provisions" />
            <FormInput label={t("auth.businessPhone", "Business phone")} icon="call-outline" value={form.businessPhone} onChangeText={set("businessPhone")} keyboardType="phone-pad" placeholder="08012345678" />
            <FormInput label={t("auth.businessEmail", "Business email (optional)")} icon="mail-outline" value={form.businessEmail} onChangeText={set("businessEmail")} keyboardType="email-address" autoCapitalize="none" placeholder="store@example.com" />

            <Text style={{ fontSize: 12, fontWeight: "600", marginBottom: 8, color: tokens.text.muted }}>
              {t("auth.category", "Business category")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 16 }}>
              {categories.map((c) => {
                const selected = form.categoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => set("categoryId")(c.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 999,
                      marginRight: 8,
                      marginBottom: 8,
                      backgroundColor: selected ? tokens.brand.soft : tokens.bg.surface,
                      borderWidth: 1.5,
                      borderColor: selected ? tokens.brand.default : tokens.border.default,
                    }}
                  >
                    <Text style={{ color: selected ? tokens.brand.strong : tokens.text.primary, fontWeight: "700" }}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FormInput label={t("auth.opens", "Opens")} value={form.openingTime} onChangeText={set("openingTime")} placeholder="08:00" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <FormInput label={t("auth.closes", "Closes")} value={form.closingTime} onChangeText={set("closingTime")} placeholder="22:00" />
              </View>
            </View>

            <TouchableOpacity
              onPress={submit}
              disabled={isLoading}
              style={{ backgroundColor: isLoading ? tokens.bg.surfaceMuted : tokens.brand.default, paddingVertical: 16, borderRadius: 14, alignItems: "center" }}
            >
              <Text style={{ color: isLoading ? tokens.text.muted : tokens.text.onBrand, fontWeight: "800", fontSize: 16 }}>
                {isLoading ? t("common.loading", "Please wait…") : t("auth.createStore", "Create store")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(1)} style={{ alignItems: "center", paddingVertical: 14 }}>
              <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>{t("common.back", "Back")}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
