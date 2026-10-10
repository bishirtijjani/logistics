import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer, { forceLogout as forceLogoutAction, logout } from "./slices/authSlice";
import ordersReducer from "./slices/ordersSlice";
import notificationsReducer from "./slices/notificationsSlice";
import profileReducer from "./slices/profileSlice";
import settingsReducer from "./slices/settingsSlice";

const combined = combineReducers({
  auth: authReducer,
  orders: ordersReducer,
  notifications: notificationsReducer,
  profile: profileReducer,
  settings: settingsReducer,
});

/**
 * Wipe all user-scoped state on EITHER logout path (voluntary logout or the
 * silent-refresh forceLogout). Only platform settings are preserved.
 */
const rootReducer = (state, action) => {
  if (forceLogoutAction.match(action) || logout.fulfilled.match(action)) {
    state = { settings: state?.settings };
  }
  return combined(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
});
