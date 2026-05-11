import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.js'
import dashboardReducer from './slices/dashboardSlice.js'
import requestsReducer from './slices/requestsSlice.js'
import merchantsReducer from './slices/merchantsSlice.js'
import ridersReducer from './slices/ridersSlice.js'
import usersReducer from './slices/usersSlice.js'
import transactionsReducer from './slices/transactionsSlice.js'
import settingsReducer from './slices/settingsSlice.js'
import pendingRidersReducer from './slices/pendingRidersSlice.js'
import auditLogsReducer from './slices/auditLogsSlice.js'
import categoriesReducer from './slices/categoriesSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    requests: requestsReducer,
    merchants: merchantsReducer,
    riders: ridersReducer,
    users: usersReducer,
    transactions: transactionsReducer,
    settings: settingsReducer,
    pendingRiders: pendingRidersReducer,
    auditLogs: auditLogsReducer,
    categories: categoriesReducer,
  },
})
