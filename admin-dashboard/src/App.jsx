import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Toaster } from 'sonner'
import api from './lib/api'
import { setUser } from './store/slices/authSlice'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RequestsPage from './pages/RequestsPage'
import MerchantsPage from './pages/MerchantsPage'
import RidersPage from './pages/RidersPage'
import PendingRidersPage from './pages/PendingRidersPage'
import CustomersPage from './pages/CustomersPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import TransactionsPage from './pages/TransactionsPage'
import SettingsPage from './pages/SettingsPage'
import AuditLogPage from './pages/AuditLogPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'
import AnalyticsPage from './pages/AnalyticsPage'
import FinancialPage from './pages/FinancialPage'
import DisputesPage from './pages/DisputesPage'
import DisputeDetailPage from './pages/DisputeDetailPage'
import SupportPage from './pages/SupportPage'
import SupportTicketDetailPage from './pages/SupportTicketDetailPage'
import MarketingPage from './pages/MarketingPage'
import RiderOperationsPage from './pages/RiderOperationsPage'
import SafetyPage from './pages/SafetyPage'
import MerchantAnalyticsPage from './pages/MerchantAnalyticsPage'
import VtuPlansPage from './pages/VtuPlansPage'
import VtuNetworksPage from './pages/VtuNetworksPage'
import CategoriesPage from './pages/CategoriesPage'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('accessToken')
  
  if (!token) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function useUserBootstrap() {
  const dispatch = useDispatch()
  const token = useSelector((s) => s.auth.token)
  const user = useSelector((s) => s.auth.user)

  useEffect(() => {
    if (!token) return
    // Revalidate profile on mount: fast path uses persisted user; this keeps it fresh + verifies the token.
    api.get('/auth/profile')
      .then((res) => {
        const profile = res.data?.data || res.data
        if (profile) dispatch(setUser(profile))
      })
      .catch(() => { /* 401 interceptor handles auth failures */ })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return { user, token }
}

function App() {
  useUserBootstrap()
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
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="merchants/:merchantId/analytics" element={<MerchantAnalyticsPage />} />
          <Route path="riders" element={<RidersPage />} />
          <Route path="pending-riders" element={<PendingRidersPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:customerId" element={<CustomerDetailPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="financial" element={<FinancialPage />} />
          <Route path="disputes" element={<DisputesPage />} />
          <Route path="disputes/:disputeId" element={<DisputeDetailPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="support/:ticketId" element={<SupportTicketDetailPage />} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="rider-operations" element={<RiderOperationsPage />} />
          <Route path="safety" element={<SafetyPage />} />
          <Route path="vtu-plans" element={<VtuPlansPage />} />
          <Route path="vtu-networks" element={<VtuNetworksPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </ErrorBoundary>
  )
}

export default App
