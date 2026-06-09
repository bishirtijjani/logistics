import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Toast from "react-native-toast-message";
import FormInput from "../../components/FormInput";
import { updateProfile, fetchProfile } from "../../store/slices/profileSlice";
import { useTheme } from "../../theme";

const schema = z.object({
  firstName: z.string().min(2, "At least 2 characters").max(50),
  lastName: z.string().min(2, "At least 2 characters").max(50),
  phone: z
    .string()
    .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number")
    .or(z.literal(""))
    .optional(),
  address: z.string().max(255).optional(),
  dateOfBirth: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Use format YYYY-MM-DD")
    .optional(),
});

export default function EditProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  const { profile, isUpdating } = useSelector((state) => state.profile);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      phone: profile?.phone || "",
      address: profile?.address || "",
      dateOfBirth: profile?.dateOfBirth
        ? new Date(profile.dateOfBirth).toISOString().split("T")[0]
        : "",
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        phone: profile.phone || "",
        address: profile.address || "",
        dateOfBirth: profile.dateOfBirth
          ? new Date(profile.dateOfBirth).toISOString().split("T")[0]
          : "",
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data) => {
    // Remove empty strings
    const payload = {};
    if (data.firstName) payload.firstName = data.firstName;
    if (data.lastName) payload.lastName = data.lastName;
    if (data.phone) payload.phone = data.phone;
    if (data.address) payload.address = data.address;
    if (data.dateOfBirth) payload.dateOfBirth = data.dateOfBirth;

    const result = await dispatch(updateProfile(payload));
    if (updateProfile.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: t("edit.saved"),
      });
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={tokens.bg.canvas}
      />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

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
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: tokens.text.primary,
            letterSpacing: -0.5,
            flex: 1,
          }}
        >
          {t("edit.title")}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {/* Email (read-only) */}
          <View style={{ marginBottom: 6 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: tokens.text.muted,
                marginBottom: 6,
              }}
            >
              Email address
            </Text>
            <View
              style={{
                backgroundColor: tokens.bg.surfaceMuted,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={tokens.text.placeholder}
                style={{ marginRight: 10 }}
              />
              <Text
                style={{
                  fontSize: 15,
                  color: tokens.text.muted,
                  flex: 1,
                }}
              >
                {profile?.email || "-"}
              </Text>
              <Ionicons name="lock-closed" size={14} color={tokens.text.placeholder} />
            </View>
            <Text
              style={{
                fontSize: 11,
                color: tokens.text.muted,
                marginTop: 4,
                marginLeft: 4,
              }}
            >
              Email cannot be changed
            </Text>
          </View>

          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="First name"
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
                label="Last name"
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

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Phone number"
                icon="call-outline"
                placeholder="08012345678"
                error={errors.phone?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                keyboardType="phone-pad"
                editable={!isUpdating}
              />
            )}
          />

          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Date of birth"
                icon="calendar-outline"
                placeholder="YYYY-MM-DD"
                error={errors.dateOfBirth?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                editable={!isUpdating}
              />
            )}
          />

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Address"
                icon="location-outline"
                placeholder="Enter your address"
                error={errors.address?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                editable={!isUpdating}
              />
            )}
          />

          <TouchableOpacity
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              alignItems: "center",
              marginTop: 16,
              backgroundColor:
                !isDirty || isUpdating
                  ? tokens.text.placeholder
                  : tokens.brand.default,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={!isDirty || isUpdating}
            activeOpacity={0.8}
          >
            {isUpdating ? (
              <ActivityIndicator color={tokens.text.onBrand} />
            ) : (
              <Text
                style={{
                  color: tokens.text.onBrand,
                  fontSize: 15,
                  fontWeight: "800",
                }}
              >
                Save Changes
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
