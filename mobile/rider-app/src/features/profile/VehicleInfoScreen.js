/**
 * VehicleInfoScreen - read-only summary of the rider's approved vehicle.
 * Changes require admin re-approval, so the "Request change" CTA files a
 * pre-filled support ticket of type VEHICLE_CHANGE that admins can action.
 */

import React from "react";
import { goBackOr } from "../../lib/goBack";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { useTheme } from "../../theme";

export default function VehicleInfoScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const rider = useSelector((s) => s.rider?.rider);

  const rows = [
    { label: t("vehicleInfo.type", "Type"), value: rider?.vehicleType || "-" },
    { label: t("vehicleInfo.plate", "Plate number"), value: rider?.plateNumber || "-" },
    { label: t("vehicleInfo.color", "Colour"), value: rider?.vehicleColor || "-" },
  ];

  const requestChange = () => {
    navigation.navigate("CreateTicket", {
      subject: t("vehicleInfo.changeSubject", "Vehicle change request"),
      category: "ACCOUNT",
      description: [
        t("vehicleInfo.changeBodyPrefix", "I'd like to update my registered vehicle."),
        "",
        `Current: ${rider?.vehicleType || "-"} · ${rider?.plateNumber || "-"} · ${rider?.vehicleColor || "-"}`,
        "",
        t("vehicleInfo.changeBodyHint", "Please tell me what proof of ownership / insurance you need for the new vehicle."),
      ].join("\n"),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("vehicleInfo.title", "Vehicle details")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderRadius: 16,
            padding: 18, marginBottom: 16,
            alignItems: "center",
            borderWidth: 1, borderColor: tokens.border.default,
          }}
        >
          <View
            style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: tokens.brand.soft,
              alignItems: "center", justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Ionicons name="bicycle-outline" size={32} color={tokens.brand.default} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary }}>
            {rider?.vehicleType || "-"}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 2 }}>
            {rider?.plateNumber || "-"}
          </Text>
        </View>

        {rows.map((row, i) => (
          <View
            key={row.label}
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
              marginBottom: 10,
              flexDirection: "row", justifyContent: "space-between",
              borderWidth: 1, borderColor: tokens.border.default,
            }}
          >
            <Text style={{ fontSize: 13, color: tokens.text.muted }}>{row.label}</Text>
            <Text style={{ fontSize: 13, color: tokens.text.primary, fontWeight: "700" }}>
              {row.value}
            </Text>
          </View>
        ))}

        <View
          style={{
            backgroundColor: tokens.status.infoSoft,
            borderRadius: 12, padding: 12, marginTop: 12,
            borderWidth: 1, borderColor: tokens.status.infoSoftBorder,
          }}
        >
          <Text style={{ fontSize: 12, color: tokens.text.primary, lineHeight: 18 }}>
            {t("vehicleInfo.lockedNote", "Vehicle details are locked once your account is approved. Tap below to request a change.")}
          </Text>
        </View>

        <TouchableOpacity
          onPress={requestChange}
          accessibilityRole="button"
          style={{
            marginTop: 16,
            paddingVertical: 14, borderRadius: 12,
            backgroundColor: tokens.brand.default,
            alignItems: "center",
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
            {t("vehicleInfo.requestChange", "Request a change")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
