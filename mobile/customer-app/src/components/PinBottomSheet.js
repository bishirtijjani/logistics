import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

const { height } = Dimensions.get("window");
const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 3;

export default function PinBottomSheet({
  isVisible,
  onClose,
  onConfirm,
  title = "Enter PIN",
  subtitle = "Please enter your 6-digit transaction PIN",
  onForgotPin,
}) {
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState("");
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (isVisible) {
      setPin("");
      setError("");
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnimation, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const shake = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = (key) => {
    if (isLocked) return;

    if (key === "backspace") {
      setPin((prev) => prev.slice(0, -1));
      setError("");
    } else if (key === "forgot") {
      onForgotPin?.();
    } else if (pin.length < PIN_LENGTH) {
      const newPin = pin + key;
      setPin(newPin);
      setError("");

      if (newPin.length === PIN_LENGTH) {
        // Auto-submit when PIN is complete
        setTimeout(() => handleConfirm(newPin), 100);
      }
    }
  };

  const handleConfirm = async (pinValue) => {
    if (attempts >= MAX_ATTEMPTS) {
      setIsLocked(true);
      setError("Too many attempts. Please try again in 30 minutes.");
      shake();
      return;
    }

    try {
      await onConfirm(pinValue);
      setPin("");
      setAttempts(0);
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin("");
      setError(`Invalid PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
      shake();

      if (newAttempts >= MAX_ATTEMPTS) {
        setIsLocked(true);
      }
    }
  };

  const renderPinDots = () => (
    <View className="flex-row justify-center mb-8">
      {Array.from({ length: PIN_LENGTH }).map((_, index) => (
        <View
          key={index}
          className={`w-4 h-4 rounded-full border-2 mx-2 items-center justify-center ${index < pin.length ? 'border-orange-600 bg-orange-600/20' : 'border-gray-200'} ${error ? 'border-red-500' : ''}`}
        >
          {index < pin.length && <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} />}
        </View>
      ))}
    </View>
  );

  const renderKeypad = () => {
    const keys = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["forgot", "0", "backspace"],
    ];

    return (
      <View className="mb-3">
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row justify-between mb-3">
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                className={`w-20 h-14 rounded-xl bg-white items-center justify-center ${key === "forgot" ? "w-20" : ""}`}
                onPress={() => handleKeyPress(key)}
                disabled={isLocked && key !== "backspace"}
              >
                {key === "backspace" ? (
                  <Ionicons name="backspace-outline" size={24} color={colors.text} />
                ) : key === "forgot" ? (
                  <Text className="text-xs font-semibold" style={{ color: colors.primary }}>Forgot?</Text>
                ) : (
                  <Text className="text-2xl font-semibold" style={{ color: colors.text }}>{key}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <TouchableOpacity className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }} onPress={onClose} activeOpacity={1} />

        <Animated.View
          className="bg-white rounded-t-3xl px-6 pb-8"
          style={{ maxHeight: height * 0.85, transform: [{ translateY: slideAnimation }] }}
        >
          {/* Handle */}
          <View className="w-10 h-1 bg-gray-200 rounded self-center mt-3 mb-4" />

          {/* Header */}
          <View className="items-center mb-6 relative">
            <Text className="text-xl font-extrabold mb-2" style={{ color: colors.text }}>{title}</Text>
            <Text className="text-sm text-center" style={{ color: colors.textMuted }}>{subtitle}</Text>
            <TouchableOpacity className="absolute right-0 top-0 p-1" onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? (
            <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
              <View className="flex-row items-center rounded-xl p-3 mb-4" style={{ backgroundColor: colors.error + "15" }}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text className="ml-2 text-xs font-medium flex-1" style={{ color: colors.error }}>{error}</Text>
              </View>
            </Animated.View>
          ) : null}

          {/* PIN Dots */}
          <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
            {renderPinDots()}
          </Animated.View>

          {/* Keypad */}
          {renderKeypad()}

          {/* Cancel Button */}
          <TouchableOpacity className="items-center py-3" onPress={onClose}>
            <Text className="text-base font-semibold" style={{ color: colors.textMuted }}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
