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
import Toast from "react-native-toast-message";
import { setTransactionPin } from "../../store/slices/profileSlice";
import { colors } from "../../theme";

const PIN_LENGTH = 6;

export default function SetPinScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isUpdating } = useSelector((state) => state.profile);
  const [step, setStep] = useState("enter"); // "enter" | "confirm"
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const inputRef = useRef(null);

  const currentValue = step === "enter" ? pin : confirmPin;
  const setCurrentValue = step === "enter" ? setPin : setConfirmPin;

  const handleDigitChange = (text) => {
    const digits = text.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setCurrentValue(digits);

    if (digits.length === PIN_LENGTH) {
      if (step === "enter") {
        setTimeout(() => {
          setStep("confirm");
          setConfirmPin("");
        }, 200);
      } else {
        // Confirm step
        if (digits === pin) {
          handleSubmit(digits);
        } else {
          Toast.show({
            type: "error",
            text1: "PINs don't match",
            text2: "Please try again.",
          });
          setStep("enter");
          setPin("");
          setConfirmPin("");
        }
      }
    }
  };

  const handleSubmit = async (finalPin) => {
    const result = await dispatch(setTransactionPin(finalPin));
    if (setTransactionPin.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "PIN Set",
        text2: "Your transaction PIN has been created.",
      });
      navigation.goBack();
    } else {
      setStep("enter");
      setPin("");
      setConfirmPin("");
    }
  };

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
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          Set Transaction PIN
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
            backgroundColor: colors.dark,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Ionicons name="keypad" size={32} color={colors.primary} />
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
          {step === "enter" ? "Create your PIN" : "Confirm your PIN"}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.textMuted,
            textAlign: "center",
            marginBottom: 36,
            lineHeight: 20,
          }}
        >
          {step === "enter"
            ? "Enter a 6-digit PIN you'll use for\npayments and transfers"
            : "Re-enter your PIN to confirm"}
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
                  i < currentValue.length ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>

        {/* Hidden Input */}
        <TextInput
          ref={inputRef}
          value={currentValue}
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

        {/* Tap to focus */}
        <TouchableOpacity
          onPress={() => inputRef.current?.focus()}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 24,
          }}
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
        <View
          style={{
            flexDirection: "row",
            marginTop: 20,
          }}
        >
          <View
            style={{
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.primary,
              marginHorizontal: 3,
            }}
          />
          <View
            style={{
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                step === "confirm" ? colors.primary : colors.border,
              marginHorizontal: 3,
            }}
          />
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
