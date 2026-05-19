import React, { useState } from "react";
import {
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
import PinBottomSheet from "../../components/PinBottomSheet";
import { cancelTrip } from "../../store/slices/tripSlice";

const REASON_CODES = [
  { code: "CUSTOMER_NOT_REACHABLE", icon: "call-outline" },
  { code: "WRONG_ADDRESS",          icon: "location-outline" },
  { code: "VEHICLE_ISSUE",          icon: "construct-outline" },
  { code: "OTHER",                  icon: "ellipsis-horizontal-outline" },
];

/**
 * CancelTripSheet — two-step cancel flow:
 *   1. Reason picker (+ free text for OTHER)
 *   2. PinBottomSheet to authorize
 *
 * Cancellation is PIN-protected because it has user-visible side effects
 * (customer refund + rider operational metric). The same PIN guard protects
 * money moves, so a lost phone can't kill an active delivery from the
 * lockscreen.
 */
export default function CancelTripSheet({ visible, onClose, onCancelled }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const REASONS = REASON_CODES.map((r) => ({
    ...r,
    label: t(`trip.cancel.reason.${r.code}`, defaultReasonLabel(r.code)),
  }));
  const activeRequestId = useSelector((s) => s.trip.activeRequestId);
  const [selected, setSelected] = useState(null);
  const [otherNote, setOtherNote] = useState("");
  const [pinVisible, setPinVisible] = useState(false);

  const reset = () => {
    setSelected(null);
    setOtherNote("");
    setPinVisible(false);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const canProceed = selected
    && (selected !== "OTHER" || otherNote.trim().length >= 3);

  const proceed = () => {
    if (!canProceed) return;
    setPinVisible(true);
  };

  const handlePinConfirm = async (pin) => {
    if (!activeRequestId || !selected) throw new Error("Trip is no longer active");
    const action = await dispatch(cancelTrip({
      requestId: activeRequestId,
      reason: selected,
      note: selected === "OTHER" ? otherNote.trim() : undefined,
      pin,
    }));
    if (action.meta.requestStatus !== "fulfilled") {
      const err = new Error(action.payload?.message || t("trip.cancel.failed", "Couldn't cancel trip"));
      err.code = action.payload?.code;
      err.status = action.payload?.status;
      err.data = action.payload;
      throw err;
    }
    setPinVisible(false);
    handleClose();
    Toast.show({
      type: "success",
      text1: t("trip.cancel.successTitle", "Trip cancelled"),
      text2: t("trip.cancel.successSub", "Customer will be refunded."),
    });
    onCancelled?.();
  };

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
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 18 }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                alignItems: "center", justifyContent: "center",
                backgroundColor: tokens.status.errorSoft,
                borderWidth: 1, borderColor: tokens.status.errorSoftBorder,
                marginRight: 12,
              }}
            >
              <Ionicons name="alert-circle" size={20} color={tokens.status.errorStrong} />
            </View>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
                {t("trip.cancel.title", "Cancel this trip?")}
              </Text>
              <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 3 }}>
                {t("trip.cancel.subtitle", "The customer is refunded. Cancellations affect your acceptance score.")}
              </Text>
            </View>
          </View>

          {REASONS.map((r) => {
            const active = selected === r.code;
            return (
              <TouchableOpacity
                key={r.code}
                onPress={() => setSelected(r.code)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={r.label}
                style={{
                  flexDirection: "row", alignItems: "center",
                  paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: active ? tokens.brand.soft : tokens.bg.surfaceMuted,
                  borderWidth: 1, borderColor: active ? tokens.brand.softBorder : tokens.border.default,
                  marginBottom: 8,
                }}
              >
                <Ionicons name={r.icon} size={18} color={active ? tokens.brand.strong : tokens.text.primary} />
                <Text style={{ marginLeft: 10, fontSize: 14, fontWeight: "600", color: tokens.text.primary, flex: 1 }}>
                  {r.label}
                </Text>
                <Ionicons
                  name={active ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={active ? tokens.brand.strong : tokens.text.placeholder}
                />
              </TouchableOpacity>
            );
          })}

          {selected === "OTHER" ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6, letterSpacing: 0.3 }}>
                {t("trip.cancel.noteLabel", "TELL US WHY")}
              </Text>
              <TextInput
                value={otherNote}
                onChangeText={setOtherNote}
                placeholder={t("trip.cancel.notePlaceholder", "Be specific so support can follow up")}
                placeholderTextColor={tokens.text.placeholder}
                multiline
                maxLength={500}
                accessibilityLabel="Reason details"
                style={{
                  minHeight: 80,
                  textAlignVertical: "top",
                  borderRadius: 10,
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
              <Text style={{ fontSize: 11, color: tokens.text.placeholder, marginTop: 4 }}>
                {otherNote.length}/500
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t("trip.cancel.keep", "Keep trip")}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 12,
                alignItems: "center", backgroundColor: tokens.bg.surfaceMuted,
              }}
            >
              <Text style={{ color: tokens.text.primary, fontWeight: "700", fontSize: 14 }}>
                {t("trip.cancel.keep", "Keep trip")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={proceed}
              disabled={!canProceed}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canProceed }}
              accessibilityLabel={t("trip.cancel.continueAria", "Continue to PIN")}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 12,
                alignItems: "center",
                backgroundColor: canProceed ? tokens.status.error : tokens.border.strong,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                {t("trip.cancel.confirm", "Cancel trip")}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

      <PinBottomSheet
        isVisible={pinVisible}
        onClose={() => setPinVisible(false)}
        onConfirm={handlePinConfirm}
        title={t("trip.cancel.pinTitle", "Authorize cancellation")}
        subtitle={t("trip.cancel.pinSubtitle", "Enter your 6-digit PIN to confirm")}
      />
    </Modal>
  );
}

function defaultReasonLabel(code) {
  switch (code) {
    case "CUSTOMER_NOT_REACHABLE": return "Customer not reachable";
    case "WRONG_ADDRESS": return "Wrong address";
    case "VEHICLE_ISSUE": return "Vehicle issue";
    case "OTHER": return "Other reason";
    default: return code;
  }
}
