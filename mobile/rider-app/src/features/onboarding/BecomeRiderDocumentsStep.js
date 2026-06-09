import React, { useCallback, useEffect, useMemo } from "react";
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
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import FormInput from "../../components/FormInput";
import DatePickerField from "../../components/DatePickerField";
import DocumentUploadTile from "../../components/DocumentUploadTile";
import {
  onboardingDocumentSet,
  onboardingStepSet,
} from "../../store/slices/onboardingSlice";
import { useTheme } from "../../theme";
import { isValidFutureDate, parseISODate } from "../../lib/time";

const NIN_REGEX = /^\d{11}$/;

/**
 * A document expiry is valid only when (a) it parses as a real date and
 * (b) it's today or later. Catches both "2024-13-45" and expired docs.
 */
function isValidExpiry(value) {
  if (!value) return false;
  if (!parseISODate(value)) return false;
  return isValidFutureDate(value);
}

/**
 * Step 3/4 - Documents.
 * Single scrollable screen with 5 doc groups + a NIN entry. Each upload tile
 * persists its `secureUrl` to the onboarding draft as soon as it succeeds, so
 * a kill-and-restart never re-uploads anything.
 */
export default function BecomeRiderDocumentsStep({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const docs = useSelector((s) => s.onboarding?.draft?.documents) || {};

  useEffect(() => {
    dispatch(onboardingStepSet(2));
  }, [dispatch]);

  const setDoc = useCallback(
    (key, value) => dispatch(onboardingDocumentSet({ key, value })),
    [dispatch],
  );

  const issues = useMemo(() => {
    const out = [];
    if (!docs.ninNumber || !NIN_REGEX.test(docs.ninNumber)) {
      out.push("NIN must be 11 digits");
    }
    if (!docs.idDocumentUrl) out.push("Upload your ID document");
    if (!docs.driverLicenseNumber) out.push("Enter your driver's licence number");
    if (!isValidExpiry(docs.driverLicenseExpiresAt)) {
      out.push("Driver's licence expiry must be a real future date");
    }
    if (!docs.driverLicenseUrl) out.push("Upload your driver's licence");
    if (!isValidExpiry(docs.vehicleRegistrationExpiresAt)) {
      out.push("Vehicle registration expiry must be a real future date");
    }
    if (!docs.vehicleRegistrationUrl) out.push("Upload your vehicle registration");
    if (!isValidExpiry(docs.insuranceExpiresAt)) {
      out.push("Insurance expiry must be a real future date");
    }
    if (!docs.insuranceCertificateUrl) out.push("Upload your insurance certificate");
    if (!docs.vehiclePhotoUrl) out.push("Upload a photo of your vehicle");
    return out;
  }, [docs]);

  const onContinue = () => {
    if (issues.length > 0) {
      Toast.show({
        type: "error",
        text1: t("onboarding.docsIncompleteToast", "Some items are missing"),
        text2: issues[0],
      });
      return;
    }
    dispatch(onboardingStepSet(3));
    navigation.navigate("BecomeRiderReview");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
    >
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 32 }}
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
              {t("onboarding.stepLabel3", "STEP 3 OF 4")}
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
              {t("onboarding.documentsTitle", "Your documents")}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 14, color: tokens.text.muted, marginBottom: 24, lineHeight: 20 }}>
          {t(
            "onboarding.documentsSubtitle",
            "Clear, well-lit photos of each document. We need all of these to approve your account.",
          )}
        </Text>

        {/* ── 1. Identity ───────────────────────────────────────────── */}
        <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 8, letterSpacing: 0.5 }}>
          1. IDENTITY
        </Text>
        <FormInput
          label={t("onboarding.ninLabel", "NIN (11 digits)")}
          icon="card-outline"
          placeholder="12345678901"
          value={docs.ninNumber || ""}
          onChangeText={(text) =>
            setDoc("ninNumber", text.replace(/\D/g, "").slice(0, 11) || null)
          }
          keyboardType="number-pad"
          autoCapitalize="none"
        />
        <DocumentUploadTile
          title="NIN slip / national ID"
          description="Front of your NIN slip or national ID card."
          kind="rider_id"
          secureUrl={docs.idDocumentUrl}
          onUploaded={(url) => setDoc("idDocumentUrl", url)}
          onCleared={() => setDoc("idDocumentUrl", null)}
          required
        />

        {/* ── 2. Driver's licence ──────────────────────────────────── */}
        <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 8, marginTop: 12, letterSpacing: 0.5 }}>
          2. DRIVER'S LICENCE
        </Text>
        <FormInput
          label="Licence number"
          icon="document-text-outline"
          placeholder="AAA-12345-AB"
          value={docs.driverLicenseNumber || ""}
          onChangeText={(text) => setDoc("driverLicenseNumber", text || null)}
          autoCapitalize="characters"
        />
        <DatePickerField
          label="Expiry date"
          icon="calendar-outline"
          placeholder={t("onboarding.expiryPlaceholder", "Select expiry date")}
          value={docs.driverLicenseExpiresAt || ""}
          onChange={(v) => setDoc("driverLicenseExpiresAt", v || null)}
          minDate={new Date()}
        />
        <DocumentUploadTile
          title="Licence photo"
          description="Front of your FRSC card or e-licence printout."
          kind="rider_driver_license"
          secureUrl={docs.driverLicenseUrl}
          onUploaded={(url) => setDoc("driverLicenseUrl", url)}
          onCleared={() => setDoc("driverLicenseUrl", null)}
          required
        />

        {/* ── 3. Vehicle particulars ──────────────────────────────── */}
        <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 8, marginTop: 12, letterSpacing: 0.5 }}>
          3. VEHICLE PARTICULARS
        </Text>
        <DatePickerField
          label="Expiry date"
          icon="calendar-outline"
          placeholder={t("onboarding.expiryPlaceholder", "Select expiry date")}
          value={docs.vehicleRegistrationExpiresAt || ""}
          onChange={(v) => setDoc("vehicleRegistrationExpiresAt", v || null)}
          minDate={new Date()}
        />
        <DocumentUploadTile
          title="Vehicle registration / particulars"
          description="Proof-of-ownership or vehicle-licence document."
          kind="rider_vehicle_registration"
          secureUrl={docs.vehicleRegistrationUrl}
          onUploaded={(url) => setDoc("vehicleRegistrationUrl", url)}
          onCleared={() => setDoc("vehicleRegistrationUrl", null)}
          required
        />

        {/* ── 4. Insurance ────────────────────────────────────────── */}
        <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 8, marginTop: 12, letterSpacing: 0.5 }}>
          4. INSURANCE
        </Text>
        <DatePickerField
          label="Expiry date"
          icon="calendar-outline"
          placeholder={t("onboarding.expiryPlaceholder", "Select expiry date")}
          value={docs.insuranceExpiresAt || ""}
          onChange={(v) => setDoc("insuranceExpiresAt", v || null)}
          minDate={new Date()}
        />
        <DocumentUploadTile
          title="Third-party insurance certificate"
          description="Valid third-party motor insurance certificate."
          kind="rider_insurance"
          secureUrl={docs.insuranceCertificateUrl}
          onUploaded={(url) => setDoc("insuranceCertificateUrl", url)}
          onCleared={() => setDoc("insuranceCertificateUrl", null)}
          required
        />

        {/* ── 5. Vehicle photo ────────────────────────────────────── */}
        <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 8, marginTop: 12, letterSpacing: 0.5 }}>
          5. VEHICLE PHOTO
        </Text>
        <DocumentUploadTile
          title="Photo of your vehicle"
          description="Clear shot showing the plate."
          kind="rider_vehicle_photo"
          secureUrl={docs.vehiclePhotoUrl}
          onUploaded={(url) => setDoc("vehiclePhotoUrl", url)}
          onCleared={() => setDoc("vehiclePhotoUrl", null)}
          required
        />

        {/* ── Progress summary ────────────────────────────────────── */}
        {issues.length > 0 ? (
          <View
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: tokens.status.warningSoft,
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.status.warningStrong, marginBottom: 4 }}>
              {issues.length} remaining
            </Text>
            <Text style={{ fontSize: 13, color: tokens.text.primary}}>{issues[0]}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={onContinue}
          accessibilityRole="button"
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 16,
            alignItems: "center",
            marginTop: 16,
            backgroundColor: issues.length > 0 ? "#EA580CB3" : tokens.brand.default,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
            {issues.length > 0 ? `${issues.length} left` : t("common.continue", "Continue")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
