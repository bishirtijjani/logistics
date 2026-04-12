import React from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormInput from "../../components/FormInput";
import { requestPasswordReset } from "../../store/slices/authSlice";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default function ForgotPasswordScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }) => {
    const result = await dispatch(requestPasswordReset(email));
    if (requestPasswordReset.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "Check your email",
        text2: "A reset code has been sent if an account exists.",
      });
      navigation.navigate("OtpVerification", { email, mode: "reset" });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#FAFAFA" }}
    >
      <View style={{ height: 4, backgroundColor: "#EA580C" }} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginBottom: 32 }}
          >
            <Ionicons name="arrow-back" size={24} color="#09090b" />
          </TouchableOpacity>

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
              Forgot{"\n"}password?
            </Text>
            <Text style={{ fontSize: 15, color: "#6B7280" }}>
              Enter your email and we'll send you a reset code.
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
                Send reset code
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
              Remember your password?{" "}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text
                style={{ color: "#EA580C", fontSize: 14, fontWeight: "700" }}
              >
                Sign in
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
