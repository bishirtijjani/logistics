import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RequestsPage from './pages/RequestsPage'
import MerchantsPage from './pages/MerchantsPage'
import RidersPage from './pages/RidersPage'
import PendingRidersPage from './pages/PendingRidersPage'
import UsersPage from './pages/UsersPage'
import TransactionsPage from './pages/TransactionsPage'
import SettingsPage from './pages/SettingsPage'
import AuditLogPage from './pages/AuditLogPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'
import AnalyticsPage from './pages/AnalyticsPage'
import FinancialPage from './pages/FinancialPage'
import DisputesPage from './pages/DisputesPage'
import SupportPage from './pages/SupportPage'
import MarketingPage from './pages/MarketingPage'
import RiderOperationsPage from './pages/RiderOperationsPage'
import SafetyPage from './pages/SafetyPage'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('accessToken')
  
  if (!token) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="merchants" element={<MerchantsPage />} />
          <Route path="riders" element={<RidersPage />} />
          <Route path="pending-riders" element={<PendingRidersPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="financial" element={<FinancialPage />} />
          <Route path="disputes" element={<DisputesPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="rider-operations" element={<RiderOperationsPage />} />
          <Route path="safety" element={<SafetyPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </ErrorBoundary>
  )
}

export default App
