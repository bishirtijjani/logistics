import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegistrationPage from './pages/RegistrationPage.jsx'
import Layout from './components/Layout.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import MenuPage from './pages/MenuPage.jsx'
import EarningsPage from './pages/EarningsPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import SupportPage from './pages/SupportPage.jsx'
import MarketingPage from './pages/MarketingPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SessionWarningModal from './components/SessionWarningModal.jsx'
import { useSessionManager } from './hooks/useSessionManager.js'

function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem('token')
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AppContent() {
  const sessionManager = useSessionManager()

  return (
    <>
      <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route
            path="/dashboard/*"
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
            <Route path="support" element={<SupportPage />} />
            <Route path="marketing" element={<MarketingPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route index element={<Navigate to="orders" replace />} />
          </Route>
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        
        <SessionWarningModal
          show={sessionManager.showWarning}
          timeLeft={sessionManager.timeLeft}
          formatTime={sessionManager.formatTime}
          onStayLoggedIn={sessionManager.handleStayLoggedIn}
          onLogout={sessionManager.handleLogout}
          isRefreshing={sessionManager.isRefreshing}
        />
      </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
