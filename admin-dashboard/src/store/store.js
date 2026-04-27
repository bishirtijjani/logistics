import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.js'
import dashboardReducer from './slices/dashboardSlice.js'
import requestsReducer from './slices/requestsSlice.js'
import providersReducer from './slices/providersSlice.js'
import ridersReducer from './slices/ridersSlice.js'
import usersReducer from './slices/usersSlice.js'
import transactionsReducer from './slices/transactionsSlice.js'
import settingsReducer from './slices/settingsSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    requests: requestsReducer,
    providers: providersReducer,
    riders: ridersReducer,
    users: usersReducer,
    transactions: transactionsReducer,
    settings: settingsReducer,
  },
})
