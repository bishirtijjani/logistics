import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer, { forceLogout as forceLogoutAction, logout } from "./slices/authSlice";
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
import supportReducer from "./slices/supportSlice";

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
  support: supportReducer,
});

// Root reducer with logout passthrough. Wipes ALL user-scoped state on
// EITHER logout path so the next user that signs in on the same device
// doesn't see the previous user's wallet balance / transactions / requests /
// notifications: `forceLogout` (silent token-refresh failure) and the normal
// `auth/logout` (the account's own "Log Out" button) both need this - only
// wiring the former left every voluntary logout leaking the outgoing user's
// state into whoever logged in next on that device. `categories`, `settings`,
// and `location` are global/anonymous - we keep them to avoid an extra
// cold-load. The cart is user-scoped and belongs to whoever signed in; we
// wipe it AND clear the persisted blob so the next user doesn't inherit it
// on cold start.
const rootReducer = (state, action) => {
  if (forceLogoutAction.match(action) || logout.fulfilled.match(action)) {
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
