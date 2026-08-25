import React, { useState, useEffect, useRef, useCallback } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Keyboard,
  FlatList,
  ActivityIndicator,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE, Marker, Polygon } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ExpoLocation from "expo-location";
import api from "../../services/api";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { GEO_RESTRICTION, clampToBounds, isOutOfBounds } from "../../config/geoRestriction";

const KATSINA = GEO_RESTRICTION.center;
const DELTA = { latitudeDelta: 0.012, longitudeDelta: 0.012 };
// Above this map span we stop fetching/rendering admin custom-place labels -
// at town/state scale they'd just be clutter.
const PLACE_LABEL_MAX_SPAN = 0.08;

/**
 * Map-based location picker - ported from the customer app so the rider
 * onboarding "Home address" field works exactly like the customer's pickup/
 * drop-off picker (drag-the-pin + search autocomplete + GPS recenter).
 *
 * Contract: the caller passes `route.params.onSelect`, invoked with
 * `{ latitude, longitude, address }` on confirm. No redux dependency - the
 * rider app has no location slice, so onSelect is the only sink.
 *
 * Note: the `api` interceptor returns the response body, which is the backend
 * success envelope `{ success, data, meta }`. So every call unwraps the inner
 * payload with `const { data } = await api.get(...)`, exactly like the
 * customer app.
 */
export default function LocationPickerScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const initial = route.params?.initial || null;

  const mapRef = useRef(null);
  const searchTimeout = useRef(null);
  const geocodeTimeout = useRef(null);
  const sessionToken = useRef(`${Date.now()}-${Math.random()}`);

  const [region, setRegion] = useState(() => {
    // Start on the passed-in point, but fall back to the operating-area centre
    // if it's missing or (with the restriction on) sits outside the area.
    const start = initial?.latitude
      ? { latitude: initial.latitude, longitude: initial.longitude }
      : null;
    const base = start && !isOutOfBounds(start) ? start : KATSINA;
    return { ...base, ...DELTA };
  });
  const [address, setAddress] = useState(initial?.address || "");
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  // Admin-curated places (custom_places) shown as labelled markers on the map.
  const [customPlaces, setCustomPlaces] = useState([]);
  const placesTimeout = useRef(null);
  const placesSeq = useRef(0);
  // Show the out-of-area notice at most once per few seconds so panning around
  // the border doesn't spam toasts.
  const lastAreaToast = useRef(0);
  const notifyOutOfArea = useCallback(() => {
    const now = Date.now();
    if (now - lastAreaToast.current < 3000) return;
    lastAreaToast.current = now;
    Toast.show({
      type: "info",
      text1: t("locationPicker.outOfArea", `We only operate in ${GEO_RESTRICTION.label} for now`),
    });
  }, [t]);

  // Fetch admin-curated places inside the current viewport (debounced) and
  // render them as labelled markers. Skipped at wide zoom to avoid clutter.
  const fetchCustomPlaces = useCallback((reg) => {
    const latSpan = reg.latitudeDelta ?? DELTA.latitudeDelta;
    const lngSpan = reg.longitudeDelta ?? DELTA.longitudeDelta;
    if (Math.max(latSpan, lngSpan) > PLACE_LABEL_MAX_SPAN) {
      setCustomPlaces([]);
      return;
    }
    if (placesTimeout.current) clearTimeout(placesTimeout.current);
    placesTimeout.current = setTimeout(async () => {
      const seq = ++placesSeq.current;
      const half = Math.max(latSpan, lngSpan) / 2;
      try {
        const { data } = await api.get("/maps/custom-places", {
          params: {
            north: reg.latitude + half,
            south: reg.latitude - half,
            east: reg.longitude + half,
            west: reg.longitude - half,
          },
        });
        if (seq === placesSeq.current) setCustomPlaces(data || []);
      } catch {
        // Ignore - labels are a nicety, not a blocker.
      }
    }, 450);
  }, []);

  // Reverse geocode the map center when user stops dragging (debounced)
  const handleRegionChangeComplete = useCallback(
    (raw) => {
      // Keep the map centre inside the operating area: snap back if the user
      // pans out. No-op when the restriction is disabled (config/geoRestriction).
      const clamped = clampToBounds(raw);
      const corrected =
        clamped.latitude !== raw.latitude || clamped.longitude !== raw.longitude;
      const newRegion = corrected ? { ...raw, ...clamped } : raw;
      setRegion(newRegion);
      if (corrected) {
        // User panned outside Katsina - snap back and let them know.
        mapRef.current?.animateToRegion(newRegion, 300);
        notifyOutOfArea();
      }
      fetchCustomPlaces(newRegion);
      if (showSearch) return; // Don't geocode while searching

      if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);

      setIsGeocoding(true);
      setAddress(""); // Clear temporarily to indicate change

      geocodeTimeout.current = setTimeout(async () => {
        try {
          const { data } = await api.get("/maps/reverse-geocode", {
            params: { lat: newRegion.latitude, lng: newRegion.longitude },
          });
          const formattedAddress = data?.formattedAddress;
          setAddress(formattedAddress || "Unknown location");
        } catch (err) {
          setAddress("Unable to determine address");
        } finally {
          setIsGeocoding(false);
        }
      }, 600);
    },
    [showSearch, notifyOutOfArea, fetchCustomPlaces],
  );

  // Autocomplete search
  const handleSearch = useCallback((text) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (text.length < 2) {
      setPredictions([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.get("/maps/autocomplete", {
          params: { query: text, sessionToken: sessionToken.current },
        });
        setPredictions(data || []);
      } catch (error) {
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Select a prediction
  const handleSelectPlace = useCallback(async (prediction) => {
    Keyboard.dismiss();
    setShowSearch(false);
    setQuery("");
    setPredictions([]);
    setIsGeocoding(true);

    try {
      const { data } = await api.get("/maps/place-details", {
        params: { placeId: prediction.placeId, sessionToken: sessionToken.current },
      });
      const place = data;
      sessionToken.current = `${Date.now()}-${Math.random()}`;

      // Search is biased, not strictly bounded - reject a result that resolves
      // outside the operating area instead of jumping the pin there.
      if (place?.outOfArea) {
        notifyOutOfArea();
        return;
      }

      const newRegion = { latitude: place.lat, longitude: place.lng, ...DELTA };
      setRegion(newRegion);
      setAddress(place.formattedAddress);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch {
      // Ignore
    } finally {
      setIsGeocoding(false);
    }
  }, [notifyOutOfArea]);

  // Cleanup pending timeouts on unmount so they don't fire on a stale component
  useEffect(() => {
    // Initial label fetch for the starting region.
    fetchCustomPlaces(region);
    return () => {
      if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (placesTimeout.current) clearTimeout(placesTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center on GPS
  const handleMyLocation = useCallback(async () => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const pos = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      // Clamp GPS into the operating area (no-op when restriction disabled).
      const newRegion = {
        ...clampToBounds({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        ...DELTA,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch {
      // Ignore
    }
  }, []);

  // Confirm selection
  const handleConfirm = useCallback(() => {
    const selected = { latitude: region.latitude, longitude: region.longitude, address };
    const onSelect = route.params?.onSelect;
    if (typeof onSelect === "function") onSelect(selected);
    goBackOr(navigation);
  }, [region, address, navigation, route.params]);

  return (
    <View style={{ flex: 1 }}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Operating-area boundary so the rider sees where service is available. */}
        {GEO_RESTRICTION.enabled && (
          <Polygon
            coordinates={GEO_RESTRICTION.polygonCoords}
            strokeColor={tokens.brand.default}
            strokeWidth={2}
            fillColor="rgba(234,88,12,0.06)"
          />
        )}
        {/* Admin-curated places as subtle labelled markers (native place-like). */}
        {customPlaces.map((p) => (
          <CustomPlaceMarker key={p.id} place={p} />
        ))}
      </MapView>

      {/* Animated tooltip above pin */}
      <View style={{ position: "absolute", top: "50%", left: "50%", marginLeft: -80, marginTop: -88, width: 160, alignItems: "center", zIndex: 10 }} pointerEvents="none">
        <Animated.View style={{ opacity: address ? 1 : 0, transform: [{ translateY: address ? 0 : -10 }] }}>
          <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, maxWidth: 160 }}>
            <View style={{ position: "absolute", bottom: -8, left: "50%", marginLeft: -8, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: tokens.bg.surface }} />
            <View style={{ alignItems: "center" }}>
              {isGeocoding ? (
                <ActivityIndicator size="small" color={tokens.brand.default} />
              ) : (
                <Text style={{ fontSize: 12, fontWeight: "600", textAlign: "center", color: tokens.text.primary, lineHeight: 16 }} numberOfLines={2} accessibilityLiveRegion="polite">
                  {address || t("locationPicker.movePin", "Move the pin to your location")}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Fixed center pin */}
      <View style={{ position: "absolute", top: "50%", left: "50%", marginLeft: -20, marginTop: -40, alignItems: "center", zIndex: 10 }} pointerEvents="none">
        <Ionicons name="location" size={40} color={tokens.brand.default} />
        <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 4, backgroundColor: "rgba(234,88,12,0.3)" }} />
      </View>

      {/* Top bar */}
      <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0 }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity
            onPress={() => goBackOr(navigation)}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back", "Go back")}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.bg.surface, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
          >
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 12, paddingHorizontal: 12, height: 44, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, marginLeft: 12 }}>
            <Ionicons name="search-outline" size={18} color={tokens.text.muted} />
            <TextInput
              style={{ flex: 1, fontSize: 16, marginLeft: 8, fontWeight: "500", color: tokens.text.primary }}
              placeholder={t("locationPicker.searchPh", "Search for a place")}
              accessibilityLabel={t("locationPicker.searchPh", "Search for a place")}
              placeholderTextColor={tokens.text.muted}
              value={query}
              onChangeText={handleSearch}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch("")} accessibilityRole="button" accessibilityLabel={t("locationPicker.clearSearchA11y", "Clear search")}>
                <Ionicons name="close-circle" size={18} color={tokens.text.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Search results */}
      {predictions.length > 0 && (
        <View style={{ position: "absolute", top: 112, left: 0, right: 0, zIndex: 100 }}>
          <View style={{ marginHorizontal: 16, backgroundColor: tokens.bg.surface, borderRadius: 12, maxHeight: 288, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4, zIndex: 100 }}>
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}
                  onPress={() => handleSelectPlace(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t("locationPicker.selectResultA11y", { name: item.mainText, defaultValue: `Select ${item.mainText}` })}
                >
                  <Ionicons name="location-outline" size={18} color={tokens.brand.strong} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>{item.mainText}</Text>
                    <Text style={{ fontSize: 12, marginTop: 2, color: tokens.text.muted }} numberOfLines={1}>
                      {item.secondaryText}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}
      {isSearching && (
        <View style={{ marginHorizontal: 16, backgroundColor: tokens.bg.surface, borderRadius: 12, zIndex: 100 }}>
          <ActivityIndicator size="small" color={tokens.brand.default} style={{ padding: 16 }} />
        </View>
      )}

      {/* GPS button */}
      <TouchableOpacity
        style={{ position: "absolute", right: 16, bottom: 176, width: 46, height: 46, borderRadius: 23, backgroundColor: tokens.bg.surface, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
        onPress={handleMyLocation}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t("locationPicker.useGpsA11y", "Use my current location")}
      >
        <Ionicons name="navigate" size={20} color={tokens.brand.default} />
      </TouchableOpacity>

      {/* Bottom card */}
      <SafeAreaView style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 8 }} edges={["bottom"]}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <Ionicons name="location" size={20} color={tokens.brand.default} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            {isGeocoding ? (
              <ActivityIndicator size="small" color={tokens.brand.default} />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: "600", color: tokens.text.primary, lineHeight: 20 }} numberOfLines={2} accessibilityLiveRegion="polite">
                {address || t("locationPicker.movePin", "Move the pin to your location")}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: tokens.brand.default, borderRadius: 12, paddingVertical: 16, alignItems: "center", opacity: !address ? 0.5 : 1 }}
          onPress={handleConfirm}
          disabled={!address || isGeocoding}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("locationPicker.confirmA11y", "Confirm location")}
          accessibilityState={{ disabled: !address || isGeocoding }}
        >
          <Text style={{ color: tokens.text.onBrand, fontSize: 16, fontWeight: "800" }}>{t("common.confirm", "Confirm")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// Admin-curated place label - a small neutral pill under a dot, styled to read
// like a native map POI label. Renders on native via react-native-maps Marker
// children and on web via the react-native-maps.web shim (OverlayView).
function CustomPlaceMarker({ place }) {
  return (
    <Marker
      coordinate={{ latitude: place.lat, longitude: place.lng }}
      title={place.name}
      zIndex={1}
    >
      <View
        style={{
          alignItems: 'center',
          transform: [{ translateY: -24 }],
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.94)',
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 2,
            maxWidth: 150,
          }}
        >
          <Text
            style={{ fontSize: 11, fontWeight: '600', color: '#52525B' }}
            numberOfLines={1}
          >
            {place.name}
          </Text>
        </View>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginTop: 2,
            backgroundColor: '#A1A1AA',
            borderWidth: 1,
            borderColor: '#FFFFFF',
          }}
        />
      </View>
    </Marker>
  );
}
