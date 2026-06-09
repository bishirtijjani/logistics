import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Vibration,
} from "react-native";
import * as SecureStore from "../lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { InModalToast } from "./toastShared";

const { height } = Dimensions.get("window");
const PIN_LENGTH = 6;
// Legacy key: older builds persisted a lockout deadline here. The attempt-based
// lockout has been removed, so we just delete this on mount to free any user
// who was still locked from before the update.
const LEGACY_LOCK_KEY = "pin:lockedUntilEpochMs";

export default function PinBottomSheet({
  isVisible,
  onClose,
  onConfirm,
  title = "Enter PIN",
  subtitle = "Please enter your 6-digit transaction PIN",
  onForgotPin,
  onSetupPin,
}) {
  const { tokens } = useTheme();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(height)).current;

  // One-time cleanup of any lockout deadline left by older builds.
  useEffect(() => {
    SecureStore.deleteItemAsync(LEGACY_LOCK_KEY).catch(() => {});
  }, []);

  // Slide animation + reset transient state on open/close.
  useEffect(() => {
    if (isVisible) {
      setPin("");
      setError("");
      setNeedsSetup(false);
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

  const shake = useCallback(() => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnimation]);

  const handleConfirm = async (pinValue) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(pinValue);
      setPin("");
      setError("");
    } catch (err) {
      setPin("");
      shake();

      if (err?.code === "PIN_NOT_SET") {
        // The user has no transaction PIN yet - keypad is useless. Swap the
        // sheet into a "set up your PIN" state with a CTA that closes the
        // sheet and hands control back to the caller via `onSetupPin`.
        setNeedsSetup(true);
        setError(err.message || "Set your transaction PIN to continue.");
      } else {
        // Wrong PIN (or any other failure): let the user retry freely.
        setError(err?.message || "Incorrect PIN. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (key) => {
    if (submitting || needsSetup) return;

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
        // Auto-submit a tick later so the dot updates render first.
        setTimeout(() => handleConfirm(newPin), 100);
      }
    }
  };

  const renderPinDots = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: PIN_LENGTH }).map((_, index) => (
        <View
          key={index}
          style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, marginHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderColor: error ? tokens.status.error : index < pin.length ? tokens.brand.default : tokens.border.default, backgroundColor: index < pin.length ? tokens.brand.soft : 'transparent' }}
        >
          {index < pin.length && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.brand.default }} />}
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
            {row.map((key) => {
              const disabled = submitting || needsSetup;
              return (
                <TouchableOpacity
                  key={key}
                  style={{ width: 80, height: 56, borderRadius: 12, backgroundColor: disabled ? tokens.bg.surfaceMuted : tokens.bg.surface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.6 : 1 }}
                  onPress={() => handleKeyPress(key)}
                  disabled={disabled}
                >
                  {key === "backspace" ? (
                    <Ionicons name="backspace-outline" size={24} color={tokens.text.primary} />
                  ) : key === "forgot" ? (
                    <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.brand.strong }}>Forgot?</Text>
                  ) : (
                    <Text style={{ fontSize: 24, fontWeight: '600', color: tokens.text.primary }}>{key}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tokens.overlay.scrim }} onPress={onClose} activeOpacity={1} />

        <Animated.View
          style={{ backgroundColor: tokens.bg.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 32, maxHeight: height * 0.85, transform: [{ translateY: slideAnimation }] }}
        >
          {/* Handle */}
          <View style={{ width: 40, height: 4, backgroundColor: tokens.border.default, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />

          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 24, position: 'relative' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8, color: tokens.text.primary }}>{title}</Text>
            <Text style={{ fontSize: 14, textAlign: 'center', color: tokens.text.muted }}>{subtitle}</Text>
            <TouchableOpacity style={{ position: 'absolute', right: 0, top: 0, padding: 4 }} onPress={onClose}>
              <Ionicons name="close" size={24} color={tokens.text.muted} />
            </TouchableOpacity>
          </View>

          {/* Setup prompt - shown when the server reports no PIN is set yet.
              Replaces the silent "incorrect PIN" failure with a clear path to
              the SetPin screen. The keypad is disabled (handleKeyPress + the
              `disabled` flag below) while this is visible. */}
          {needsSetup ? (
            <View style={{ borderRadius: 12, padding: 14, marginBottom: 16, backgroundColor: tokens.brand.soft, borderWidth: 1, borderColor: tokens.brand.softBorder }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color={tokens.brand.default} />
                <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '800', color: tokens.text.primary, flex: 1 }}>
                  Set up your transaction PIN
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 12 }}>
                {error || "You need a 6-digit PIN to authorize this. It only takes a moment."}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  onClose?.();
                  onSetupPin?.();
                }}
                style={{ backgroundColor: tokens.brand.default, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Set up PIN"
              >
                <Text style={{ color: tokens.text.onBrand, fontWeight: '800', fontSize: 14 }}>Set up PIN</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Error (only when not displaying the setup prompt) */}
          {!needsSetup && error ? (
            <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: tokens.status.errorSoft }}>
                <Ionicons name="alert-circle" size={16} color={tokens.status.error} />
                <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '500', flex: 1, color: tokens.status.error }}>{error}</Text>
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
            <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.text.muted }}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
        <InModalToast />
      </View>
    </Modal>
  );
}
