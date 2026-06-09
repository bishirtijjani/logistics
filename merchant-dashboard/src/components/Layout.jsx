import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../store/slices/authSlice.js'
import { fetchSettings } from '../store/slices/settingsSlice.js'
import { fetchProducts } from '../store/slices/productsSlice.js'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { useAuthSession } from '../lib/useAuthSession.js'
import OnboardingWizard from './OnboardingWizard.jsx'
import HelpPanel from './HelpPanel.jsx'
import {
  ShoppingBag,
  Package,
  Wallet,
  Smartphone,
  BarChart3,
  MessageCircle,
  Megaphone,
  Settings,
  LogOut,
  Store,
  Menu,
  X,
  Moon,
  Sun,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function Layout() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const location = useLocation()
  const { user } = useSelector((state) => state.auth)
  const merchantId = user?.merchantId
  const merchantProfile = useSelector((state) => state.settings.settings)
  const { products, total: productTotal } = useSelector((state) => state.products)
  const [productsChecked, setProductsChecked] = useState(false)
  const { isDark, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const autoOpenedRef = useRef(false)
  // Mounted purely for its side effect: silently refreshes the access token
  // before it expires so the merchant is never interrupted by a modal.
  useAuthSession()

  // Pull the merchant profile so we can detect missing location server-side
  // (instead of a per-device localStorage flag that strands merchants who
  // skipped the wizard).
  useEffect(() => {
    if (!merchantId) return
    dispatch(fetchSettings({ merchantId }))
    // Onboarding now also requires at least one product, so pull the product
    // count up front. Mark "checked" only on success so a failed fetch doesn't
    // nag a merchant who actually has products.
    dispatch(fetchProducts({ merchantId }))
      .unwrap()
      .then(() => setProductsChecked(true))
      .catch(() => {})
  }, [dispatch, merchantId])

  // Placeholder coords are 0,0 (Gulf of Guinea - no Nigerian merchant lands
  // there) and the placeholder address starts with "Pending". Either signal
  // means the merchant still needs to pin their real location.
  const locationMissing =
    !!merchantProfile &&
    (
      (Number(merchantProfile.lat) === 0 && Number(merchantProfile.lng) === 0) ||
      (typeof merchantProfile.address === 'string' && merchantProfile.address.startsWith('Pending'))
    )

  // A merchant with no products isn't really open for business - keep
  // onboarding incomplete until they've added their first one. Gate on
  // `productsChecked` so we don't flash "incomplete" before products load.
  const hasProducts = (productTotal || 0) > 0 || (products?.length || 0) > 0
  const productMissing = !!merchantProfile && productsChecked && !hasProducts

  const needsOnboarding = locationMissing || productMissing

  // Auto-open once per page load - after the user dismisses, the banner is
  // the entry point. Layout persists across route changes, so this won't
  // re-pop on every navigation.
  useEffect(() => {
    if (needsOnboarding && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      setWizardOpen(true)
    }
  }, [needsOnboarding])

  // Mobile drawer: lock background scroll and close on Escape while open.
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [sidebarOpen])

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/login')
  }

  const navigation = [
    { name: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
    { name: 'Products', href: '/dashboard/menu', icon: Package },
    { name: 'Earnings', href: '/dashboard/earnings', icon: Wallet },
    { name: 'Pay Bills', href: '/dashboard/vtu', icon: Smartphone },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Support', href: '/dashboard/support', icon: MessageCircle },
    { name: 'Marketing', href: '/dashboard/marketing', icon: Megaphone },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="min-h-screen bg-background dark:bg-dark-background flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-gray-800 bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="merchant-sidebar"
        className={`fixed top-0 left-0 z-50 w-64 h-[100dvh] bg-surface dark:bg-dark-surface shadow-lg transform transition-transform duration-300 ease-in-out lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-surface-muted dark:border-dark-surface-muted">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-text dark:text-dark-text">Merchant</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="lg:hidden text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-primary/10 dark:bg-primary/20 text-primary'
                      : 'text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User info & logout */}
          <div className="border-t border-surface-muted dark:border-dark-surface-muted p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text dark:text-dark-text truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted dark:text-dark-muted truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-4 py-2 text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Top bar */}
        <header className="bg-surface dark:bg-dark-surface shadow-sm border-b border-surface-muted dark:border-dark-surface-muted sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              aria-controls="merchant-sidebar"
              className="lg:hidden text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-lg bg-surface-muted hover:bg-surface-muted/80 dark:bg-dark-surface-muted dark:hover:bg-dark-surface-muted/80 transition-colors"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-muted dark:text-dark-muted" />
                ) : (
                  <Moon className="w-5 h-5 text-muted" />
                )}
              </button>
              {merchantProfile?.name && (
                <div className="hidden sm:flex items-center gap-2 text-text dark:text-dark-text">
                  <Store className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium">{merchantProfile.name}</span>
                    {merchantProfile.category?.name && (
                      <span className="text-xs text-muted dark:text-dark-muted">
                        {merchantProfile.category.name}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {needsOnboarding && !wizardOpen && (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="w-full mb-6 flex items-center gap-3 p-4 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-left transition-colors"
            >
              <div className="flex-shrink-0 p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-amber-900 dark:text-amber-200">
                  Finish your business setup
                </div>
                <div className="text-sm text-amber-800/80 dark:text-amber-300/80">
                  {locationMissing
                    ? "Pin your business on the map - until you do, customers can't find you and admin can't approve your account."
                    : 'Add your first product so customers have something to order.'}
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
            </button>
          )}
          <Outlet />
        </main>
      </div>

      {/* Onboarding Wizard */}
      <OnboardingWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* In-app help */}
      <HelpPanel />
    </div>
  )
}
