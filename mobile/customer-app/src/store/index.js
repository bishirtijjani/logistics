import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer, { forceLogout as forceLogoutAction } from "./slices/authSlice";
import walletReducer from "./slices/walletSlice";
import profileReducer from "./slices/profileSlice";
import locationReducer from "./slices/locationSlice";
import utilityReducer from "./slices/utilitySlice";
import requestReducer from "./slices/requestSlice";
import categoriesReducer from "./slices/categoriesSlice";
import settingsReducer from "./slices/settingsSlice";
import notificationsReducer from "./slices/notificationsSlice";
import addressesReducer from "./slices/addressesSlice";
import homeReducer from "./slices/homeSlice";
import cartReducer from "./slices/cartSlice";

const combined = combineReducers({
  auth: authReducer,
  wallet: walletReducer,
  profile: profileReducer,
  location: locationReducer,
  utility: utilityReducer,
  request: requestReducer,
  categories: categoriesReducer,
  settings: settingsReducer,
  notifications: notificationsReducer,
  addresses: addressesReducer,
  home: homeReducer,
  cart: cartReducer,
});

// Root reducer with forced-logout passthrough. When the silent-refresh
// fallback flips `authSlice.forceLogout`, we wipe ALL user-scoped state so
// the next user that signs in on the same device doesn't briefly see the
// previous user's wallet balance / notifications / orders during the
// hydrate gap. `categories`, `settings`, and `location` are global/anonymous
// — we keep them to avoid an extra cold-load. The cart is user-scoped and
// belongs to whoever signed in; we wipe it AND clear the persisted blob so
// the next user doesn't inherit it on cold start.
const rootReducer = (state, action) => {
  if (forceLogoutAction.match(action)) {
    AsyncStorage.removeItem("cart:v1").catch(() => {});
    state = {
      categories: state?.categories,
      settings: state?.settings,
      location: state?.location,
    };
  }
  return combined(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
