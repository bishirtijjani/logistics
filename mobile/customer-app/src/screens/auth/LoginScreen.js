import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { login, clearError } from "../../store/slices/authSlice";
import { useForm, Controller } from "react-hook-form";
import FormInput from "../../components/FormInput";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AsyncStorage from "@react-native-async-storage/async-storage";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const LAST_EMAIL_KEY = "vtu_last_email";

export default function LoginScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);
  const passwordRef = useRef(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Load last used email on mount
  useEffect(() => {
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
  }, [setValue]);

  const onSubmit = async (data) => {
    dispatch(clearError());
    const resultAction = await dispatch(login(data));

    if (login.fulfilled.match(resultAction)) {
      // Remember email on success
      await AsyncStorage.setItem(LAST_EMAIL_KEY, data.email);
      Toast.show({ type: "success", text1: "Welcome back!" });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#FAFAFA" }}
    >
      <View style={{ height: 4, backgroundColor: "#EA580C" }} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 48,
          }}
        >
          <View style={{ marginBottom: 36 }}>
            <Text
              style={{
                fontSize: 38,
                fontWeight: "900",
                color: "#09090b",
                letterSpacing: -1.5,
                marginBottom: 8,
                lineHeight: 44,
              }}
            >
              Welcome{"\n"}back.
            </Text>
            <Text style={{ fontSize: 15, color: "#6B7280" }}>
              Log in to manage your deliveries.
            </Text>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Email address"
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
                label="Password"
                icon="lock-closed-outline"
                placeholder="Enter your password"
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
          >
            <Text style={{ color: "#EA580C", fontSize: 14, fontWeight: "600" }}>
              Forgot password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: isLoading ? "#EA580CB3" : "#EA580C",
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                Sign in
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
            <Text style={{ color: "#6B7280", fontSize: 14 }}>
              Don't have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Register")}>
              <Text
                style={{ color: "#EA580C", fontSize: 14, fontWeight: "700" }}
              >
                Sign up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
