import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
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
    <View style={styles.pinContainer}>
      {Array.from({ length: PIN_LENGTH }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.pinDot,
            index < pin.length && styles.pinDotFilled,
            error && styles.pinDotError,
          ]}
        >
          {index < pin.length && <View style={styles.pinDotInner} />}
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
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.keypadKey, key === "forgot" && styles.keypadKeyWide]}
                onPress={() => handleKeyPress(key)}
                disabled={isLocked && key !== "backspace"}
              >
                {key === "backspace" ? (
                  <Ionicons name="backspace-outline" size={24} color={colors.text} />
                ) : key === "forgot" ? (
                  <Text style={styles.forgotText}>Forgot?</Text>
                ) : (
                  <Text style={styles.keypadKeyText}>{key}</Text>
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
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnimation }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? (
            <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
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
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: height * 0.85,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    right: 0,
    top: 0,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error + "15",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 13,
    color: colors.error,
    fontWeight: "500",
    flex: 1,
  },
  pinContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 32,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    marginHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pinDotFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "20",
  },
  pinDotError: {
    borderColor: colors.error,
  },
  pinDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  keypad: {
    marginBottom: 16,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  keypadKey: {
    width: 80,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  keypadKeyWide: {
    width: 80,
  },
  keypadKeyText: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.text,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
