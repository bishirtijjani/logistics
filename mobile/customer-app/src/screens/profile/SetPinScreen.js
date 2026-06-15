import React, { useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { setTransactionPin } from "../../store/slices/profileSlice";
import { useTheme } from "../../theme";
import PinField from "../../components/PinField";

const PIN_LENGTH = 6;

export default function SetPinScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  const { isUpdating } = useSelector((state) => state.profile);
  const [step, setStep] = useState("enter"); // "enter" | "confirm"
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const currentValue = step === "enter" ? pin : confirmPin;
  const setCurrentValue = step === "enter" ? setPin : setConfirmPin;

  const handleConfirm = () => {
    if (currentValue.length !== PIN_LENGTH) return;
    if (step === "enter") {
      setStep("confirm");
      setConfirmPin("");
      return;
    }
    // Confirm step
    if (confirmPin === pin) {
      handleSubmit(confirmPin);
    } else {
      Toast.show({
        type: "error",
        text1: t("auth.pinMismatchToast"),
        text2: t("auth.pinMismatchToastSub"),
      });
      setStep("enter");
      setPin("");
      setConfirmPin("");
    }
  };

  const handleSubmit = async (finalPin) => {
    const result = await dispatch(setTransactionPin(finalPin));
    if (setTransactionPin.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: t("auth.pinSetToast"),
        text2: t("auth.pinSetToastSub"),
      });
      goBackOr(navigation);
    } else {
      setStep("enter");
      setPin("");
      setConfirmPin("");
    }
  };

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
          onPress={() => goBackOr(navigation)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
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
          {t("auth.pinScreenTitle")}
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
        {/* Icon */}
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
          <Ionicons name="keypad" size={32} color={tokens.brand.default} />
        </View>

        <Text
          accessibilityRole="header"
          style={{
            fontSize: 22,
            fontWeight: "900",
            color: tokens.text.primary,
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {step === "enter" ? t("auth.pinCreate") : t("auth.pinConfirm")}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: tokens.text.muted,
            textAlign: "center",
            marginBottom: 36,
            lineHeight: 20,
          }}
        >
          {step === "enter" ? t("auth.pinCreateSub") : t("auth.pinConfirmSub")}
        </Text>

        <PinField key={step} value={currentValue} onChangeText={setCurrentValue} />

        {/* Step indicator */}
        <View style={{ flexDirection: "row", marginTop: 20 }}>
          <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: tokens.brand.default, marginHorizontal: 3 }} />
          <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: step === "confirm" ? tokens.brand.default : tokens.border.default, marginHorizontal: 3 }} />
        </View>

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={currentValue.length !== PIN_LENGTH || isUpdating}
          style={{
            alignSelf: "stretch",
            marginTop: 28,
            paddingVertical: 15,
            borderRadius: 14,
            alignItems: "center",
            backgroundColor: currentValue.length === PIN_LENGTH && !isUpdating ? tokens.brand.default : tokens.bg.surfaceMuted,
          }}
          accessibilityRole="button"
          accessibilityLabel={step === "enter" ? t("common.continue", "Continue") : t("common.confirm", "Confirm")}
        >
          <Text style={{ fontWeight: "800", fontSize: 15, color: currentValue.length === PIN_LENGTH && !isUpdating ? tokens.text.onBrand : tokens.text.muted }}>
            {isUpdating ? t("common.pleaseWait", "Please wait...") : step === "enter" ? t("common.continue", "Continue") : t("common.confirm", "Confirm")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
