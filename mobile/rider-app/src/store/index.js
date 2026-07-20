import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer, { forceLogout as forceLogoutAction, logout } from "./slices/authSlice";
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
import utilityReducer from "./slices/utilitySlice";

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
  utility: utilityReducer,
});

/**
 * Logout passthrough: wipe ALL user-scoped state (wallet, earnings, trip,
 * offers, notifications...) on EITHER logout path - `forceLogout` (silent
 * token-refresh failure) and normal `auth/logout` (the rider's own "Log Out"
 * button). Rider devices are frequently shared/company-issued, so only
 * wiring the forced path left every voluntary logout leaking the outgoing
 * rider's earnings/wallet/trip history into whoever logged in next on that
 * handset. Settings and location are global/anonymous and preserved across
 * logout.
 */
const rootReducer = (state, action) => {
  if (forceLogoutAction.match(action) || logout.fulfilled.match(action)) {
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
