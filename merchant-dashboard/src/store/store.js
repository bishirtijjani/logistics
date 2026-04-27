import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.js'
import ordersReducer from './slices/ordersSlice.js'
import productsReducer from './slices/productsSlice.js'
import earningsReducer from './slices/earningsSlice.js'
import analyticsReducer from './slices/analyticsSlice.js'
import settingsReducer from './slices/settingsSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    orders: ordersReducer,
    products: productsReducer,
    earnings: earningsReducer,
    analytics: analyticsReducer,
    settings: settingsReducer,
  },
})
