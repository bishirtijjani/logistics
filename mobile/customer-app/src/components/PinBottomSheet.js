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
import { colors } from "../theme";
import { InModalToast } from "./toastShared";

const { height } = Dimensions.get("window");
const PIN_LENGTH = 6;
// SecureStore key persists the lockout deadline so 6 wrong PINs followed by an
// app restart still leave the user locked out (server is still the source of
// truth - this just hides the keypad until the deadline passes locally too).
const LOCKED_UNTIL_KEY = "pin:lockedUntilEpochMs";

/**
 * Read structured lockout / attempt info that the server attached to the error
 * via AppError.errors. Matches the contract documented in `services/api.js`
 * and `auth.service.verifyTransactionPin`.
 */
const extractServerInfo = (err) => {
  const data = err?.data?.errors || {};
  return {
    status: err?.status ?? null,
    lockedUntil: typeof data.lockedUntil === "number" ? data.lockedUntil : null,
    attemptsRemaining:
      typeof data.attemptsRemaining === "number" ? data.attemptsRemaining : null,
  };
};

const formatCountdown = (msRemaining) => {
  if (msRemaining <= 0) return "0s";
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
};

export default function PinBottomSheet({
  isVisible,
  onClose,
  onConfirm,
  title = "Enter PIN",
  subtitle = "Please enter your 6-digit transaction PIN",
  onForgotPin,
  onSetupPin,
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(null); // epoch ms
  const [now, setNow] = useState(Date.now());
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(height)).current;

  const isLocked = lockedUntil !== null && now < lockedUntil;

  // Hydrate persisted lock on mount and whenever the sheet opens.
  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    (async () => {
      const raw = await SecureStore.getItemAsync(LOCKED_UNTIL_KEY);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      if (cancelled) return;
      if (!Number.isNaN(parsed) && parsed > Date.now()) {
        setLockedUntil(parsed);
      } else if (!Number.isNaN(parsed)) {
        // Stale lock - clean up.
        await SecureStore.deleteItemAsync(LOCKED_UNTIL_KEY);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVisible]);

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

  // Tick the countdown once a second only while a lock is active and visible.
  useEffect(() => {
    if (!isVisible || !isLocked) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (lockedUntil !== null && t >= lockedUntil) {
        setLockedUntil(null);
        SecureStore.deleteItemAsync(LOCKED_UNTIL_KEY).catch(() => {});
        setError("");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isVisible, isLocked, lockedUntil]);

  const shake = useCallback(() => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnimation]);

  const applyLock = useCallback(async (until) => {
    setLockedUntil(until);
    setNow(Date.now());
    try {
      await SecureStore.setItemAsync(LOCKED_UNTIL_KEY, String(until));
    } catch {
      // SecureStore failure is non-fatal - the in-memory lock still stands.
    }
  }, []);

  const handleConfirm = async (pinValue) => {
    if (submitting || isLocked) return;
    setSubmitting(true);
    try {
      await onConfirm(pinValue);
      // Success: clear any persisted lock + reset.
      setPin("");
      setError("");
      if (lockedUntil !== null) {
        setLockedUntil(null);
        SecureStore.deleteItemAsync(LOCKED_UNTIL_KEY).catch(() => {});
      }
    } catch (err) {
      const info = extractServerInfo(err);
      setPin("");
      shake();

      if (err?.code === "PIN_NOT_SET") {
        // The user has no transaction PIN yet - keypad is useless. Swap the
        // sheet into a "set up your PIN" state with a CTA that closes the
        // sheet and hands control back to the caller via `onSetupPin`.
        setNeedsSetup(true);
        setError(err.message || "Set your transaction PIN to continue.");
      } else if (info.status === 423 && info.lockedUntil) {
        await applyLock(info.lockedUntil);
        setError(err.message || "PIN locked.");
      } else if (info.status === 401 && info.attemptsRemaining !== null) {
        setError(err.message || `Incorrect PIN. ${info.attemptsRemaining} left.`);
      } else {
        setError(err?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (key) => {
    if (isLocked || submitting || needsSetup) return;

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
            {row.map((key) => {
              const disabled = (isLocked && key !== "forgot") || submitting || needsSetup;
              return (
                <TouchableOpacity
                  key={key}
                  style={{ width: 80, height: 56, borderRadius: 12, backgroundColor: disabled ? '#F3F4F6' : '#fff', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.6 : 1 }}
                  onPress={() => handleKeyPress(key)}
                  disabled={disabled}
                >
                  {key === "backspace" ? (
                    <Ionicons name="backspace-outline" size={24} color={colors.text} />
                  ) : key === "forgot" ? (
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primaryStrong }}>Forgot?</Text>
                  ) : (
                    <Text style={{ fontSize: 24, fontWeight: '600', color: colors.text }}>{key}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderLockBanner = () => {
    if (!isLocked) return null;
    const remaining = lockedUntil - now;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: colors.error + "15" }}>
        <Ionicons name="lock-closed" size={16} color={colors.error} />
        <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: '600', flex: 1, color: colors.error }}>
          PIN locked. Try again in {formatCountdown(remaining)}.
        </Text>
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

          {renderLockBanner()}

          {/* Setup prompt - shown when the server reports no PIN is set yet.
              Replaces the silent "incorrect PIN" failure with a clear path to
              the SetPin screen. The keypad is disabled (handleKeyPress + the
              `disabled` flag below) while this is visible. */}
          {needsSetup ? (
            <View style={{ borderRadius: 12, padding: 14, marginBottom: 16, backgroundColor: colors.primary + "12", borderWidth: 1, borderColor: colors.primary + "33" }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '800', color: colors.text, flex: 1 }}>
                  Set up your transaction PIN
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 12 }}>
                {error || "You need a 6-digit PIN to authorize this. It only takes a moment."}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  onClose?.();
                  onSetupPin?.();
                }}
                style={{ backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Set up PIN"
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Set up PIN</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Error (only when not displaying the lock banner or setup prompt) */}
          {!isLocked && !needsSetup && error ? (
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
        <InModalToast />
      </View>
    </Modal>
  );
}
