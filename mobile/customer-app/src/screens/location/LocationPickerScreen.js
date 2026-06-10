import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Keyboard,
  FlatList,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE, Polygon } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import * as ExpoLocation from "expo-location";
import api from "../../services/api";
import { useTheme } from "../../theme";
import {
  setLocation,
  detectCurrentLocation,
} from "../../store/slices/locationSlice";
import { GEO_RESTRICTION, clampToBounds, isOutOfBounds } from "../../config/geoRestriction";

const KATSINA = GEO_RESTRICTION.center;
const DELTA = { latitudeDelta: 0.012, longitudeDelta: 0.012 };

export default function LocationPickerScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const savedLocation = useSelector((state) => state.location);

  const mapRef = useRef(null);
  const searchTimeout = useRef(null);
  const geocodeTimeout = useRef(null);
  const sessionToken = useRef(`${Date.now()}-${Math.random()}`);

  const [region, setRegion] = useState(() => {
    // Start on the saved location, but fall back to the operating-area centre if
    // it's missing or (with the restriction on) sits outside the area.
    const saved = savedLocation.latitude
      ? { latitude: savedLocation.latitude, longitude: savedLocation.longitude }
      : null;
    const base = saved && !isOutOfBounds(saved) ? saved : KATSINA;
    return { ...base, ...DELTA };
  });
  const [address, setAddress] = useState(savedLocation.address || "");
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  // Set when a searched place resolves outside the operating area. Search is
  // only biased to Katsina, so a result can land outside; the backend flags it
  // with outOfArea and we refuse to move the pin there.
  const [areaError, setAreaError] = useState("");

  // Reverse geocode the map center when user stops dragging (debounced)
  const handleRegionChangeComplete = useCallback(
    (raw) => {
      // Keep the map centre inside the operating area: if the user pans out,
      // snap back to the nearest in-bounds point. No-op when the restriction
      // is disabled (config/geoRestriction.js).
      const clamped = clampToBounds(raw);
      const corrected =
        clamped.latitude !== raw.latitude || clamped.longitude !== raw.longitude;
      const newRegion = corrected ? { ...raw, ...clamped } : raw;
      setRegion(newRegion);
      if (corrected) mapRef.current?.animateToRegion(newRegion, 300);
      if (showSearch) return; // Don't geocode while searching

      // Clear any pending geocode
      if (geocodeTimeout.current) {
        clearTimeout(geocodeTimeout.current);
      }

      // Show loading state immediately
      setIsGeocoding(true);
      // Clear address temporarily to indicate change
      setAddress("");

      // Debounce the API call - wait 600ms after user stops dragging
      geocodeTimeout.current = setTimeout(async () => {
        try {
          const { data } = await api.get("/maps/reverse-geocode", {
            params: {
              lat: newRegion.latitude,
              lng: newRegion.longitude,
            },
          });
          console.log("Reverse geocode response:", JSON.stringify(data, null, 2));
          const formattedAddress = data.formattedAddress;
          if (formattedAddress) {
            setAddress(formattedAddress);
          } else {
            setAddress("Unknown location");
          }
        } catch (err) {
          console.error("Reverse geocode error:", err);
          setAddress("Unable to determine address");
        } finally {
          setIsGeocoding(false);
        }
      }, 600);
    },
    [showSearch],
  );

  // Autocomplete search
  const handleSearch = useCallback((text) => {
    setQuery(text);
    setAreaError("");
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
        console.log("Autocomplete response:", JSON.stringify(data, null, 2));
        setPredictions(data || []);
      } catch (error) {
        console.log("Autocomplete error:", error);
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
        params: {
          placeId: prediction.placeId,
          sessionToken: sessionToken.current,
        },
      });

      const place = data;
      sessionToken.current = `${Date.now()}-${Math.random()}`;

      // Search is biased, not strictly bounded - reject a result that resolves
      // outside the operating area instead of jumping the pin there.
      if (place?.outOfArea) {
        setAreaError(
          t("locationPicker.outOfArea", `We only operate in ${GEO_RESTRICTION.label} for now`),
        );
        return;
      }

      const newRegion = {
        latitude: place.lat,
        longitude: place.lng,
        ...DELTA,
      };
      setRegion(newRegion);
      setAddress(place.formattedAddress);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch {
      // Ignore
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // Cleanup pending timeouts on unmount so they don't fire on a stale component
  useEffect(() => {
    return () => {
      if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  // Re-center on GPS
  const handleMyLocation = useCallback(async () => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const pos = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      // Clamp GPS into the operating area so a user physically outside Katsina
      // still lands on a valid in-area point (no-op when restriction disabled).
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
    if (typeof onSelect === 'function') {
      onSelect(selected);
    } else {
      dispatch(setLocation(selected));
    }
    navigation.goBack();
  }, [dispatch, region, address, navigation, route.params]);

  return (
    <View style={{ flex: 1 }}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Operating-area boundary so the user sees where service is available. */}
        {GEO_RESTRICTION.enabled && (
          <Polygon
            coordinates={GEO_RESTRICTION.polygonCoords}
            strokeColor={tokens.brand.default}
            strokeWidth={2}
            fillColor="rgba(234,88,12,0.06)"
          />
        )}
      </MapView>

      {/* Animated tooltip above pin */}
      <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -80, marginTop: -88, width: 160, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
        <Animated.View
          style={{
            opacity: address ? 1 : 0,
            transform: [{ translateY: address ? 0 : -10 }],
          }}
        >
          <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, maxWidth: 160 }}>
            <View style={{ position: 'absolute', bottom: -8, left: '50%', marginLeft: -8, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: tokens.bg.surface }} />
            <View style={{ alignItems: 'center' }}>
              {isGeocoding ? (
                <ActivityIndicator size="small" color={tokens.brand.default} />
              ) : (
                <Text
                  style={{ fontSize: 12, fontWeight: '600', textAlign: 'center', color: tokens.text.primary, lineHeight: 16 }}
                  numberOfLines={2}
                  accessibilityLiveRegion="polite"
                >
                  {address || t("locationPicker.movePin")}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Fixed center pin */}
      <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
        <Ionicons name="location" size={40} color={tokens.brand.default} />
        <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 4, backgroundColor: "rgba(234,88,12,0.3)" }} />
      </View>

      {/* Top bar */}
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} edges={["top"]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.bg.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
          >
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.bg.surface, borderRadius: 12, paddingHorizontal: 12, height: 44, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, marginLeft: 12 }}>
            <Ionicons name="search-outline" size={18} color={tokens.text.muted} />
            <TextInput
              style={{ flex: 1, fontSize: 16, marginLeft: 8, fontWeight: '500', color: tokens.text.primary }}
              placeholder={t("locationPicker.searchPh")}
              accessibilityLabel={t("locationPicker.searchPh")}
              placeholderTextColor={tokens.text.muted}
              value={query}
              onChangeText={handleSearch}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearch("")}
                accessibilityRole="button"
                accessibilityLabel={t("locationPicker.clearSearchA11y")}
              >
                <Ionicons name="close-circle" size={18} color={tokens.text.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Out-of-area notice */}
      {areaError.length > 0 && (
        <View style={{ position: 'absolute', top: 112, left: 16, right: 16, zIndex: 100, backgroundColor: tokens.bg.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}>
          <Ionicons name="alert-circle" size={18} color={tokens.brand.default} style={{ marginRight: 8 }} />
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: tokens.text.primary }} accessibilityLiveRegion="polite">
            {areaError}
          </Text>
        </View>
      )}

      {/* Search results */}
      {predictions.length > 0 && (
        <View style={{ position: 'absolute', top: 112, left: 0, right: 0, zIndex: 100 }}>
          <View style={{ marginHorizontal: 16, backgroundColor: tokens.bg.surface, borderRadius: 12, maxHeight: 288, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4, zIndex: 100 }}>
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}
                  onPress={() => handleSelectPlace(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t("locationPicker.selectResultA11y", { name: item.mainText })}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={tokens.brand.strong}
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.text.primary }}>{item.mainText}</Text>
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
          <ActivityIndicator
            size="small"
            color={tokens.brand.default}
            style={{ padding: 16 }}
          />
        </View>
      )}

      {/* GPS button */}
      <TouchableOpacity
        style={{ position: 'absolute', right: 16, bottom: 176, width: 46, height: 46, borderRadius: 23, backgroundColor: tokens.bg.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
        onPress={handleMyLocation}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t("locationPicker.useGpsA11y")}
      >
        <Ionicons name="navigate" size={20} color={tokens.brand.default} />
      </TouchableOpacity>

      {/* Bottom card */}
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 8 }} edges={["bottom"]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Ionicons name="location" size={20} color={tokens.brand.default} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            {isGeocoding ? (
              <ActivityIndicator size="small" color={tokens.brand.default} />
            ) : (
              <Text
                style={{ fontSize: 14, fontWeight: '600', color: tokens.text.primary, lineHeight: 20 }}
                numberOfLines={2}
                accessibilityLiveRegion="polite"
              >
                {address || t("locationPicker.movePin")}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: tokens.brand.default, borderRadius: 12, paddingVertical: 16, alignItems: 'center', opacity: !address ? 0.5 : 1 }}
          onPress={handleConfirm}
          disabled={!address || isGeocoding}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("locationPicker.confirmA11y")}
          accessibilityState={{ disabled: !address || isGeocoding }}
        >
          <Text style={{ color: tokens.text.onBrand, fontSize: 16, fontWeight: '800' }}>{t("common.confirm")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
