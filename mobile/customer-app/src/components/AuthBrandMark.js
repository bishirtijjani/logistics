import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

// Brand identity shown atop the auth screens (login / register).
export default function AuthBrandMark({ style }) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", marginBottom: 28 },
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="iPrime"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        <Ionicons name="bag-handle" size={24} color={colors.white} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "900",
          color: colors.text,
          letterSpacing: -0.5,
        }}
      >
        iPrime
      </Text>
    </View>
  );
}
