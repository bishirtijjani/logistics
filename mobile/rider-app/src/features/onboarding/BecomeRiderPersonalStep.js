import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import DatePickerField from "../../components/DatePickerField";
import {
  onboardingPersonalSet,
  onboardingStepSet,
} from "../../store/slices/onboardingSlice";
import { useTheme } from "../../theme";
import { ageFromDob, isValidPastDate } from "../../lib/time";

const MIN_RIDER_AGE = 16;

/** Latest birth date that still satisfies the minimum rider age. */
function maxDobString() {
  const now = new Date();
  return `${now.getFullYear() - MIN_RIDER_AGE}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Step 0/3 - Personal info.
 * Collects DOB + address. Name + email come from the registered user account.
 * Backend currently ignores these fields (Rider model has no DOB/address)
 * but we capture them now for forward compatibility.
 */
export default function BecomeRiderPersonalStep({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const user = useSelector((s) => s.auth?.user);
  const draftPersonal = useSelector((s) => s.onboarding?.draft?.personal);

  const schema = useMemo(
    () =>
      z.object({
        dob: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, t("onboarding.dobInvalid", "Use format YYYY-MM-DD"))
          .refine(
            (v) => isValidPastDate(v),
            { message: t("onboarding.dobImpossible", "Pick a real birth date in the past") },
          )
          .refine(
            (v) => {
              const age = ageFromDob(v);
              return age !== null && age >= MIN_RIDER_AGE;
            },
            { message: `You must be at least ${MIN_RIDER_AGE} years old to ride.` },
          ),
        address: z.string().min(6, t("onboarding.addressRequired", "Address is required")),
      }),
    [t],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      dob: draftPersonal?.dob || "",
      address: draftPersonal?.address || "",
    },
  });

  useEffect(() => {
    dispatch(onboardingStepSet(0));
  }, [dispatch]);

  const onSubmit = (data) => {
    dispatch(onboardingPersonalSet(data));
    dispatch(onboardingStepSet(1));
    navigation.navigate("BecomeRiderVehicle");
  };

  const fullName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : "";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
    >
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          {navigation.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
            </TouchableOpacity>
          ) : null}
          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.brand.default, letterSpacing: 1 }}>
              {t("onboarding.stepLabel", "STEP 1 OF 4")}
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 28,
                fontWeight: "900",
                color: tokens.text.primary,
                letterSpacing: -0.5,
                lineHeight: 32,
                marginTop: 4,
              }}
            >
              {t("onboarding.personalTitle", "About you")}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 15, color: tokens.text.muted, marginBottom: 28, lineHeight: 22 }}>
          {t(
            "onboarding.personalSubtitle",
            "We've got your name and email already. A couple more details before we look at your vehicle.",
          )}
        </Text>

        {fullName ? (
          <View
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: tokens.bg.surfaceMuted,
              marginBottom: 20,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="person-outline" size={18} color={tokens.text.muted} />
            <Text style={{ marginLeft: 10, fontSize: 14, color: tokens.text.primary, fontWeight: "600" }}>
              {fullName}
            </Text>
          </View>
        ) : null}

        <Controller
          control={control}
          name="dob"
          render={({ field: { onChange, value } }) => (
            <DatePickerField
              label={t("onboarding.dobLabel", "Date of birth")}
              icon="calendar-outline"
              placeholder={t("onboarding.dobPlaceholder", "Select your date of birth")}
              value={value}
              onChange={onChange}
              error={errors.dob?.message}
              maxDate={maxDobString()}
            />
          )}
        />

        <Controller
          control={control}
          name="address"
          render={({ field: { onChange, value } }) => (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", marginBottom: 6, marginLeft: 2, color: tokens.text.muted }}>
                {t("onboarding.addressLabel", "Home address")}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("LocationPicker", {
                    initial: value ? { address: value } : null,
                    onSelect: (sel) => onChange(sel.address),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t("onboarding.addressLabel", "Home address")}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: tokens.bg.surface,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: errors.address ? tokens.status.error : tokens.border.default,
                }}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={value ? tokens.brand.default : tokens.text.placeholder}
                  style={{ marginRight: 10 }}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: "500",
                    color: value ? tokens.text.primary : tokens.text.placeholder,
                  }}
                >
                  {value || t("onboarding.addressPlaceholder", "Pick your address on the map")}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
              </TouchableOpacity>
              {errors.address ? (
                <Text style={{ fontSize: 12, marginTop: 6, marginLeft: 2, fontWeight: "500", color: tokens.status.error }}>
                  {errors.address.message}
                </Text>
              ) : null}
            </View>
          )}
        />

        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          accessibilityRole="button"
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 16,
            alignItems: "center",
            marginTop: 8,
            backgroundColor: tokens.brand.default,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
            {t("common.continue", "Continue")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
