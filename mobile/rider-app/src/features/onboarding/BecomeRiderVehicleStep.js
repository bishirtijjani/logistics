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
  onboardingVehicleSet,
  onboardingStepSet,
} from "../../store/slices/onboardingSlice";
import { useTheme } from "../../theme";
import { VEHICLE_TYPES } from "../../lib/constants";

const VEHICLE_OPTIONS = [
  { key: VEHICLE_TYPES.MOTORCYCLE, label: "Motorcycle", icon: "bicycle" },
  { key: VEHICLE_TYPES.BICYCLE,    label: "Bicycle",    icon: "bicycle-outline" },
  { key: VEHICLE_TYPES.CAR,        label: "Car",        icon: "car-outline" },
  { key: VEHICLE_TYPES.VAN,        label: "Van",        icon: "car-sport-outline" },
];

/**
 * Step 2/4 - Vehicle info.
 * Captures vehicleType, plateNumber (Nigerian plate format), vehicleColor.
 */
export default function BecomeRiderVehicleStep({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const draftVehicle = useSelector((s) => s.onboarding?.draft?.vehicle);
  const colorRef = useRef(null);

  const schema = useMemo(
    () =>
      z.object({
        vehicleType: z.enum(
          [VEHICLE_TYPES.MOTORCYCLE, VEHICLE_TYPES.BICYCLE, VEHICLE_TYPES.CAR, VEHICLE_TYPES.VAN],
          { message: t("onboarding.vehicleTypeRequired", "Pick a vehicle type") },
        ),
        plateNumber: z
          .string()
          .min(5, t("onboarding.plateRequired", "Plate number is required"))
          .regex(/^[A-Z0-9-\s]+$/i, t("onboarding.plateInvalid", "Letters and digits only")),
        vehicleColor: z.string().optional(),
      }),
    [t],
  );

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleType: draftVehicle?.vehicleType || VEHICLE_TYPES.MOTORCYCLE,
      plateNumber: draftVehicle?.plateNumber || "",
      vehicleColor: draftVehicle?.vehicleColor || "",
    },
  });

  const currentType = watch("vehicleType");

  useEffect(() => {
    dispatch(onboardingStepSet(1));
  }, [dispatch]);

  const onSubmit = (data) => {
    dispatch(
      onboardingVehicleSet({
        ...data,
        plateNumber: data.plateNumber.toUpperCase().trim(),
      }),
    );
    dispatch(onboardingStepSet(2));
    navigation.navigate("BecomeRiderDocuments");
  };

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
              {t("onboarding.stepLabel2", "STEP 2 OF 4")}
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
              {t("onboarding.vehicleTitle", "Your vehicle")}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary, marginBottom: 12 }}>
          {t("onboarding.vehicleTypeLabel", "Type")}
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {VEHICLE_OPTIONS.map((opt) => {
            const selected = currentType === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setValue("vehicleType", opt.key, { shouldValidate: true })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: selected ? tokens.brand.default : tokens.border.default,
                  backgroundColor: selected ? tokens.brand.soft : tokens.bg.surface,
                }}
              >
                <Ionicons name={opt.icon} size={18} color={selected ? tokens.brand.default : tokens.text.muted} />
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 14,
                    fontWeight: "700",
                    color: selected ? tokens.brand.default : tokens.text.primary,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {errors.vehicleType ? (
          <Text style={{ color: tokens.status.errorStrong, fontSize: 13, marginTop: -16, marginBottom: 16 }}>
            {errors.vehicleType.message}
          </Text>
        ) : null}

        <Controller
          control={control}
          name="plateNumber"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormInput
              label={t("onboarding.plateLabel", "Plate number")}
              icon="pricetag-outline"
              placeholder="ABC123XY"
              onBlur={onBlur}
              onChangeText={(t) => onChange(t.toUpperCase())}
              value={value}
              error={errors.plateNumber?.message}
              autoCapitalize="characters"
              returnKeyType="next"
              onSubmitEditing={() => colorRef.current?.focus()}
            />
          )}
        />

        <Controller
          control={control}
          name="vehicleColor"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormInput
              ref={colorRef}
              label={t("onboarding.colorLabel", "Colour (optional)")}
              icon="color-palette-outline"
              placeholder={t("onboarding.colorPlaceholder", "e.g. Red")}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.vehicleColor?.message}
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
