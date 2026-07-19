import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegistrationPage from './pages/RegistrationPage.jsx'
import Layout from './components/Layout.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import MenuPage from './pages/MenuPage.jsx'
import EarningsPage from './pages/EarningsPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import SupportPage from './pages/SupportPage.jsx'
import TicketDetailPage from './pages/TicketDetailPage.jsx'
import DisputeDetailPage from './pages/DisputeDetailPage.jsx'
import MarketingPage from './pages/MarketingPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import BillsPage from './pages/BillsPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'

// Decode a JWT's exp claim without verifying the signature - the server is
// still the authority, this is just to keep stale tokens from flashing the
// dashboard before the API kicks the user out.
const isTokenLive = (token) => {
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload?.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

// True when the persisted user carries a merchantId (i.e. owns a merchant
// profile). Gates the dashboard vs. the enrollment flow.
function hasMerchantProfile() {
  try {
    return !!JSON.parse(localStorage.getItem('merchant_user') || 'null')?.merchantId
  } catch {
    return false
  }
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!isTokenLive(token)) {
    // Clean up stale state on the way out so the next protected nav doesn't
    // loop right back here with the same dead token.
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('merchant_user')
    return <Navigate to="/login" replace />
  }
  // Logged in on a live token but no merchant profile yet → route to
  // enrollment instead of a broken merchant-scoped dashboard. One iPrime
  // account can be a customer/rider and add a merchant profile later.
  if (!hasMerchantProfile()) return <Navigate to="/enroll" replace />
  return children
}

// Enrollment is reachable by any logged-in user without a merchant profile.
// Existing merchants are bounced to the dashboard.
function EnrollRoute() {
  const token = localStorage.getItem('token')
  if (!isTokenLive(token)) return <Navigate to="/login" replace />
  if (hasMerchantProfile()) return <Navigate to="/dashboard" replace />
  return <RegistrationPage enroll />
}

function AppContent() {
  return (
    <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/enroll" element={<EnrollRoute />} />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="orders" element={<OrdersPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="vtu" element={<BillsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="support/tickets/:ticketId" element={<TicketDetailPage />} />
            <Route path="support/disputes/:disputeId" element={<DisputeDetailPage />} />
            <Route path="marketing" element={<MarketingPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route index element={<Navigate to="orders" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
