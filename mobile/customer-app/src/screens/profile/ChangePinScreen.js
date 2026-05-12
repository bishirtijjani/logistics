import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { changeTransactionPin } from "../../store/slices/profileSlice";
import { colors } from "../../theme";

const PIN_LENGTH = 6;

export default function ChangePinScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isUpdating } = useSelector((state) => state.profile);
  const [step, setStep] = useState("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const inputRef = useRef(null);

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

  const handleDigitChange = (text) => {
    const digits = text.replace(/\D/g, "").slice(0, PIN_LENGTH);
    current.setter(digits);

    if (digits.length === PIN_LENGTH) {
      setTimeout(() => {
        if (step === "current") {
          setStep("new");
          setNewPin("");
        } else if (step === "new") {
          setStep("confirm");
          setConfirmPin("");
        } else {
          // confirm step
          if (digits === newPin) {
            handleSubmit(currentPin, digits);
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
      }, 200);
    }
  };

  const handleSubmit = async (oldPin, newPinValue) => {
    const result = await dispatch(
      changeTransactionPin({ currentPin: oldPin, newPin: newPinValue }),
    );
    if (changeTransactionPin.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: t("changePin.success"),
        text2: t("auth.pinSetToastSub"),
      });
      navigation.goBack();
    } else {
      // Reset on failure
      setStep("current");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    }
  };

  const stepIndex = step === "current" ? 0 : step === "new" ? 1 : 2;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

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
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: colors.text,
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
            backgroundColor: colors.dark,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Ionicons name="key" size={32} color={colors.primary} />
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "900",
            color: colors.text,
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {current.title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.textMuted,
            textAlign: "center",
            marginBottom: 36,
          }}
        >
          {current.sub}
        </Text>

        {/* PIN Dots */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                marginHorizontal: 8,
                backgroundColor:
                  i < current.value.length ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>

        <TextInput
          ref={inputRef}
          key={step}
          value={current.value}
          onChangeText={handleDigitChange}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          autoFocus
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
          }}
        />

        <TouchableOpacity
          onPress={() => inputRef.current?.focus()}
          style={{ paddingVertical: 12, paddingHorizontal: 24 }}
        >
          <Text
            style={{
              fontSize: 13,
              color: colors.textMuted,
              fontWeight: "600",
            }}
          >
            Tap here if keyboard hides
          </Text>
        </TouchableOpacity>

        {/* Step indicator */}
        <View style={{ flexDirection: "row", marginTop: 20 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 24,
                height: 4,
                borderRadius: 2,
                backgroundColor:
                  i <= stepIndex ? colors.primary : colors.border,
                marginHorizontal: 3,
              }}
            />
          ))}
        </View>

        {isUpdating && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 24 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
