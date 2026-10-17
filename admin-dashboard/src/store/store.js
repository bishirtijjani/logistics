import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.js'
import dashboardReducer from './slices/dashboardSlice.js'
import requestsReducer from './slices/requestsSlice.js'
import merchantsReducer from './slices/merchantsSlice.js'
import ridersReducer from './slices/ridersSlice.js'
import customersReducer from './slices/customersSlice.js'
import transactionsReducer from './slices/transactionsSlice.js'
import settingsReducer from './slices/settingsSlice.js'
import auditLogsReducer from './slices/auditLogsSlice.js'
import categoriesReducer from './slices/categoriesSlice.js'
import homeCategoriesReducer from './slices/homeCategoriesSlice.js'
import supportTicketsReducer from './slices/supportTicketsSlice.js'
import disputesReducer from './slices/disputesSlice.js'
import waitlistReducer from './slices/waitlistSlice.js'
import productsReducer from './slices/productsSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    requests: requestsReducer,
    merchants: merchantsReducer,
    riders: ridersReducer,
    customers: customersReducer,
    transactions: transactionsReducer,
    settings: settingsReducer,
    auditLogs: auditLogsReducer,
    categories: categoriesReducer,
    homeCategories: homeCategoriesReducer,
    supportTickets: supportTicketsReducer,
    disputes: disputesReducer,
    waitlist: waitlistReducer,
    products: productsReducer,
  },
})
