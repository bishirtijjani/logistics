import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { changeTransactionPin } from "../../store/slices/profileSlice";
import { useTheme } from "../../theme";
import PinField from "../../components/PinField";

const PIN_LENGTH = 6;

export default function ChangePinScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  const { isUpdating } = useSelector((state) => state.profile);
  const [step, setStep] = useState("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const stepConfig = {
    current: {
      value: currentPin, setter: setCurrentPin,
      title: t("changePin.currentPinLabel"),
      sub: t("changePin.currentRequired"),
      next: "new",
    },
    new: {
      value: newPin, setter: setNewPin,
      title: t("changePin.newPinLabel"),
      sub: t("changePin.newRequired"),
      next: "confirm",
    },
    confirm: {
      value: confirmPin, setter: setConfirmPin,
      title: t("changePin.confirmPinLabel"),
      sub: t("auth.pinConfirmSub"),
      next: null,
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
      // confirm step
      if (confirmPin === newPin) {
        handleSubmit(currentPin, confirmPin);
      } else {
        Toast.show({
          type: "error",
          text1: t("changePin.mismatch"),
          text2: t("auth.pinMismatchToastSub"),
        });
        setStep("new");
        setNewPin("");
        setConfirmPin("");
      }
    }
  };

  const handleSubmit = async (oldPin, newPinValue) => {
    try {
      await dispatch(
        changeTransactionPin({ currentPin: oldPin, newPin: newPinValue }),
      ).unwrap();
      Toast.show({
        type: "success",
        text1: t("changePin.success"),
        // Distinct from the first-time "PIN created" copy so a change reads
        // as a change, not a fresh setup.
        text2: t("changePin.successSub"),
      });
      navigation.goBack();
    } catch (err) {
      // The rejected payload is the server message string (e.g. "Incorrect
      // PIN" when the current PIN is wrong). Surface it instead of silently
      // bouncing back to step 1 with no feedback.
      const msg = typeof err === "string" ? err : err?.message;
      Toast.show({
        type: "error",
        text1: t("changePin.failed"),
        text2: msg || t("changePin.currentWrong"),
      });
      setStep("current");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    }
  };

  const stepIndex = step === "current" ? 0 : step === "new" ? 1 : 2;

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
          }}
        >
          {t("changePin.title")}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          paddingTop: 40,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: tokens.bg.elevated,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Ionicons name="key" size={32} color={tokens.brand.default} />
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "900",
            color: tokens.text.primary,
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {current.title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: tokens.text.muted,
            textAlign: "center",
            marginBottom: 36,
          }}
        >
          {current.sub}
        </Text>

        <PinField key={step} value={current.value} onChangeText={current.setter} />

        {/* Step indicator */}
        <View style={{ flexDirection: "row", marginTop: 20 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 24,
                height: 4,
                borderRadius: 2,
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
            marginTop: 28,
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
