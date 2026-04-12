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
import {
  login,
  loginWithGoogle,
  clearError,
} from "../../store/slices/authSlice";
import { useForm, Controller } from "react-hook-form";
import FormInput from "../../components/FormInput";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import SocialAuthButton from "../../components/SocialAuthButton";

WebBrowser.maybeCompleteAuthSession();

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const LAST_EMAIL_KEY = "vtu_last_email";

export default function LoginScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);
  const passwordRef = useRef(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId:
      "1001895940462-lbs6fcgm1cn4fj2hhrjotltcjq6mebai.apps.googleusercontent.com",
    iosClientId:
      "1001895940462-7urrks74vpq96kjgarrf5dj92odjr67a.apps.googleusercontent.com",
    androidClientId:
      "1001895940462-h88c8hi8r4guiu05j4dqki52poufuspk.apps.googleusercontent.com",
  });

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

  useEffect(() => {
    if (response?.type === "success") {
      const { idToken } = response.authentication;
      if (idToken) {
        dispatch(loginWithGoogle(idToken))
          .unwrap()
          .then(() => {
            Toast.show({ type: "success", text1: "Google Auth Successful!" });
          })
          .catch((err) => {
            Toast.show({ type: "error", text1: "Auth Failed", text2: err });
          });
      }
    }
  }, [response, dispatch]);

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
              alignItems: "center",
              marginTop: 20,
              marginBottom: 4,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
            <Text
              style={{ marginHorizontal: 14, color: "#6B7280", fontSize: 13 }}
            >
              or continue with
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
          </View>

          <SocialAuthButton
            text="Google"
            iconName="logo-google"
            onPress={() => promptAsync()}
            isLoading={!request}
          />

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
