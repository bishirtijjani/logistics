import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { clearError } from "../store/slices/authSlice";
import { colors } from "../theme";

export default function AuthErrorBanner() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const error = useSelector((state) => state.auth.error);

  if (!error) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#FEF2F2",
        borderColor: colors.error,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
      }}
    >
      <Ionicons
        name="alert-circle"
        size={18}
        color={colors.error}
        style={{ marginRight: 8, marginTop: 1 }}
      />
      <Text
        style={{
          flex: 1,
          color: colors.errorStrong,
          fontSize: 13,
          fontWeight: "500",
          lineHeight: 18,
        }}
      >
        {error}
      </Text>
      <TouchableOpacity
        onPress={() => dispatch(clearError())}
        style={{ marginLeft: 8, padding: 2 }}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.close")}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}
