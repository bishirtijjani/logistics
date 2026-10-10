import React, { useEffect, useState, useCallback } from "react";
import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { useTheme } from "../theme";
import { _registerAlertHost } from "../lib/safeAlert";

/**
 * Renders themed alerts pushed via safeAlert.showAlert (which, on web, backs the
 * monkeypatched Alert.alert). Mount once near the app root, inside ThemeProvider.
 * On native the OS Alert is used instead, so this simply never shows - harmless
 * to mount on every platform.
 */
export default function AlertHost() {
  const { tokens } = useTheme();
  const [alert, setAlert] = useState(null);

  useEffect(() => _registerAlertHost(setAlert), []);

  const dismiss = useCallback((btn) => {
    setAlert(null);
    try { btn?.onPress?.(); } catch (_) {}
  }, []);

  if (!alert) return null;
  const { title, message } = alert;
  const buttons = alert.buttons && alert.buttons.length ? alert.buttons : [{ text: "OK" }];

  const onBackdrop = () => {
    if (buttons.length === 1) return dismiss(buttons[0]);
    const cancel = buttons.find((b) => b.style === "cancel");
    if (cancel) dismiss(cancel); // otherwise require an explicit choice
  };

  const colorFor = (style) =>
    style === "destructive"
      ? tokens.status.errorStrong
      : style === "cancel"
      ? tokens.text.muted
      : tokens.brand.default;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onBackdrop}>
      <Pressable
        onPress={onBackdrop}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {/* Inner Pressable swallows taps so they don't fall through to the backdrop. */}
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 360,
            borderRadius: 16,
            backgroundColor: tokens.bg.surface,
            overflow: "hidden",
          }}
        >
          <View style={{ padding: 20 }}>
            {title ? (
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "800",
                  color: tokens.text.primary,
                  marginBottom: message ? 8 : 0,
                }}
              >
                {title}
              </Text>
            ) : null}
            {message ? (
              <Text style={{ fontSize: 14, lineHeight: 20, color: tokens.text.muted }}>
                {message}
              </Text>
            ) : null}
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: tokens.border.default }}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={`${btn.text}-${i}`}
                onPress={() => dismiss(btn)}
                accessibilityRole="button"
                style={{
                  paddingVertical: 14,
                  alignItems: "center",
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: tokens.border.default,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: btn.style === "cancel" ? "600" : "700",
                    color: colorFor(btn.style),
                  }}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
