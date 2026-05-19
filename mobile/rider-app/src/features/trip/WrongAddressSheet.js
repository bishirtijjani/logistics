import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { reportAddressCorrection } from "../../store/slices/tripSlice";

/**
 * WrongAddressSheet — file an address-correction note. Optionally pins the
 * current location as the "corrected" coordinates (sourced from
 * riderSlice.lastFix). Doesn't change the trip status — dispatch acts on the
 * note out-of-band.
 */
export default function WrongAddressSheet({ visible, stage, onClose, onSent }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const activeRequestId = useSelector((s) => s.trip.activeRequestId);
  const lastFix = useSelector((s) => s.rider.lastFix);
  const [note, setNote] = useState("");
  const [includeMyLocation, setIncludeMyLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = note.trim().length >= 3 && stage && !submitting;

  const reset = () => {
    setNote("");
    setIncludeMyLocation(true);
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const submit = async () => {
    if (!canSubmit || !activeRequestId) return;
    setSubmitting(true);
    const lat = includeMyLocation && lastFix?.lat ? Number(lastFix.lat) : undefined;
    const lng = includeMyLocation && lastFix?.lng ? Number(lastFix.lng) : undefined;
    const action = await dispatch(reportAddressCorrection({
      requestId: activeRequestId,
      stage,
      note: note.trim(),
      lat,
      lng,
    }));
    setSubmitting(false);
    if (action.meta.requestStatus === "fulfilled") {
      Toast.show({
        type: "success",
        text1: t("trip.wrong.sentTitle", "Sent to dispatch"),
        text2: t("trip.wrong.sentSub", "We'll follow up with the right party."),
      });
      handleClose();
      onSent?.();
    } else {
      Toast.show({
        type: "error",
        text1: t("trip.wrong.failed", "Couldn't send"),
        text2: action.payload?.message || t("trip.wrong.failedFallback", "Try again in a moment."),
      });
    }
  };

  const stageLabel = stage === "pickup"
    ? t("trip.wrong.stagePickup", "pickup")
    : t("trip.wrong.stageDropoff", "dropoff");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: tokens.overlay.scrim, justifyContent: "flex-end" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            backgroundColor: tokens.bg.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28,
          }}
        >
          <View
            style={{
              alignSelf: "center", width: 38, height: 4, borderRadius: 2,
              backgroundColor: tokens.border.strong, marginBottom: 14,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 16 }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                alignItems: "center", justifyContent: "center",
                backgroundColor: tokens.status.warningSoft,
                marginRight: 12,
              }}
            >
              <Ionicons name="warning" size={18} color={tokens.status.warningStrong} />
            </View>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: "800", color: tokens.text.primary }}>
                {t("trip.wrong.title", "Wrong {{stage}} address?", { stage: stageLabel })}
              </Text>
              <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 3 }}>
                {t("trip.wrong.subtitle", "Tell dispatch what's wrong. They'll follow up — your trip stays in flight.")}
              </Text>
            </View>
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t("trip.wrong.placeholder", "e.g. The address is one block north — gate is by the green mosque")}
            placeholderTextColor={tokens.text.placeholder}
            multiline
            maxLength={500}
            accessibilityLabel={t("trip.wrong.noteAria", "Address correction note")}
            style={{
              minHeight: 110,
              textAlignVertical: "top",
              borderRadius: 12,
              backgroundColor: tokens.bg.surfaceMuted,
              borderWidth: 1,
              borderColor: tokens.border.default,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 10,
              fontSize: 14,
              color: tokens.text.primary,
            }}
          />
          <Text style={{ fontSize: 11, color: tokens.text.placeholder, marginTop: 4, marginBottom: 14 }}>
            {note.length}/500
          </Text>

          {/* Attach current location toggle */}
          <TouchableOpacity
            onPress={() => setIncludeMyLocation((v) => !v)}
            disabled={!lastFix}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: includeMyLocation, disabled: !lastFix }}
            accessibilityLabel={t("trip.wrong.attachAria", "Include my current location as the correction")}
            style={{
              flexDirection: "row", alignItems: "center",
              padding: 12, borderRadius: 12,
              backgroundColor: tokens.bg.surfaceMuted,
              borderWidth: 1, borderColor: tokens.border.default,
              opacity: lastFix ? 1 : 0.5,
              marginBottom: 14,
            }}
          >
            <Ionicons
              name={includeMyLocation && lastFix ? "checkbox" : "square-outline"}
              size={20}
              color={includeMyLocation && lastFix ? tokens.brand.default : tokens.text.muted}
            />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: tokens.text.primary }}>
                {t("trip.wrong.attach", "Attach my current location")}
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                {lastFix
                  ? `${lastFix.lat.toFixed(5)}, ${lastFix.lng.toFixed(5)}`
                  : t("trip.wrong.waitingGps", "Waiting on GPS — go online to capture a fix.")}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t("trip.wrong.notNowAria", "Cancel")}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 12,
                alignItems: "center", backgroundColor: tokens.bg.surfaceMuted,
              }}
            >
              <Text style={{ color: tokens.text.primary, fontWeight: "700", fontSize: 14 }}>
                {t("trip.wrong.notNow", "Not now")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
              accessibilityLabel={t("trip.wrong.sendAria", "Send correction")}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 12,
                alignItems: "center", justifyContent: "center",
                backgroundColor: canSubmit ? tokens.brand.default : tokens.border.strong,
              }}
            >
              {submitting ? (
                <ActivityIndicator color={tokens.text.onBrand} />
              ) : (
                <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
                  {t("trip.wrong.send", "Send")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
