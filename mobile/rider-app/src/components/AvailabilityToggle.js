import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { AVAILABILITY } from "../lib/constants";

/**
 * Large pill toggle for ONLINE/OFFLINE/ON_DELIVERY.
 *
 * Props:
 *   - availability: current availability string
 *   - busy: thunk in-flight
 *   - onPress: () => void  (parent decides goOnline vs goOffline)
 *   - disabled: optional hard-disable (e.g. permission denied)
 */
export default function AvailabilityToggle({ availability, busy, onPress, disabled }) {
  const { tokens } = useTheme();
  const isOnline = availability === AVAILABILITY.ONLINE || availability === AVAILABILITY.ON_DELIVERY;
  const isOnDelivery = availability === AVAILABILITY.ON_DELIVERY;

  const bg = isOnline ? tokens.brand.soft : tokens.bg.surfaceMuted;
  const border = isOnline ? tokens.brand.softBorder : tokens.border.default;
  const dot = isOnline ? tokens.status.success : tokens.text.muted;

  const label = isOnDelivery
    ? "On delivery"
    : isOnline
      ? "You're online"
      : "You're offline";

  const cta = isOnline ? "Tap to go offline" : "Tap to go online";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy || disabled || isOnDelivery}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy || disabled }}
      activeOpacity={0.85}
      style={{
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: dot,
          marginRight: 14,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: tokens.text.primary,
            letterSpacing: -0.3,
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 2 }}>
          {isOnDelivery ? "Stay on this delivery — toggle disabled" : cta}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator color={tokens.brand.default} />
      ) : (
        <Ionicons
          name={isOnline ? "radio-button-on" : "radio-button-off"}
          size={28}
          color={isOnline ? tokens.brand.default : tokens.text.muted}
        />
      )}
    </TouchableOpacity>
  );
}
