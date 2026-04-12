import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLocation from "expo-location";
import api from "../../services/api";

const LOCATION_KEY = "@saved_location";

export const hydrateLocation = createAsyncThunk(
  "location/hydrate",
  async () => {
    const stored = await AsyncStorage.getItem(LOCATION_KEY);
    if (stored) return JSON.parse(stored);

    // No saved location — return default (no GPS permission prompt)
    return null;
  },
);

export const detectCurrentLocation = createAsyncThunk(
  "location/detect",
  async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission denied");
    }

    const pos = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });

    const { latitude, longitude } = pos.coords;

    // Reverse geocode via backend to keep API key server-side
    const { data } = await api.get("/maps/reverse-geocode", {
      params: { lat: latitude, lng: longitude },
    });

    const address = data.data?.formattedAddress || "";
    const city = extractCity(address);

    const location = { latitude, longitude, address, city };
    await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(location));
    return location;
  },
);

export const setLocation = createAsyncThunk(
  "location/set",
  async ({ latitude, longitude, address }) => {
    const city = extractCity(address);
    const location = { latitude, longitude, address, city };
    await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(location));
    return location;
  },
);

function extractCity(formattedAddress) {
  if (!formattedAddress) return "Nigeria";
  // Google formatted addresses in Nigeria: "..., City, State, Nigeria"
  const parts = formattedAddress.split(",").map((p) => p.trim());
  if (parts.length >= 3) return parts[parts.length - 3];
  if (parts.length >= 2) return parts[0];
  return formattedAddress;
}

const locationSlice = createSlice({
  name: "location",
  initialState: {
    latitude: null,
    longitude: null,
    address: "",
    city: "Katsina",
    isLoaded: false,
    isDetecting: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // hydrate
      .addCase(hydrateLocation.pending, (state) => {
        state.isDetecting = true;
        state.error = null;
      })
      .addCase(hydrateLocation.fulfilled, (state, action) => {
        if (action.payload) Object.assign(state, action.payload);
        state.isLoaded = true;
        state.isDetecting = false;
      })
      .addCase(hydrateLocation.rejected, (state, action) => {
        state.isLoaded = true;
        state.isDetecting = false;
        state.error = action.error.message;
      })
      // detect GPS
      .addCase(detectCurrentLocation.pending, (state) => {
        state.isDetecting = true;
        state.error = null;
      })
      .addCase(detectCurrentLocation.fulfilled, (state, action) => {
        Object.assign(state, action.payload);
        state.isLoaded = true;
        state.isDetecting = false;
      })
      .addCase(detectCurrentLocation.rejected, (state, action) => {
        state.isDetecting = false;
        state.error = action.error.message;
      })
      // set location
      .addCase(setLocation.fulfilled, (state, action) => {
        Object.assign(state, action.payload);
        state.isLoaded = true;
      });
  },
});

export default locationSlice.reducer;
