import React, { useRef } from "react";
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
import { resetPassword } from "../../store/slices/authSlice";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function ResetPasswordScreen({ route, navigation }) {
  const { email, code } = route.params || {};
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);
  const confirmRef = useRef(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async ({ password }) => {
    const result = await dispatch(
      resetPassword({ email, code, newPassword: password }),
    );

    if (resetPassword.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "Password updated!",
        text2: "Please sign in with your new password.",
      });
      // Navigate back to Login and clear the reset stack
      navigation.navigate("Login");
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
              New{"\n"}password.
            </Text>
            <Text style={{ fontSize: 15, color: "#6B7280" }}>
              Choose a strong password for your account.
            </Text>
          </View>

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="New password"
                icon="lock-closed-outline"
                placeholder="At least 8 characters"
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
                label="Confirm password"
                icon="lock-closed-outline"
                placeholder="Repeat your password"
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
                Set new password
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
