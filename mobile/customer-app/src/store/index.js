import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import walletReducer from "./slices/walletSlice";
import profileReducer from "./slices/profileSlice";
import locationReducer from "./slices/locationSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wallet: walletReducer,
    profile: profileReducer,
    location: locationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
