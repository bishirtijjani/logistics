import React, { useEffect, useMemo, useRef } from "react";
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
import FormInput from "../../components/FormInput";
import {
  onboardingPersonalSet,
  onboardingStepSet,
} from "../../store/slices/onboardingSlice";
import { useTheme } from "../../theme";
import { ageFromDob, isValidPastDate } from "../../lib/time";

const MIN_RIDER_AGE = 16;

/**
 * Step 0/3 — Personal info.
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
  const addressRef = useRef(null);

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
          render={({ field: { onChange, onBlur, value } }) => (
            <FormInput
              label={t("onboarding.dobLabel", "Date of birth")}
              icon="calendar-outline"
              placeholder="YYYY-MM-DD"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.dob?.message}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => addressRef.current?.focus()}
            />
          )}
        />

        <Controller
          control={control}
          name="address"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormInput
              ref={addressRef}
              label={t("onboarding.addressLabel", "Home address")}
              icon="location-outline"
              placeholder={t("onboarding.addressPlaceholder", "House, street, area")}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.address?.message}
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
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
