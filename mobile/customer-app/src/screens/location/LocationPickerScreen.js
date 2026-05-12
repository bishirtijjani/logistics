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
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import * as ExpoLocation from "expo-location";
import api from "../../services/api";
import {
  setLocation,
  detectCurrentLocation,
} from "../../store/slices/locationSlice";

const KATSINA = { latitude: 13.0059, longitude: 7.6019 };
const DELTA = { latitudeDelta: 0.012, longitudeDelta: 0.012 };

export default function LocationPickerScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const savedLocation = useSelector((state) => state.location);

  const mapRef = useRef(null);
  const searchTimeout = useRef(null);
  const geocodeTimeout = useRef(null);
  const sessionToken = useRef(`${Date.now()}-${Math.random()}`);

  const [region, setRegion] = useState({
    ...(savedLocation.latitude
      ? {
          latitude: savedLocation.latitude,
          longitude: savedLocation.longitude,
        }
      : KATSINA),
    ...DELTA,
  });
  const [address, setAddress] = useState(savedLocation.address || "");
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Reverse geocode the map center when user stops dragging (debounced)
  const handleRegionChangeComplete = useCallback(
    (newRegion) => {
      setRegion(newRegion);
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
      const newRegion = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
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
      />

      {/* Animated tooltip above pin */}
      <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -80, marginTop: -88, width: 160, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
        <Animated.View
          style={{
            opacity: address ? 1 : 0,
            transform: [{ translateY: address ? 0 : -10 }],
          }}
        >
          <View style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, maxWidth: 160 }}>
            <View style={{ position: 'absolute', bottom: -8, left: '50%', marginLeft: -8, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#fff' }} />
            <View style={{ alignItems: 'center' }}>
              {isGeocoding ? (
                <ActivityIndicator size="small" color="#EA580C" />
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '600', textAlign: 'center', color: "#09090b", lineHeight: 16 }} numberOfLines={2}>
                  {address || "Move the map to select a location"}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Fixed center pin */}
      <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
        <Ionicons name="location" size={40} color="#EA580C" />
        <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 4, backgroundColor: "rgba(234,88,12,0.3)" }} />
      </View>

      {/* Top bar */}
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} edges={["top"]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
          >
            <Ionicons name="arrow-back" size={22} color="#09090b" />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 44, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, marginLeft: 12 }}>
            <Ionicons name="search-outline" size={18} color="#6B7280" />
            <TextInput
              style={{ flex: 1, fontSize: 16, marginLeft: 8, fontWeight: '500', color: "#09090b" }}
              placeholder={t("locationPicker.searchPh")}
              accessibilityLabel={t("locationPicker.searchPh")}
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={handleSearch}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch("")}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Search results */}
      {predictions.length > 0 && (
        <View style={{ position: 'absolute', top: 112, left: 0, right: 0, zIndex: 100 }}>
          <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 12, maxHeight: 288, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4, zIndex: 100 }}>
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                  onPress={() => handleSelectPlace(item)}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color="#EA580C"
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: "#09090b" }}>{item.mainText}</Text>
                    <Text style={{ fontSize: 12, marginTop: 2, color: "#6B7280" }} numberOfLines={1}>
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
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 12, zIndex: 100 }}>
          <ActivityIndicator
            size="small"
            color="#EA580C"
            style={{ padding: 16 }}
          />
        </View>
      )}

      {/* GPS button */}
      <TouchableOpacity
        style={{ position: 'absolute', right: 16, bottom: 176, width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
        onPress={handleMyLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate" size={20} color="#EA580C" />
      </TouchableOpacity>

      {/* Bottom card */}
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 8 }} edges={["bottom"]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Ionicons name="location" size={20} color="#EA580C" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            {isGeocoding ? (
              <ActivityIndicator size="small" color="#EA580C" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '600', color: "#09090b", lineHeight: 20 }} numberOfLines={2}>
                {address || "Move the map to select a location"}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: '#EA580C', borderRadius: 12, paddingVertical: 16, alignItems: 'center', opacity: !address ? 0.5 : 1 }}
          onPress={handleConfirm}
          disabled={!address || isGeocoding}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{t("common.confirm")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
