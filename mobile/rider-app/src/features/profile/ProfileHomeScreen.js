/**
 * Phase 0 placeholder. Real profile + sub-screens land in Phase 7.
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useDispatch } from "react-redux";
import { useTheme } from "../../theme";
import { logout } from "../../store/slices/authSlice";

export default function ProfileHomeScreen() {
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: tokens.bg.canvas }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: tokens.text.primary, marginBottom: 8 }}>
        Me
      </Text>
      <Text style={{ color: tokens.text.muted, textAlign: "center", marginBottom: 24 }}>
        Lands in Phase 7.
      </Text>
      <TouchableOpacity
        onPress={() => dispatch(logout())}
        style={{
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: tokens.status.errorSoft,
          borderWidth: 1,
          borderColor: tokens.status.errorSoftBorder,
        }}
      >
        <Text style={{ color: tokens.status.errorStrong, fontWeight: "600" }}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}
