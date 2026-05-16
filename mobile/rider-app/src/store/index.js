import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer, { forceLogout as forceLogoutAction } from "./slices/authSlice";
import profileReducer from "./slices/profileSlice";
import riderReducer from "./slices/riderSlice";
import offersReducer from "./slices/offersSlice";
import tripReducer from "./slices/tripSlice";
import earningsReducer from "./slices/earningsSlice";
import walletReducer from "./slices/walletSlice";
import onboardingReducer from "./slices/onboardingSlice";
import notificationsReducer from "./slices/notificationsSlice";
import settingsReducer from "./slices/settingsSlice";
import supportReducer from "./slices/supportSlice";
import locationReducer from "./slices/locationSlice";
import beneficiariesReducer from "./slices/beneficiariesSlice";

const combined = combineReducers({
  auth: authReducer,
  profile: profileReducer,
  rider: riderReducer,
  offers: offersReducer,
  trip: tripReducer,
  earnings: earningsReducer,
  wallet: walletReducer,
  onboarding: onboardingReducer,
  notifications: notificationsReducer,
  settings: settingsReducer,
  support: supportReducer,
  location: locationReducer,
  beneficiaries: beneficiariesReducer,
});

/**
 * Forced-logout passthrough: when silent-refresh fallback flips
 * `authSlice.forceLogout`, wipe ALL user-scoped state. Settings and
 * location are global/anonymous and preserved across logout.
 */
const rootReducer = (state, action) => {
  if (forceLogoutAction.match(action)) {
    state = {
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
