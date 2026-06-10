import React, { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

const PIN_LENGTH = 6;

/**
 * Shared PIN entry field for the full-screen Set/Change PIN flows. Matches the
 * PinBottomSheet UX: hidden by default with a show/hide eye toggle, and NO
 * auto-submit (the screen owns an explicit Confirm button). Uses the device
 * numeric keyboard via an off-screen input; tap the row to refocus if it hides.
 *
 * Pass `key={step}` from a multi-step screen so it remounts per step (refocus +
 * reveal resets).
 */
export default function PinField({ value, onChangeText, autoFocus = true, error = false }) {
  const { tokens } = useTheme();
  const [reveal, setReveal] = useState(false);
  const inputRef = useRef(null);

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={{ flexDirection: "row" }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < value.length;
            return (
              <View
                key={i}
                style={{
                  width: reveal ? 32 : 18,
                  height: reveal ? 42 : 18,
                  borderRadius: reveal ? 10 : 9,
                  borderWidth: reveal ? 1.5 : 0,
                  borderColor: error ? tokens.status.error : tokens.brand.default,
                  marginHorizontal: 7,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: reveal ? "transparent" : filled ? tokens.brand.default : tokens.border.default,
                }}
              >
                {reveal ? (
                  <Text style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary }}>
                    {filled ? value[i] : ""}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setReveal((r) => !r)}
          style={{ marginLeft: 10, padding: 6 }}
          accessibilityRole="button"
          accessibilityLabel={reveal ? "Hide PIN" : "Show PIN"}
        >
          <Ionicons name={reveal ? "eye-off-outline" : "eye-outline"} size={22} color={tokens.text.muted} />
        </TouchableOpacity>
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, PIN_LENGTH))}
        keyboardType="number-pad"
        maxLength={PIN_LENGTH}
        autoFocus={autoFocus}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
      />

      <TouchableOpacity onPress={() => inputRef.current?.focus()} style={{ paddingVertical: 12, paddingHorizontal: 24, marginTop: 6 }}>
        <Text style={{ fontSize: 13, color: tokens.text.muted, fontWeight: "600" }}>Tap here if keyboard hides</Text>
      </TouchableOpacity>
    </View>
  );
}
