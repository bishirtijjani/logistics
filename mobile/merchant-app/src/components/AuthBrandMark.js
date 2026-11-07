import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

// Brand identity shown atop the auth screens (login / register).
export default function AuthBrandMark({ style }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", marginBottom: 28 },
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Logistics Platform Merchant"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: tokens.brand.default,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        <Ionicons name="storefront" size={24} color={tokens.text.onBrand} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "900",
          color: tokens.text.primary,
          letterSpacing: -0.5,
        }}
      >
        Logistics Platform
      </Text>
      <View
        style={{
          marginLeft: 8,
          backgroundColor: tokens.brand.default + "1A",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: tokens.brand.strong,
            letterSpacing: 0.5,
          }}
        >
          MERCHANT
        </Text>
      </View>
    </View>
  );
}
