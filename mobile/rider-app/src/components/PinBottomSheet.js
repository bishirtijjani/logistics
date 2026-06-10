import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Vibration,
} from "react-native";
import { useDispatch } from "react-redux";
import * as SecureStore from "../lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { InModalToast } from "./toastShared";
import { setTransactionPin, resetTransactionPin } from "../store/slices/profileSlice";

const { height } = Dimensions.get("window");
const PIN_LENGTH = 6;
// Legacy key: older builds persisted a lockout deadline here. The attempt-based
// lockout has been removed, so we just delete this on mount to free any user
// who was still locked from before the update.
const LEGACY_LOCK_KEY = "pin:lockedUntilEpochMs";

/**
 * Transaction-PIN sheet. Self-contained across three stages so the user never
 * gets bounced to another screen mid-action:
 *
 *   enter  - verify an existing PIN, then run onConfirm(pin).
 *   setup  - no PIN yet (server says PIN_NOT_SET): create + confirm a new PIN
 *            inline, set it, then run onConfirm(pin).
 *   reset  - "Forgot PIN?": re-auth with the account password, set a new PIN,
 *            then run onConfirm(pin).
 *
 * Key UX fixes over the old sheet: explicit Confirm button (no surprise
 * auto-submit), a show/hide eye toggle (hidden by default), and a real
 * recovery path for a forgotten PIN.
 *
 * Contract: onConfirm(pin) executes the gated action and MUST throw on failure
 * (the api error carries `.code`, e.g. PIN_NOT_SET / INVALID_PIN). On success
 * the parent hides the sheet. onForgotPin/onSetupPin are accepted for backward
 * compatibility but are no longer needed - both flows are handled inline.
 */
export default function PinBottomSheet({
  isVisible,
  onClose,
  onConfirm,
  title = "Enter PIN",
  subtitle = "Please enter your 6-digit transaction PIN",
}) {
  const { tokens } = useTheme();
  const dispatch = useDispatch();

  const [stage, setStage] = useState("enter"); // enter | setup | reset
  const [step, setStep] = useState("create"); // create | confirm (setup) ; password | create | confirm (reset)
  const [entry, setEntry] = useState(""); // active 6-digit field driven by the keypad
  const [firstPin, setFirstPin] = useState(""); // remembered "create" value for the confirm step
  const [password, setPassword] = useState(""); // reset stage only
  const [reveal, setReveal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(height)).current;

  const resetAll = useCallback(() => {
    setStage("enter");
    setStep("create");
    setEntry("");
    setFirstPin("");
    setPassword("");
    setReveal(false);
    setShowPassword(false);
    setError("");
    setSubmitting(false);
  }, []);

  // One-time cleanup of any lockout deadline left by older builds.
  useEffect(() => {
    SecureStore.deleteItemAsync(LEGACY_LOCK_KEY).catch(() => {});
  }, []);

  // Slide in/out + reset transient state on open/close.
  useEffect(() => {
    if (isVisible) {
      resetAll();
      Animated.timing(slideAnimation, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnimation, { toValue: height, duration: 200, useNativeDriver: true }).start();
    }
  }, [isVisible, resetAll, slideAnimation]);

  const shake = useCallback(() => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnimation]);

  const fail = useCallback((message) => {
    setError(message);
    setEntry("");
    shake();
  }, [shake]);

  // ── Stage copy ──────────────────────────────────────────────
  const copy = (() => {
    if (stage === "setup") {
      return step === "create"
        ? { heading: "Create your PIN", sub: "Choose a 6-digit transaction PIN. You'll use it to authorize payments." }
        : { heading: "Confirm your PIN", sub: "Re-enter the 6-digit PIN to confirm." };
    }
    if (stage === "reset") {
      if (step === "password") return { heading: "Reset your PIN", sub: "Confirm your account password to reset your transaction PIN." };
      return step === "create"
        ? { heading: "New PIN", sub: "Choose a new 6-digit transaction PIN." }
        : { heading: "Confirm new PIN", sub: "Re-enter your new PIN to confirm." };
    }
    return { heading: title, sub: subtitle };
  })();

  // ── Submit handlers per stage/step ──────────────────────────
  const runConfirm = useCallback(async (pinValue) => {
    // Execute the gated action with a known-good PIN. On failure surface the
    // message but keep the sheet open so the user can react.
    await onConfirm(pinValue);
  }, [onConfirm]);

  const finishWithPin = useCallback(async (pinValue) => {
    // The PIN now exists (just set or reset). Switch to the verify stage so any
    // retry uses the keypad, then authorize the original action with it.
    setStage("enter");
    setStep("create");
    setFirstPin("");
    setEntry("");
    setSubmitting(true);
    try {
      await onConfirm(pinValue);
    } catch (err) {
      fail(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [onConfirm, fail]);

  const handleConfirm = async () => {
    if (submitting) return;
    setError("");

    // ----- ENTER: verify existing PIN -----
    if (stage === "enter") {
      if (entry.length !== PIN_LENGTH) return;
      setSubmitting(true);
      try {
        await runConfirm(entry);
        setEntry("");
      } catch (err) {
        if (err?.code === "PIN_NOT_SET") {
          // No PIN yet: switch into inline setup instead of failing silently.
          setStage("setup");
          setStep("create");
          setEntry("");
          setFirstPin("");
          setError("");
        } else {
          fail(err?.message || "Incorrect PIN. Please try again.");
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ----- SETUP: create -> confirm -> set -> run -----
    if (stage === "setup") {
      if (step === "create") {
        if (entry.length !== PIN_LENGTH) return;
        setFirstPin(entry);
        setEntry("");
        setStep("confirm");
        return;
      }
      // confirm
      if (entry.length !== PIN_LENGTH) return;
      if (entry !== firstPin) {
        setStep("create");
        setFirstPin("");
        fail("PINs didn't match. Start again.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await dispatch(setTransactionPin(entry));
        if (!setTransactionPin.fulfilled.match(res)) {
          // Setting the PIN itself failed: stay in setup, start over.
          setStep("create");
          setFirstPin("");
          fail(res.payload || "Couldn't set your PIN. Please try again.");
          return;
        }
      } catch (err) {
        setStep("create");
        setFirstPin("");
        fail(err?.message || "Couldn't set your PIN. Please try again.");
        return;
      } finally {
        setSubmitting(false);
      }
      // PIN is now set. Move to the verify stage so any retry uses it, then run.
      await finishWithPin(entry);
      return;
    }

    // ----- RESET: password -> create -> confirm -> reset -> run -----
    if (stage === "reset") {
      if (step === "password") {
        if (!password.trim()) {
          setError("Enter your account password.");
          return;
        }
        setStep("create");
        return;
      }
      if (step === "create") {
        if (entry.length !== PIN_LENGTH) return;
        setFirstPin(entry);
        setEntry("");
        setStep("confirm");
        return;
      }
      // confirm
      if (entry.length !== PIN_LENGTH) return;
      if (entry !== firstPin) {
        setStep("create");
        setFirstPin("");
        fail("PINs didn't match. Start again.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await dispatch(resetTransactionPin({ password, pin: entry }));
        if (!resetTransactionPin.fulfilled.match(res)) {
          // Most common cause: wrong password. Bounce back to the password step.
          setStep("password");
          setFirstPin("");
          fail(res.payload || "Couldn't reset your PIN. Check your password and try again.");
          return;
        }
      } catch (err) {
        setStep("password");
        setFirstPin("");
        fail(err?.message || "Couldn't reset your PIN. Please try again.");
        return;
      } finally {
        setSubmitting(false);
      }
      // PIN is now reset. Move to verify stage, clear password, then run.
      setPassword("");
      await finishWithPin(entry);
    }
  };

  // ── Keypad ──────────────────────────────────────────────────
  const onPasswordStep = stage === "reset" && step === "password";
  const keypadDisabled = submitting || onPasswordStep;

  const handleKeyPress = (key) => {
    if (keypadDisabled) return;
    if (key === "backspace") {
      setEntry((prev) => prev.slice(0, -1));
      setError("");
    } else if (entry.length < PIN_LENGTH) {
      setEntry((prev) => prev + key);
      setError("");
    }
  };

  const canConfirm = onPasswordStep ? password.trim().length > 0 : entry.length === PIN_LENGTH;

  const renderCells = () => (
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 8 }}>
      {Array.from({ length: PIN_LENGTH }).map((_, index) => {
        const filled = index < entry.length;
        return (
          <View
            key={index}
            style={{
              width: reveal ? 34 : 16,
              height: reveal ? 44 : 16,
              borderRadius: reveal ? 10 : 8,
              borderWidth: reveal ? 1.5 : 2,
              marginHorizontal: 7,
              alignItems: "center",
              justifyContent: "center",
              borderColor: error ? tokens.status.error : filled ? tokens.brand.default : tokens.border.default,
              backgroundColor: filled && !reveal ? tokens.brand.soft : "transparent",
            }}
          >
            {reveal ? (
              <Text style={{ fontSize: 22, fontWeight: "800", color: tokens.text.primary }}>
                {filled ? entry[index] : ""}
              </Text>
            ) : filled ? (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.brand.default }} />
            ) : null}
          </View>
        );
      })}
    </View>
  );

  const renderKeypad = () => {
    const keys = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["blank", "0", "backspace"]];
    return (
      <View style={{ marginBottom: 8 }}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            {row.map((key) => {
              if (key === "blank") return <View key="blank" style={{ width: 80, height: 56 }} />;
              const disabled = keypadDisabled;
              return (
                <TouchableOpacity
                  key={key}
                  style={{
                    width: 80, height: 56, borderRadius: 12,
                    backgroundColor: disabled ? tokens.bg.surfaceMuted : tokens.bg.surface,
                    alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1,
                  }}
                  onPress={() => handleKeyPress(key)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={key === "backspace" ? "Delete" : `Digit ${key}`}
                >
                  {key === "backspace" ? (
                    <Ionicons name="backspace-outline" size={24} color={tokens.text.primary} />
                  ) : (
                    <Text style={{ fontSize: 24, fontWeight: "600", color: tokens.text.primary }}>{key}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const goBackInline = () => {
    // Step back one stage/step toward the verify screen.
    setError("");
    setEntry("");
    setFirstPin("");
    if (stage === "setup") {
      if (step === "confirm") { setStep("create"); return; }
      setStage("enter"); setStep("create"); // create -> verify
      return;
    }
    if (stage === "reset") {
      if (step === "confirm") { setStep("create"); return; }
      if (step === "create") { setStep("password"); return; }
      setStage("enter"); setStep("create"); setPassword(""); // password -> verify
      return;
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <TouchableOpacity
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tokens.overlay.scrim }}
          onPress={submitting ? undefined : onClose}
          activeOpacity={1}
        />

        <Animated.View
          style={{
            backgroundColor: tokens.bg.surface,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 24, paddingBottom: 28,
            maxHeight: height * 0.9,
            transform: [{ translateY: slideAnimation }],
          }}
        >
          {/* Handle */}
          <View style={{ width: 40, height: 4, backgroundColor: tokens.border.default, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 14 }} />

          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 18, position: "relative" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: 6, color: tokens.text.primary, textAlign: "center" }}>{copy.heading}</Text>
            <Text style={{ fontSize: 13.5, textAlign: "center", color: tokens.text.muted, lineHeight: 19 }}>{copy.sub}</Text>
            <TouchableOpacity style={{ position: "absolute", right: 0, top: 0, padding: 4 }} onPress={onClose} disabled={submitting}>
              <Ionicons name="close" size={24} color={tokens.text.muted} />
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? (
            <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
              <View style={{ flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, marginBottom: 14, backgroundColor: tokens.status.errorSoft }}>
                <Ionicons name="alert-circle" size={16} color={tokens.status.error} />
                <Text style={{ marginLeft: 8, fontSize: 12.5, fontWeight: "500", flex: 1, color: tokens.status.error }}>{error}</Text>
              </View>
            </Animated.View>
          ) : null}

          {/* Password field (reset stage, password step) */}
          {onPasswordStep ? (
            <View style={{ marginBottom: 20 }}>
              <View
                style={{
                  flexDirection: "row", alignItems: "center",
                  borderWidth: 1.5, borderColor: error ? tokens.status.error : tokens.border.default,
                  borderRadius: 14, paddingHorizontal: 14, backgroundColor: tokens.bg.canvas,
                }}
              >
                <Ionicons name="lock-closed-outline" size={18} color={tokens.text.muted} />
                <TextInput
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(""); }}
                  placeholder="Account password"
                  placeholderTextColor={tokens.text.placeholder}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onSubmitEditing={handleConfirm}
                  returnKeyType="next"
                  style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 15, color: tokens.text.primary }}
                  accessibilityLabel="Account password"
                />
                <TouchableOpacity onPress={() => setShowPassword((s) => !s)} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={tokens.text.muted} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* PIN cells + reveal toggle */}
              <Animated.View style={{ transform: [{ translateX: shakeAnimation }], flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                {renderCells()}
                <TouchableOpacity
                  onPress={() => setReveal((r) => !r)}
                  style={{ marginLeft: 6, padding: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={reveal ? "Hide PIN" : "Show PIN"}
                >
                  <Ionicons name={reveal ? "eye-off-outline" : "eye-outline"} size={22} color={tokens.text.muted} />
                </TouchableOpacity>
              </Animated.View>

              {renderKeypad()}
            </>
          )}

          {/* Confirm */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!canConfirm || submitting}
            style={{
              backgroundColor: !canConfirm || submitting ? tokens.bg.surfaceMuted : tokens.brand.default,
              paddingVertical: 15, borderRadius: 14, alignItems: "center", marginTop: 4,
            }}
            accessibilityRole="button"
            accessibilityLabel="Confirm"
          >
            <Text style={{ color: !canConfirm || submitting ? tokens.text.muted : tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
              {submitting ? "Please wait..." : "Confirm"}
            </Text>
          </TouchableOpacity>

          {/* Secondary action: Forgot (enter) / Back (setup,reset) */}
          {stage === "enter" ? (
            <TouchableOpacity style={{ alignItems: "center", paddingVertical: 14 }} onPress={() => { setStage("reset"); setStep("password"); setEntry(""); setError(""); }} disabled={submitting}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.brand.strong }}>Forgot PIN?</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={{ alignItems: "center", paddingVertical: 14 }} onPress={goBackInline} disabled={submitting}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: tokens.text.muted }}>Back</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
        <InModalToast />
      </View>
    </Modal>
  );
}
