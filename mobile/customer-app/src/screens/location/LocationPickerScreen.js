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

  // Cleanup geocode timeout on unmount
  useEffect(() => {
    return () => {
      if (geocodeTimeout.current) {
        clearTimeout(geocodeTimeout.current);
      }
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
    <View className="flex-1">
      {/* Map */}
      <MapView
        ref={mapRef}
        className="absolute inset-0"
        merchant={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* Animated tooltip above pin */}
      <View className="absolute top-1/2 left-1/2 -ml-20 -mt-22 w-40 items-center z-10" pointerEvents="none">
        <Animated.View
          style={{
            opacity: address ? 1 : 0,
            transform: [{ translateY: address ? 0 : -10 }],
          }}
        >
          <View className="bg-white rounded-xl py-2.5 px-3.5 shadow-sm max-w-40">
            <View className="absolute -bottom-2 left-1/2 -ml-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
            <View className="items-center">
              {isGeocoding ? (
                <ActivityIndicator size="small" color="#EA580C" />
              ) : (
                <Text className="text-xs font-semibold text-center" style={{ color: "#09090b", lineHeight: 16 }} numberOfLines={2}>
                  {address || "Move the map to select a location"}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Fixed center pin */}
      <View className="absolute top-1/2 left-1/2 -ml-5 -mt-10 items-center z-10" pointerEvents="none">
        <Ionicons name="location" size={40} color="#EA580C" />
        <View className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: "rgba(234,88,12,0.3)" }} />
      </View>

      {/* Top bar */}
      <SafeAreaView className="absolute top-0 left-0 right-0" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm"
          >
            <Ionicons name="arrow-back" size={22} color="#09090b" />
          </TouchableOpacity>
          <View className="flex-1 flex-row items-center bg-white rounded-xl px-3 h-11 shadow-sm ml-3">
            <Ionicons name="search-outline" size={18} color="#6B7280" />
            <TextInput
              className="flex-1 text-base ml-2 font-medium"
              style={{ color: "#09090b" }}
              placeholder="Search for a place..."
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
        <View className="absolute top-28 left-0 right-0 z-100">
          <View className="mx-4 bg-white rounded-xl max-h-72 shadow-lg z-100">
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="flex-row items-center px-4 py-3.5 border-b"
                  style={{ borderBottomColor: "#F3F4F6" }}
                  onPress={() => handleSelectPlace(item)}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color="#EA580C"
                    className="mr-3"
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-bold" style={{ color: "#09090b" }}>{item.mainText}</Text>
                    <Text className="text-xs mt-0.5" style={{ color: "#6B7280" }} numberOfLines={1}>
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
        <View className="mx-4 bg-white rounded-xl z-100">
          <ActivityIndicator
            size="small"
            color="#EA580C"
            className="p-4"
          />
        </View>
      )}

      {/* GPS button */}
      <TouchableOpacity
        className="absolute right-4 bottom-44 w-11.5 h-11.5 rounded-full bg-white items-center justify-center shadow-md"
        onPress={handleMyLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate" size={20} color="#EA580C" />
      </TouchableOpacity>

      {/* Bottom card */}
      <SafeAreaView className="absolute bottom-0 left-0 right-0 bg-white rounded-t-6 px-5 pt-5 pb-3 shadow-lg" edges={["bottom"]}>
        <View className="flex-row items-center mb-4">
          <Ionicons name="location" size={20} color="#EA580C" />
          <View className="flex-1 ml-2.5">
            {isGeocoding ? (
              <ActivityIndicator size="small" color="#EA580C" />
            ) : (
              <Text className="text-sm font-semibold" style={{ color: "#09090b", lineHeight: 20 }} numberOfLines={2}>
                {address || "Move the map to select a location"}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          className={`bg-orange-600 rounded-xl py-4 items-center ${!address ? 'opacity-50' : ''}`}
          onPress={handleConfirm}
          disabled={!address || isGeocoding}
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-extrabold">Confirm Location</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
