import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import walletReducer from "./slices/walletSlice";
import profileReducer from "./slices/profileSlice";
import locationReducer from "./slices/locationSlice";
import deliveryReducer from "./slices/deliverySlice";
import utilityReducer from "./slices/utilitySlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wallet: walletReducer,
    profile: profileReducer,
    location: locationReducer,
    delivery: deliveryReducer,
    utility: utilityReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
