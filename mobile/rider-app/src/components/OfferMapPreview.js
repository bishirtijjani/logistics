import React, { useMemo } from "react";
import { View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

/**
 * Non-interactive map preview for the job offer sheet.
 *
 * Shows pickup + dropoff markers connected by a straight line. The real
 * encoded polyline arrives later via `GET /requests/:id/route` once the
 * rider accepts (TripCockpit fetches it in Phase 4).
 *
 * Auto-fits to enclose both points with comfortable padding.
 */
export default function OfferMapPreview({ pickupLat, pickupLng, dropoffLat, dropoffLng, height = 180 }) {
  const { tokens } = useTheme();

  const region = useMemo(() => {
    if (typeof pickupLat !== "number" || typeof pickupLng !== "number") return null;
    if (typeof dropoffLat !== "number" || typeof dropoffLng !== "number") {
      // Drop-off coords missing - centre on pickup only.
      return {
        latitude: pickupLat,
        longitude: pickupLng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    const midLat = (pickupLat + dropoffLat) / 2;
    const midLng = (pickupLng + dropoffLng) / 2;
    const latDelta = Math.max(0.01, Math.abs(pickupLat - dropoffLat) * 1.6 + 0.005);
    const lngDelta = Math.max(0.01, Math.abs(pickupLng - dropoffLng) * 1.6 + 0.005);
    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  if (!region) {
    return (
      <View
        style={{
          height,
          borderRadius: 14,
          backgroundColor: tokens.bg.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="map-outline" size={28} color={tokens.text.muted} />
      </View>
    );
  }

  const hasDropoff =
    typeof dropoffLat === "number" && typeof dropoffLng === "number";

  return (
    <View style={{ height, borderRadius: 14, overflow: "hidden" }}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        pointerEvents="none"
      >
        <Marker
          coordinate={{ latitude: pickupLat, longitude: pickupLng }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: tokens.brand.default,
              borderWidth: 3,
              borderColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="storefront" size={14} color="#fff" />
          </View>
        </Marker>

        {hasDropoff ? (
          <Marker
            coordinate={{ latitude: dropoffLat, longitude: dropoffLng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: tokens.status.success,
                borderWidth: 3,
                borderColor: "#fff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="flag" size={14} color="#fff" />
            </View>
          </Marker>
        ) : null}

        {hasDropoff ? (
          <Polyline
            coordinates={[
              { latitude: pickupLat, longitude: pickupLng },
              { latitude: dropoffLat, longitude: dropoffLng },
            ]}
            strokeColor={tokens.brand.default}
            strokeWidth={3}
            lineDashPattern={[6, 4]}
          />
        ) : null}
      </MapView>
    </View>
  );
}
