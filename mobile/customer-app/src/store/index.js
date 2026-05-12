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
});

// Root reducer with forced-logout passthrough. When the silent-refresh
// fallback flips `authSlice.forceLogout`, we wipe ALL user-scoped state so
// the next user that signs in on the same device doesn't briefly see the
// previous user's wallet balance / notifications / orders during the
// hydrate gap. `categories`, `settings`, and `location` are global/anonymous
// — we keep them to avoid an extra cold-load.
const rootReducer = (state, action) => {
  if (forceLogoutAction.match(action)) {
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
