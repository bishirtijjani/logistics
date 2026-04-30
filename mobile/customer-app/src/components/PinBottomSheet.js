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
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: PIN_LENGTH }).map((_, index) => (
        <View
          key={index}
          style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, marginHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderColor: error ? '#EF4444' : index < pin.length ? '#EA580C' : '#E5E7EB', backgroundColor: index < pin.length ? 'rgba(234,88,12,0.2)' : 'transparent' }}
        >
          {index < pin.length && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}
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
      <View style={{ marginBottom: 12 }}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={{ width: 80, height: 56, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => handleKeyPress(key)}
                disabled={isLocked && key !== "backspace"}
              >
                {key === "backspace" ? (
                  <Ionicons name="backspace-outline" size={24} color={colors.text} />
                ) : key === "forgot" ? (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Forgot?</Text>
                ) : (
                  <Text style={{ fontSize: 24, fontWeight: '600', color: colors.text }}>{key}</Text>
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
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)" }} onPress={onClose} activeOpacity={1} />

        <Animated.View
          style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 32, maxHeight: height * 0.85, transform: [{ translateY: slideAnimation }] }}
        >
          {/* Handle */}
          <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />

          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 24, position: 'relative' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8, color: colors.text }}>{title}</Text>
            <Text style={{ fontSize: 14, textAlign: 'center', color: colors.textMuted }}>{subtitle}</Text>
            <TouchableOpacity style={{ position: 'absolute', right: 0, top: 0, padding: 4 }} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? (
            <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: colors.error + "15" }}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '500', flex: 1, color: colors.error }}>{error}</Text>
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
          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={onClose}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textMuted }}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
