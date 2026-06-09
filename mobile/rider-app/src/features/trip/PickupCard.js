import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";

const money = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

/**
 * Pickup card - shown while status ∈ {RIDER_ASSIGNED, RIDER_EN_ROUTE}.
 * Shows the pickup location, contact + items (for MERCHANT_ORDER) or
 * package details (for PACKAGE), and lets the rider open external maps
 * or contact the merchant / sender.
 */
export default function PickupCard({
  pickup,
  items,
  packageDetails,
  type,
  earning,
  distanceKm,
  estimatedMinutes,
  onOpenInMaps,
  onContactRow,
  onWrongAddress,
}) {
  const { tokens } = useTheme();
  const { t } = useT();
  if (!pickup) return null;

  const lineCount = Array.isArray(items)
    ? items.reduce((acc, it) => acc + (it?.quantity || 0), 0)
    : 0;

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
              backgroundColor: tokens.brand.soft,
              borderWidth: 1, borderColor: tokens.brand.softBorder,
              marginRight: 8,
            }}
          >
            <Ionicons name="storefront-outline" size={14} color={tokens.brand.strong} />
          </View>
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, letterSpacing: 0.5 }}>
            {t("trip.pickup.label", "PICKUP")}
          </Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: "700", color: tokens.text.primary }} numberOfLines={2}>
          {pickup.name || pickup.contactName || t("trip.pickup.fallback", "Pickup location")}
        </Text>
        <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 4 }} numberOfLines={3}>
          {pickup.address || "-"}
        </Text>
        {pickup.notes ? (
          <Text style={{ fontSize: 12, fontStyle: "italic", color: tokens.text.muted, marginTop: 6 }} numberOfLines={3}>
            “{pickup.notes}”
          </Text>
        ) : null}
      </View>

      {/* Items list - only for MERCHANT_ORDER. */}
      {type === "MERCHANT_ORDER" && lineCount > 0 ? (
        <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 8, letterSpacing: 0.5 }}>
            {t("trip.pickup.items", "ITEMS")} ({lineCount})
          </Text>
          {items.map((it) => (
            <View key={it.id || `${it.productId}-${it.variantId}`} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Text style={{ fontSize: 13, color: tokens.text.primary, fontWeight: "600" }}>
                {it.quantity}× {" "}
              </Text>
              <Text style={{ fontSize: 13, color: tokens.text.primary, flex: 1 }} numberOfLines={2}>
                {it.name}
                {it.specialInstructions ? ` - ${it.specialInstructions}` : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Package details - only for PACKAGE. */}
      {type === "PACKAGE" && packageDetails ? (
        <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6, letterSpacing: 0.5 }}>
            {t("trip.pickup.package", "PACKAGE")}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.text.primary, fontWeight: "600" }}>
            {packageDetails.size}{packageDetails.fragile ? " · Fragile" : ""}
          </Text>
          {packageDetails.description ? (
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 2 }} numberOfLines={3}>
              {packageDetails.description}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Distance + earning summary */}
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
            <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.status.successStrong }}>
              {money(earning)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action row: Open in Maps + Contact + Wrong address */}
      <View style={{ flexDirection: "row", padding: 10, gap: 8 }}>
        <TouchableOpacity
          onPress={onOpenInMaps}
          accessibilityRole="button"
          accessibilityLabel={t("trip.cta.mapsAria", "Open in Maps")}
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
          accessibilityLabel={t("trip.cta.contactPickupAria", "Contact merchant or sender")}
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
          accessibilityLabel={t("trip.pickup.wrongAria", "Wrong pickup address")}
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
