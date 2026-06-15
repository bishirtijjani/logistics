/**
 * KycStatusScreen - five document tiles + re-upload flow.
 *
 * Each tile renders the current state (Valid / Expiring soon / Expired /
 * Missing) and offers a "Re-upload" CTA. The picker → Cloudinary upload →
 * `POST /rider/documents` chain lives in `reuploadRiderDocument`
 * (profileSlice). NIN is verified at onboarding and has no expiry.
 *
 * The 30-day grace banner for accounts migrated under BLK-RiderKycExpansion
 * is surfaced here whenever any tracked doc enters the warning window.
 */

import React, { useMemo, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { chooseImageSource } from "../../lib/chooseImageSource";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { uploadToCloudinary } from "../../services/cloudinary";
import { pickImage } from "../support/supportUploads";
import { reuploadRiderDocument } from "../../store/slices/profileSlice";
import { fetchRiderProfile } from "../../store/slices/riderSlice";
import DatePickerField from "../../components/DatePickerField";
import { useOnboardingStage, ONBOARDING_STAGE } from "../../lib/useOnboardingStage";

const WARN_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Static description of every doc tile. `urlField` / `expiryField` point at
 * Rider columns. `requireExpiry` controls whether the upload sheet forces
 * the rider to enter a date. NIN slips and vehicle photos are exempt.
 */
const DOC_TILES = [
  {
    kind: "ID_DOC",
    icon: "person-outline",
    title: "National ID / NIN slip",
    urlField: "idDocumentUrl",
    expiryField: "idDocExpiresAt",
    requireExpiry: false, // NIN slips don't expire; national-ID cards optionally do.
  },
  {
    kind: "DRIVER_LICENCE",
    icon: "card-outline",
    title: "Driver's licence",
    urlField: "driverLicenceUrl",
    expiryField: "driverLicenceExpiresAt",
    requireExpiry: true,
  },
  {
    kind: "VEHICLE_REG",
    icon: "document-outline",
    title: "Vehicle registration",
    urlField: "vehicleRegUrl",
    expiryField: "vehicleRegExpiresAt",
    requireExpiry: true,
  },
  {
    kind: "INSURANCE",
    icon: "shield-checkmark-outline",
    title: "Insurance certificate",
    urlField: "insuranceDocUrl",
    expiryField: "insuranceExpiresAt",
    requireExpiry: true,
  },
  {
    kind: "VEHICLE_PHOTO",
    icon: "image-outline",
    title: "Vehicle photo",
    urlField: "vehiclePhotoUrl",
    expiryField: null,
    requireExpiry: false,
  },
];

/**
 * Classify a tile from its URL and (optional) expiry. Returns one of
 * "missing" | "valid" | "expiring" | "expired".
 *
 * Three regimes:
 *  1. No expiry tracked (VEHICLE_PHOTO):       valid if URL present, missing otherwise.
 *  2. Expiry tracked but optional (ID_DOC):    valid if URL present and (no expiry OR expiry in future);
 *                                              expiring/expired follow normal date logic when expiry set.
 *  3. Expiry tracked + required:               same as (2) but missing if URL or expiry absent.
 */
function classifyTile(tile, rider) {
  const url = rider[tile.urlField];
  if (!url) return "missing";
  if (!tile.expiryField) return "valid";

  const expiry = rider[tile.expiryField];
  if (!expiry) {
    return tile.requireExpiry ? "missing" : "valid";
  }
  const ts = new Date(expiry).getTime();
  if (Number.isNaN(ts)) return tile.requireExpiry ? "missing" : "valid";
  const delta = ts - Date.now();
  if (delta < 0) return "expired";
  if (delta <= WARN_WINDOW_DAYS * DAY_MS) return "expiring";
  return "valid";
}

function chipColor(state, tokens) {
  switch (state) {
    case "valid": return { bg: tokens.status.successSoft, text: tokens.status.successStrong, label: "Valid" };
    case "expiring": return { bg: tokens.status.warningSoft, text: tokens.status.warningStrong, label: "Expiring soon" };
    case "expired": return { bg: tokens.status.errorSoft, text: tokens.status.errorStrong, label: "Expired" };
    case "missing":
    default:
      return { bg: tokens.bg.surfaceMuted, text: tokens.text.muted, label: "Missing" };
  }
}

export default function KycStatusScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const rider = useSelector((s) => s.rider?.rider) || {};
  const { stage, resumeScreen } = useOnboardingStage();

  const [activeTile, setActiveTile] = useState(null); // the tile being re-uploaded
  const [submitting, setSubmitting] = useState(false);
  const [expiryInput, setExpiryInput] = useState("");
  const [pickedUri, setPickedUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const tiles = useMemo(
    () =>
      DOC_TILES.map((d) => ({
        ...d,
        url: rider[d.urlField] || null,
        expiry: d.expiryField ? rider[d.expiryField] || null : null,
        state: classifyTile(d, rider),
      })),
    [rider],
  );

  // No rider record yet (NONE / DRAFT - reachable via the /kyc deep link). Don't
  // show uploadable tiles that would POST documents against a non-existent rider;
  // point them at the application instead.
  if (!rider.status) {
    const start = () =>
      navigation.navigate(stage === ONBOARDING_STAGE.DRAFT ? resumeScreen : "BecomeRiderPersonal");
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row", alignItems: "center",
            paddingHorizontal: 14, paddingVertical: 12,
            backgroundColor: tokens.bg.surface,
            borderBottomWidth: 1, borderBottomColor: tokens.border.default,
          }}
        >
          <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
            {t("kyc.title", "KYC documents")}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28 }}>
          <View
            style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: tokens.brand.soft,
              alignItems: "center", justifyContent: "center", marginBottom: 18,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={32} color={tokens.brand.default} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginBottom: 8, textAlign: "center" }}>
            {t("kyc.noApplicationTitle", "Start your rider application")}
          </Text>
          <Text style={{ fontSize: 14, color: tokens.text.muted, textAlign: "center", lineHeight: 20, marginBottom: 22 }}>
            {t("kyc.noApplicationBody", "Apply to become a rider first. You'll add your documents as part of the application.")}
          </Text>
          <TouchableOpacity
            onPress={start}
            accessibilityRole="button"
            style={{ paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14, backgroundColor: tokens.brand.default }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
              {stage === ONBOARDING_STAGE.DRAFT
                ? t("kyc.continueApplication", "Continue application")
                : t("kyc.startApplication", "Become a rider")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const anyExpiring = tiles.some((d) => d.state === "expiring");
  const anyExpired = tiles.some((d) => d.state === "expired");

  const openSheet = (tile) => {
    setActiveTile(tile);
    setExpiryInput(tile.expiry ? new Date(tile.expiry).toISOString().slice(0, 10) : "");
    setPickedUri(null);
  };

  const closeSheet = () => {
    if (submitting || uploading) return;
    setActiveTile(null);
    setExpiryInput("");
    setPickedUri(null);
  };

  const handlePick = (source) => async () => {
    const uri = await pickImage(source);
    if (uri) setPickedUri(uri);
  };

  const handleSubmit = async () => {
    if (!activeTile || !pickedUri) {
      Toast.show({ type: "error", text1: t("kyc.pickPhotoFirst", "Pick a photo to upload first.") });
      return;
    }
    // Validate expiry: required for tiles like driver's licence, optional
    // for ID slips. If provided, must be a valid future date.
    const expiryTrimmed = (expiryInput || "").trim();
    if (activeTile.requireExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiryTrimmed)) {
      Toast.show({ type: "error", text1: t("kyc.expiryRequired", "Enter the expiry in YYYY-MM-DD.") });
      return;
    }
    if (expiryTrimmed) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryTrimmed)) {
        Toast.show({ type: "error", text1: t("kyc.expiryFormat", "Use date format YYYY-MM-DD.") });
        return;
      }
      const ts = new Date(expiryTrimmed).getTime();
      if (Number.isNaN(ts) || ts <= Date.now()) {
        Toast.show({ type: "error", text1: t("kyc.expiryFuture", "Expiry must be a future date.") });
        return;
      }
    }
    setSubmitting(true);
    setUploading(true);
    try {
      const { secureUrl } = await uploadToCloudinary({
        kind: "rider_doc",
        localUri: pickedUri,
      });
      setUploading(false);
      await dispatch(
        reuploadRiderDocument({
          kind: activeTile.kind,
          url: secureUrl,
          expiresAt: expiryTrimmed ? new Date(expiryTrimmed).toISOString() : undefined,
        }),
      ).unwrap();
      Toast.show({ type: "success", text1: t("kyc.uploaded", "Document updated") });
      await dispatch(fetchRiderProfile());
      closeSheet();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("kyc.uploadFailed", "Upload failed"),
        text2: err?.message,
      });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("kyc.title", "KYC documents")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {anyExpired ? (
          <View
            style={{
              backgroundColor: tokens.status.errorSoft,
              borderColor: tokens.status.errorSoftBorder, borderWidth: 1,
              borderRadius: 12, padding: 12, marginBottom: 14,
              flexDirection: "row", alignItems: "flex-start",
            }}
          >
            <Ionicons name="alert-circle" size={18} color={tokens.status.errorStrong} />
            <Text style={{ flex: 1, marginLeft: 8, fontSize: 12, color: tokens.text.primary, lineHeight: 18 }}>
              {t("kyc.expiredBanner", "One or more documents have expired. Re-upload to keep working.")}
            </Text>
          </View>
        ) : anyExpiring ? (
          <View
            style={{
              backgroundColor: tokens.status.warningSoft,
              borderRadius: 12, padding: 12, marginBottom: 14,
              flexDirection: "row", alignItems: "flex-start",
            }}
          >
            <Ionicons name="time-outline" size={18} color={tokens.status.warningStrong} />
            <Text style={{ flex: 1, marginLeft: 8, fontSize: 12, color: tokens.text.primary, lineHeight: 18 }}>
              {t("kyc.expiringBanner", "Some documents expire within 14 days. Re-upload soon to avoid interruptions.")}
            </Text>
          </View>
        ) : null}

        {tiles.map((tile) => {
          const chip = chipColor(tile.state, tokens);
          return (
            <View
              key={tile.kind}
              style={{
                backgroundColor: tokens.bg.surface,
                borderRadius: 14, padding: 14, marginBottom: 12,
                borderWidth: 1, borderColor: tokens.border.default,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: tokens.bg.surfaceMuted,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Ionicons name={tile.icon} size={20} color={tokens.text.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
                    {tile.title}
                  </Text>
                  {tile.expiry ? (
                    <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                      {t("kyc.expires", "Expires")}: {new Date(tile.expiry).toLocaleDateString()}
                    </Text>
                  ) : !tile.expiryField && tile.url ? (
                    <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                      {t("kyc.onFile", "On file")}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                      {t("kyc.notUploaded", "Not uploaded yet")}
                    </Text>
                  )}
                </View>
                <View
                  style={{
                    backgroundColor: chip.bg,
                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "800", color: chip.text }}>
                    {chip.label}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => openSheet(tile)}
                accessibilityRole="button"
                style={{
                  marginTop: 12,
                  paddingVertical: 10, borderRadius: 10,
                  backgroundColor: tile.state === "missing" || tile.state === "expired"
                    ? tokens.brand.default
                    : tokens.bg.surfaceMuted,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 13, fontWeight: "700",
                    color: tile.state === "missing" || tile.state === "expired"
                      ? tokens.text.onBrand
                      : tokens.text.primary,
                  }}
                >
                  {tile.url
                    ? t("kyc.reupload", "Re-upload")
                    : t("kyc.upload", "Upload")}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!activeTile}
        animationType="slide"
        transparent
        onRequestClose={closeSheet}
      >
        <View style={{ flex: 1, backgroundColor: tokens.overlay.scrim, justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderTopLeftRadius: 18, borderTopRightRadius: 18,
              padding: 20, paddingBottom: 32,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary, marginBottom: 6 }}>
              {activeTile?.url
                ? t("kyc.reuploadTitle", "Re-upload {{name}}", { name: activeTile?.title })
                : t("kyc.uploadTitle", "Upload {{name}}", { name: activeTile?.title })}
            </Text>
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 16 }}>
              {t("kyc.uploadHint", "Clear, well-lit photo. PDFs aren't supported on mobile right now.")}
            </Text>

            <TouchableOpacity
              onPress={() =>
                chooseImageSource(handlePick("camera"), handlePick("gallery"), {
                  title: t("support.attachPhoto", "Attach a photo"),
                  camera: t("photo.camera", "Camera"),
                  gallery: t("photo.library", "Photo Library"),
                  cancel: t("photo.cancel", "Cancel"),
                })
              }
              disabled={uploading || submitting}
              style={{
                backgroundColor: pickedUri ? tokens.status.successSoft : tokens.bg.surfaceMuted,
                paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 14,
                flexDirection: "row", justifyContent: "center", gap: 8,
              }}
            >
              <Ionicons
                name={pickedUri ? "checkmark-circle" : "camera-outline"}
                size={20}
                color={pickedUri ? tokens.status.successStrong : tokens.text.primary}
              />
              <Text style={{ fontWeight: "700", color: pickedUri ? tokens.status.successStrong : tokens.text.primary }}>
                {pickedUri ? t("kyc.photoPicked", "Photo selected") : t("kyc.pickPhoto", "Pick a photo")}
              </Text>
            </TouchableOpacity>

            {activeTile?.expiryField ? (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>
                  {activeTile.requireExpiry
                    ? t("kyc.expiryLabel", "Expiry date")
                    : t("kyc.expiryLabelOptional", "Expiry date (optional)")}
                </Text>
                <DatePickerField
                  value={expiryInput}
                  onChange={setExpiryInput}
                  placeholder={t("kyc.expiryPlaceholder", "Select expiry date")}
                  minDate={new Date()}
                />
                {!activeTile.requireExpiry ? (
                  <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: -8, marginBottom: 14 }}>
                    {t("kyc.expiryHintOptional", "Leave blank if your ID doesn't have an expiry.")}
                  </Text>
                ) : null}
              </>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={closeSheet}
                disabled={submitting}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: tokens.bg.surfaceMuted,
                }}
              >
                <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>
                  {t("common.cancel", "Cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || !pickedUri}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: tokens.brand.default,
                  opacity: submitting || !pickedUri ? 0.6 : 1,
                }}
              >
                {submitting ? (
                  <ActivityIndicator color={tokens.text.onBrand} />
                ) : (
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>
                    {t("kyc.submit", "Submit")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
