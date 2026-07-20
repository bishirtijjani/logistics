import { combineReducers, configureStore } from '@reduxjs/toolkit'
import authReducer, { logout, refreshToken } from './slices/authSlice.js'
import ordersReducer from './slices/ordersSlice.js'
import productsReducer from './slices/productsSlice.js'
import earningsReducer from './slices/earningsSlice.js'
import analyticsReducer from './slices/analyticsSlice.js'
import settingsReducer from './slices/settingsSlice.js'
import supportTicketsReducer from './slices/supportTicketsSlice.js'
import disputesReducer from './slices/disputesSlice.js'
import utilityReducer from './slices/utilitySlice.js'
import walletReducer from './slices/walletSlice.js'
import platformSettingsReducer from './slices/platformSettingsSlice.js'
import notificationsReducer from './slices/notificationsSlice.js'

const combined = combineReducers({
  auth: authReducer,
  orders: ordersReducer,
  products: productsReducer,
  earnings: earningsReducer,
  analytics: analyticsReducer,
  settings: settingsReducer,
  supportTickets: supportTicketsReducer,
  disputes: disputesReducer,
  utility: utilityReducer,
  wallet: walletReducer,
  platformSettings: platformSettingsReducer,
  notifications: notificationsReducer,
})

// Wipe ALL merchant-scoped state (orders, earnings, wallet, notifications...)
// on EITHER logout path - the merchant's own "Log Out" and the forced
// logout when a session's refresh token is rejected - so a different
// merchant signing into the same browser/shared terminal doesn't see the
// previous merchant's data before their own fetches land. `settings`/
// `platformSettings` are global/anonymous and preserved.
const rootReducer = (state, action) => {
  if (logout.fulfilled.match(action) || refreshToken.rejected.match(action)) {
    state = {
      settings: state?.settings,
      platformSettings: state?.platformSettings,
    }
  }
  return combined(state, action)
}

export const store = configureStore({
  reducer: rootReducer,
})
