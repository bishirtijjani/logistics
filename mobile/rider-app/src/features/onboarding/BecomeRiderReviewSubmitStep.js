import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme";
import {
  onboardingStepSet,
  submitRiderApplication,
} from "../../store/slices/onboardingSlice";
import { fetchRiderProfile } from "../../store/slices/riderSlice";

function Row({ label, value, tokens, mono }) {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border.subtle,
      }}
    >
      <Text style={{ flex: 1, fontSize: 13, color: tokens.text.muted }}>{label}</Text>
      <Text
        style={{
          flex: 1.4,
          fontSize: 14,
          color: tokens.text.primary,
          textAlign: "right",
          fontFamily: mono ? "Courier" : undefined,
          fontWeight: "600",
        }}
        numberOfLines={1}
      >
        {value || "-"}
      </Text>
    </View>
  );
}

function DocPreview({ label, url, tokens }) {
  if (!url) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
      <Image
        source={{ uri: url }}
        style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: tokens.bg.surfaceMuted }}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary }}>{label}</Text>
        <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }} numberOfLines={1}>
          Uploaded
        </Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color={tokens.status.success} />
    </View>
  );
}

/**
 * Final onboarding step. Read-only summary + Submit CTA.
 * On success, resets the stack to MainTabs (there's no onboarding wall anymore);
 * the Home OnboardingHero then shows the PENDING ("under review") state.
 */
export default function BecomeRiderReviewSubmitStep() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const user = useSelector((s) => s.auth?.user);
  const draft = useSelector((s) => s.onboarding?.draft) || {};
  const status = useSelector((s) => s.onboarding?.status);
  const error = useSelector((s) => s.onboarding?.error);

  useEffect(() => {
    dispatch(onboardingStepSet(3));
  }, [dispatch]);

  const personal = draft.personal || {};
  const vehicle = draft.vehicle || {};
  const docs = draft.documents || {};

  const onSubmit = async () => {
    const result = await dispatch(submitRiderApplication());
    if (submitRiderApplication.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: t("onboarding.submittedToast", "Application submitted"),
        text2: t("onboarding.submittedToastSub", "We'll review it shortly."),
      });
      // Refresh rider profile so the rider status reflects PENDING_APPROVAL.
      await dispatch(fetchRiderProfile());
      // There's no onboarding wall to catch us anymore - return to Home, where
      // the OnboardingHero now shows the "under review" (PENDING) state.
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    } else {
      Toast.show({
        type: "error",
        text1: t("errors.title", "Something went wrong"),
        text2: result.payload || t("errors.UNKNOWN_ERROR", "Try again"),
      });
    }
  };

  const fullName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : "-";

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          {navigation.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
            </TouchableOpacity>
          ) : null}
          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.brand.default, letterSpacing: 1 }}>
              STEP 4 OF 4
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
              {t("onboarding.reviewTitle", "Review & submit")}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 14, color: tokens.text.muted, marginBottom: 24, lineHeight: 20 }}>
          {t(
            "onboarding.reviewSubtitle",
            "Confirm everything below before submitting. You can go back to fix anything.",
          )}
        </Text>

        <View
          style={{
            borderRadius: 14,
            backgroundColor: tokens.bg.surface,
            borderWidth: 1,
            borderColor: tokens.border.default,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.text.muted, letterSpacing: 1, marginBottom: 8 }}>
            PERSONAL
          </Text>
          <Row label="Name" value={fullName} tokens={tokens} />
          <Row label="Email" value={user?.email} tokens={tokens} />
          <Row label="Date of birth" value={personal.dob} tokens={tokens} />
          <Row label="Address" value={personal.address} tokens={tokens} />
        </View>

        <View
          style={{
            borderRadius: 14,
            backgroundColor: tokens.bg.surface,
            borderWidth: 1,
            borderColor: tokens.border.default,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.text.muted, letterSpacing: 1, marginBottom: 8 }}>
            VEHICLE
          </Text>
          <Row label="Type" value={vehicle.vehicleType} tokens={tokens} />
          <Row label="Plate" value={vehicle.plateNumber} tokens={tokens} mono />
          <Row label="Colour" value={vehicle.vehicleColor} tokens={tokens} />
        </View>

        <View
          style={{
            borderRadius: 14,
            backgroundColor: tokens.bg.surface,
            borderWidth: 1,
            borderColor: tokens.border.default,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.text.muted, letterSpacing: 1, marginBottom: 8 }}>
            DOCUMENTS
          </Text>
          <Row label="NIN" value={docs.ninNumber} tokens={tokens} mono />
          <DocPreview label="NIN slip / national ID" url={docs.idDocumentUrl} tokens={tokens} />
          <Row label="Licence number" value={docs.driverLicenseNumber} tokens={tokens} mono />
          <Row label="Licence expiry" value={docs.driverLicenseExpiresAt} tokens={tokens} />
          <DocPreview label="Driver's licence" url={docs.driverLicenseUrl} tokens={tokens} />
          <Row label="Vehicle reg. expiry" value={docs.vehicleRegistrationExpiresAt} tokens={tokens} />
          <DocPreview label="Vehicle registration" url={docs.vehicleRegistrationUrl} tokens={tokens} />
          <Row label="Insurance expiry" value={docs.insuranceExpiresAt} tokens={tokens} />
          <DocPreview label="Insurance certificate" url={docs.insuranceCertificateUrl} tokens={tokens} />
          <DocPreview label="Vehicle photo" url={docs.vehiclePhotoUrl} tokens={tokens} />
        </View>

        {error ? (
          <View
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: tokens.status.errorSoft,
              borderWidth: 1,
              borderColor: tokens.status.errorSoftBorder,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 13, color: tokens.status.errorStrong, fontWeight: "600" }}>
              {error}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={onSubmit}
          disabled={status === "submitting"}
          accessibilityRole="button"
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 16,
            alignItems: "center",
            backgroundColor: status === "submitting" ? "#EA580CB3" : tokens.brand.default,
          }}
        >
          {status === "submitting" ? (
            <ActivityIndicator color={tokens.text.onBrand} />
          ) : (
            <Text style={{ color: tokens.text.onBrand, fontSize: 15, fontWeight: "800" }}>
              {t("onboarding.submitCta", "Submit application")}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
