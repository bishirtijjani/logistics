import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
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
  const savedLocation = useSelector((state) => state.location);

  const mapRef = useRef(null);
  const searchTimeout = useRef(null);
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

  // Reverse geocode the map center when user stops dragging
  const handleRegionChangeComplete = useCallback(
    async (newRegion) => {
      setRegion(newRegion);
      if (showSearch) return; // Don't geocode while searching

      setIsGeocoding(true);
      try {
        const { data } = await api.get("/maps/reverse-geocode", {
          params: {
            lat: newRegion.latitude,
            lng: newRegion.longitude,
          },
        });
        setAddress(data.data?.formattedAddress || "Unknown location");
      } catch {
        setAddress("Unable to determine address");
      } finally {
        setIsGeocoding(false);
      }
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
        setPredictions(data.data || []);
      } catch {
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

      const place = data.data;
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
    dispatch(
      setLocation({
        latitude: region.latitude,
        longitude: region.longitude,
        address,
      }),
    );
    navigation.goBack();
  }, [dispatch, region, address, navigation]);

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* Fixed center pin */}
      <View style={styles.pinContainer} pointerEvents="none">
        <Ionicons name="location" size={40} color="#EA580C" />
        <View style={styles.pinShadow} />
      </View>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={["top"]}>
        {showSearch ? (
          <View style={styles.searchRow}>
            <TouchableOpacity
              onPress={() => {
                setShowSearch(false);
                setQuery("");
                setPredictions([]);
                Keyboard.dismiss();
              }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={22} color="#09090b" />
            </TouchableOpacity>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={18} color="#6B7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a place..."
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={handleSearch}
                autoFocus
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={22} color="#09090b" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Choose Location</Text>
            <TouchableOpacity
              onPress={() => setShowSearch(true)}
              style={styles.searchBtn}
            >
              <Ionicons name="search" size={20} color="#09090b" />
            </TouchableOpacity>
          </View>
        )}

        {/* Search results */}
        {showSearch && predictions.length > 0 && (
          <View style={styles.predictionsContainer}>
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.predictionRow}
                  onPress={() => handleSelectPlace(item)}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color="#EA580C"
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.predictionMain}>{item.mainText}</Text>
                    <Text style={styles.predictionSecondary} numberOfLines={1}>
                      {item.secondaryText}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
        {showSearch && isSearching && (
          <View style={styles.predictionsContainer}>
            <ActivityIndicator
              size="small"
              color="#EA580C"
              style={{ padding: 16 }}
            />
          </View>
        )}
      </SafeAreaView>

      {/* GPS button */}
      <TouchableOpacity
        style={styles.gpsButton}
        onPress={handleMyLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate" size={20} color="#EA580C" />
      </TouchableOpacity>

      {/* Bottom card */}
      <SafeAreaView style={styles.bottomCard} edges={["bottom"]}>
        <View style={styles.addressRow}>
          <Ionicons name="location" size={20} color="#EA580C" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            {isGeocoding ? (
              <ActivityIndicator size="small" color="#EA580C" />
            ) : (
              <Text style={styles.addressText} numberOfLines={2}>
                {address || "Move the map to select a location"}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.confirmBtn, !address && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!address || isGeocoding}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmText}>Confirm Location</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // --- Pin ---
  pinContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -20,
    marginTop: -40,
    alignItems: "center",
    zIndex: 1,
  },
  pinShadow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(234,88,12,0.3)",
    marginTop: -4,
  },
  // --- Top bar ---
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: "#09090b",
    textAlign: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // --- Search ---
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#09090b",
    marginLeft: 8,
    fontWeight: "500",
  },
  predictionsContainer: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    maxHeight: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  predictionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  predictionMain: {
    fontSize: 14,
    fontWeight: "700",
    color: "#09090b",
  },
  predictionSecondary: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  // --- GPS button ---
  gpsButton: {
    position: "absolute",
    right: 16,
    bottom: 180,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  // --- Bottom card ---
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  addressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#09090b",
    lineHeight: 20,
  },
  confirmBtn: {
    backgroundColor: "#EA580C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
