import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import {
  register,
  loginWithGoogle,
  clearError,
} from "../../store/slices/authSlice";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import FormInput from "../../components/FormInput";
import SocialAuthButton from "../../components/SocialAuthButton";

WebBrowser.maybeCompleteAuthSession();

const registerSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function RegisterScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);

  // Focus Refs for Keyboard Navigation
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
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
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  React.useEffect(() => {
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
    const resultAction = await dispatch(
      register({
        ...data,
        role: "CUSTOMER",
      }),
    );

    if (register.fulfilled.match(resultAction)) {
      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Check your email for the OTP!",
      });
      navigation.navigate("OtpVerification", { email: data.email });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={{ height: 4, backgroundColor: "#EA580C" }} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={{ flex: 1, backgroundColor: "#FAFAFA" }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 52 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: 32 }}>
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
              Create{"\n"}account.
            </Text>
            <Text style={{ fontSize: 15, color: "#6B7280" }}>
              Join thousands of users moving fast.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="First name"
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
                    label="Last name"
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
                label="Email address"
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
                label="Password"
                icon="lock-closed-outline"
                placeholder="Create a strong password"
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
                Create account
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
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#6B7280", fontSize: 14 }}>
              Already have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text
                style={{ color: "#EA580C", fontSize: 14, fontWeight: "700" }}
              >
                Sign in
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
