import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import walletReducer from "./slices/walletSlice";
import profileReducer from "./slices/profileSlice";
import locationReducer from "./slices/locationSlice";
import deliveryReducer from "./slices/deliverySlice";
import utilityReducer from "./slices/utilitySlice";
import requestReducer from "./slices/requestSlice";  // NEW: Unified request slice
import categoriesReducer from "./slices/categoriesSlice";
import settingsReducer from "./slices/settingsSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wallet: walletReducer,
    profile: profileReducer,
    location: locationReducer,
    delivery: deliveryReducer,
    utility: utilityReducer,
    request: requestReducer,  // NEW: Unified request reducer
    categories: categoriesReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
