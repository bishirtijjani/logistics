import React from "react";
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export default function SocialAuthButton({
  onPress,
  iconName,
  text,
  isLoading,
  color = "#DB4437",
}) {
  return (
    <TouchableOpacity
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.border,
        marginTop: 12,
      }}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <Ionicons
            name={iconName}
            size={20}
            color={color}
            style={{ marginRight: 10 }}
          />
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>
            Continue with {text}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
