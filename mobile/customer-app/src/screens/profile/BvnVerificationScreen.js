import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Toast from "react-native-toast-message";
import FormInput from "../../components/FormInput";
import { verifyBvn } from "../../store/slices/profileSlice";
import { colors } from "../../theme";

const schema = z.object({
  bvn: z
    .string()
    .length(11, "BVN must be exactly 11 digits")
    .regex(/^\d{11}$/, "BVN must contain only digits"),
  firstName: z.string().min(2, "Enter your first name as on BVN"),
  lastName: z.string().min(2, "Enter your last name as on BVN"),
});

export default function BvnVerificationScreen({ navigation }) {
  const dispatch = useDispatch();
  const { profile, isUpdating } = useSelector((state) => state.profile);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      bvn: "",
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
    },
  });

  const onSubmit = async (data) => {
    const result = await dispatch(verifyBvn(data));
    if (verifyBvn.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "BVN Verified",
        text2: "Your identity has been confirmed.",
      });
      navigation.goBack();
    }
  };

  if (profile?.kycStatus === "VERIFIED") {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={["top"]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <View style={{ height: 4, backgroundColor: colors.primary }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "900",
              color: colors.text,
              letterSpacing: -0.5,
            }}
          >
            Identity Verification
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 40,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#D1FAE5",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Ionicons name="checkmark-circle" size={44} color="#059669" />
          </View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "900",
              color: colors.text,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Already Verified
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textMuted,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Your BVN has been verified. You have full access to all features.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          Identity Verification
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Banner */}
          <View
            style={{
              backgroundColor: "#EFF6FF",
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: "#BFDBFE",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Ionicons
                name="shield-checkmark"
                size={22}
                color="#2563EB"
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: colors.text,
                }}
              >
                Why we need your BVN
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                lineHeight: 20,
              }}
            >
              {"\u2022"} Confirms your identity to prevent fraud{"\n"}
              {"\u2022"} Required by CBN regulations for financial services
              {"\n"}
              {"\u2022"} We never store your BVN in plain text{"\n"}
              {"\u2022"} Your data is encrypted and secure
            </Text>
          </View>

          {/* Form */}
          <Controller
            control={control}
            name="bvn"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Bank Verification Number (BVN)"
                icon="finger-print-outline"
                placeholder="Enter 11-digit BVN"
                error={errors.bvn?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                keyboardType="number-pad"
                maxLength={11}
                editable={!isUpdating}
              />
            )}
          />

          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="First name (as on BVN)"
                icon="person-outline"
                placeholder="First name"
                error={errors.firstName?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                editable={!isUpdating}
              />
            )}
          />

          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Last name (as on BVN)"
                icon="person-outline"
                placeholder="Last name"
                error={errors.lastName?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                editable={!isUpdating}
              />
            )}
          />

          {/* Disclaimer */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              marginTop: 8,
              marginBottom: 20,
              paddingHorizontal: 4,
            }}
          >
            <Ionicons
              name="lock-closed"
              size={14}
              color={colors.textLight}
              style={{ marginRight: 6, marginTop: 2 }}
            />
            <Text
              style={{
                fontSize: 12,
                color: colors.textLight,
                flex: 1,
                lineHeight: 18,
              }}
            >
              Your BVN is securely hashed and never stored in plain text. We
              only use it to verify your identity.
            </Text>
          </View>

          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: isUpdating ? "#EA580CB3" : colors.primary,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            {isUpdating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                Verify BVN
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
