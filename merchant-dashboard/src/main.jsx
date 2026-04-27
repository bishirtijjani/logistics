import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './store/store.js'
import './index.css'
import LoginPage from './pages/LoginPage.jsx'
import Layout from './components/Layout.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import MenuPage from './pages/MenuPage.jsx'
import EarningsPage from './pages/EarningsPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem('merchant_token')
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard/:providerId/*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="orders" element={<OrdersPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route index element={<Navigate to="orders" replace />} />
          </Route>
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
