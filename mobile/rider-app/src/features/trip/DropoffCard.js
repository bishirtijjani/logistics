import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";

const money = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

/**
 * Dropoff card — shown while status ∈ {PICKED_UP, IN_TRANSIT, DELIVERED}.
 * Shows where the package is heading + how to contact the recipient.
 */
export default function DropoffCard({
  dropoff,
  earning,
  distanceKm,
  estimatedMinutes,
  onOpenInMaps,
  onContactRow,
  onWrongAddress,
}) {
  const { tokens } = useTheme();
  const { t } = useT();
  if (!dropoff) return null;

  return (
    <View
      style={{
        backgroundColor: tokens.bg.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.border.default,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <View
            style={{
              width: 24, height: 24, borderRadius: 12,
              alignItems: "center", justifyContent: "center",
              backgroundColor: "#D1FAE5",
              borderWidth: 1, borderColor: "#A7F3D0",
              marginRight: 8,
            }}
          >
            <Ionicons name="home-outline" size={14} color="#059669" />
          </View>
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, letterSpacing: 0.5 }}>
            {t("trip.dropoff.label", "DROPOFF")}
          </Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: "700", color: tokens.text.primary }} numberOfLines={2}>
          {dropoff.name || dropoff.contactName || t("trip.dropoff.fallback", "Dropoff location")}
        </Text>
        <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 4 }} numberOfLines={3}>
          {dropoff.address || "—"}
        </Text>
        {dropoff.notes ? (
          <Text style={{ fontSize: 12, fontStyle: "italic", color: tokens.text.muted, marginTop: 6 }} numberOfLines={3}>
            “{dropoff.notes}”
          </Text>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.subtle,
          gap: 16,
        }}
      >
        {distanceKm != null ? (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: tokens.text.muted }}>{t("trip.stat.distance", "Distance")}</Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
              {Number(distanceKm).toFixed(1)} km
            </Text>
          </View>
        ) : null}
        {estimatedMinutes != null ? (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: tokens.text.muted }}>{t("trip.stat.est", "Est.")}</Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
              {estimatedMinutes} min
            </Text>
          </View>
        ) : null}
        {earning != null ? (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: tokens.text.muted }}>{t("trip.stat.youEarn", "You earn")}</Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#059669" }}>
              {money(earning)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", padding: 10, gap: 8 }}>
        <TouchableOpacity
          onPress={onOpenInMaps}
          accessibilityRole="button"
          accessibilityLabel={t("trip.cta.mapsDropoffAria", "Open dropoff in Maps")}
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 10,
            backgroundColor: tokens.brand.soft, borderWidth: 1, borderColor: tokens.brand.softBorder,
            alignItems: "center", justifyContent: "center", flexDirection: "row",
          }}
        >
          <Ionicons name="map-outline" size={16} color={tokens.brand.strong} />
          <Text style={{ marginLeft: 6, fontWeight: "700", color: tokens.brand.strong, fontSize: 13 }}>
            {t("trip.cta.maps", "Maps")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onContactRow}
          accessibilityRole="button"
          accessibilityLabel={t("trip.cta.contactDropoffAria", "Contact customer or recipient")}
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 10,
            backgroundColor: tokens.bg.surfaceMuted, borderWidth: 1, borderColor: tokens.border.default,
            alignItems: "center", justifyContent: "center", flexDirection: "row",
          }}
        >
          <Ionicons name="call-outline" size={16} color={tokens.text.primary} />
          <Text style={{ marginLeft: 6, fontWeight: "700", color: tokens.text.primary, fontSize: 13 }}>
            {t("trip.cta.contact", "Contact")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onWrongAddress}
          accessibilityRole="button"
          accessibilityLabel={t("trip.dropoff.wrongAria", "Wrong dropoff address")}
          style={{
            paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
            backgroundColor: tokens.bg.surfaceMuted, borderWidth: 1, borderColor: tokens.border.default,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="warning-outline" size={16} color={tokens.text.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
