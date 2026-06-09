/**
 * Redux store configuration - Customer App.
 *
 * Single store instance. Import in App.js and wrap with <Merchant>.
 */

const { configureStore } = require('@reduxjs/toolkit');
const { authSlice } = require('./slices/authSlice');
const { walletSlice } = require('./slices/walletSlice');
const { deliverySlice } = require('./slices/deliverySlice');
const { utilitiesSlice } = require('./slices/utilitiesSlice');

const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    wallet: walletSlice.reducer,
    delivery: deliverySlice.reducer,
    utilities: utilitiesSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore date objects in delivery orders
        ignoredPaths: ['delivery.activeOrder.createdAt'],
      },
    }),
});

module.exports = { store };
