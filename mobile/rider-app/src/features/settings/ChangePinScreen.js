/**
 * ChangePinScreen - three-step PIN change (current → new → confirm).
 * Submits via `profileSlice.changeTransactionPin`.
 */

import React, { useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { changeTransactionPin } from "../../store/slices/profileSlice";
import PinField from "../../components/PinField";

const PIN_LENGTH = 6;

export default function ChangePinScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const isUpdating = useSelector((s) => s.profile?.isUpdating);

  const [step, setStep] = useState("current"); // current | new | confirm
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const stepConfig = {
    current: {
      value: currentPin,
      setter: setCurrentPin,
      title: t("changePin.currentPinLabel", "Current PIN"),
      sub: t("changePin.currentRequired", "Enter your current PIN"),
    },
    new: {
      value: newPin,
      setter: setNewPin,
      title: t("changePin.newPinLabel", "New PIN"),
      sub: t("changePin.newRequired", "Enter your new PIN"),
    },
    confirm: {
      value: confirmPin,
      setter: setConfirmPin,
      title: t("changePin.confirmPinLabel", "Confirm new PIN"),
      sub: t("changePin.confirmRequired", "Enter it again to confirm"),
    },
  };

  const current = stepConfig[step];

  const handleConfirm = () => {
    if (current.value.length !== PIN_LENGTH) return;
    if (step === "current") {
      setStep("new");
      setNewPin("");
    } else if (step === "new") {
      setStep("confirm");
      setConfirmPin("");
    } else {
      if (confirmPin === newPin) {
        handleSubmit(currentPin, confirmPin);
      } else {
        Toast.show({
          type: "error",
          text1: t("changePin.mismatch", "PINs don't match"),
        });
        setStep("new");
        setNewPin("");
        setConfirmPin("");
      }
    }
  };

  const handleSubmit = async (oldPin, newPinValue) => {
    try {
      await dispatch(changeTransactionPin({ currentPin: oldPin, newPin: newPinValue })).unwrap();
      Toast.show({
        type: "success",
        text1: t("changePin.success", "PIN changed"),
        // Distinct from the first-time "PIN created" copy so a change reads
        // as a change, not a fresh setup.
        text2: t("changePin.successSub", "Your transaction PIN has been updated."),
      });
      goBackOr(navigation);
    } catch (err) {
      // Rejected payload is the server message string (e.g. "Incorrect PIN"),
      // so reach for the string itself before err.message.
      const msg = typeof err === "string" ? err : err?.message;
      Toast.show({
        type: "error",
        text1: t("changePin.failed", "Couldn't change PIN"),
        text2: msg || t("changePin.currentWrong", "Your current PIN is incorrect"),
      });
      setStep("current");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    }
  };

  const stepIndex = step === "current" ? 0 : step === "new" ? 1 : 2;

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
          {t("changePin.title", "Change Transaction PIN")}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", paddingTop: 40, paddingHorizontal: 20 }}>
        <View
          style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: tokens.brand.soft,
            alignItems: "center", justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Ionicons name="key" size={32} color={tokens.brand.default} />
        </View>

        <Text style={{ fontSize: 22, fontWeight: "900", color: tokens.text.primary, marginBottom: 8, textAlign: "center", letterSpacing: -0.4 }}>
          {current.title}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.text.muted, textAlign: "center", marginBottom: 28 }}>
          {current.sub}
        </Text>

        <PinField key={step} value={current.value} onChangeText={current.setter} />

        <View style={{ flexDirection: "row", marginTop: 16 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 24, height: 4, borderRadius: 2,
                backgroundColor: i <= stepIndex ? tokens.brand.default : tokens.border.default,
                marginHorizontal: 3,
              }}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={current.value.length !== PIN_LENGTH || isUpdating}
          style={{
            alignSelf: "stretch",
            marginTop: 26,
            paddingVertical: 15,
            borderRadius: 14,
            alignItems: "center",
            backgroundColor: current.value.length === PIN_LENGTH && !isUpdating ? tokens.brand.default : tokens.bg.surfaceMuted,
          }}
        >
          <Text style={{ fontWeight: "800", fontSize: 15, color: current.value.length === PIN_LENGTH && !isUpdating ? tokens.text.onBrand : tokens.text.muted }}>
            {isUpdating ? t("common.pleaseWait", "Please wait...") : step === "confirm" ? t("changePin.submit", "Change PIN") : t("common.continue", "Continue")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
