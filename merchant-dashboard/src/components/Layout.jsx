import { Outlet, Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../store/slices/authSlice.js'
import { useTheme } from '../contexts/ThemeContext.jsx'
import OnboardingWizard from './OnboardingWizard.jsx'
import {
  ShoppingBag,
  Utensils,
  Wallet,
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
} from 'lucide-react'
import { useState } from 'react'

export default function Layout() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const location = useLocation()
  const { merchantId } = useParams()
  const { user } = useSelector((state) => state.auth)
  const { isDark, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/login')
  }

  const navigation = [
    { name: 'Orders', href: `/dashboard/${merchantId}/orders`, icon: ShoppingBag },
    { name: 'Menu', href: `/dashboard/${merchantId}/menu`, icon: Utensils },
    { name: 'Earnings', href: `/dashboard/${merchantId}/earnings`, icon: Wallet },
    { name: 'Analytics', href: `/dashboard/${merchantId}/analytics`, icon: BarChart3 },
    { name: 'Support', href: `/dashboard/${merchantId}/support`, icon: MessageCircle },
    { name: 'Marketing', href: `/dashboard/${merchantId}/marketing`, icon: Megaphone },
    { name: 'Settings', href: `/dashboard/${merchantId}/settings`, icon: Settings },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-background dark:bg-dark-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-800 bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 w-64 h-full bg-surface dark:bg-dark-surface shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="bg-surface dark:bg-dark-surface shadow-sm border-b border-surface-muted dark:border-dark-surface-muted sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-surface-muted hover:bg-surface-muted/80 dark:bg-dark-surface-muted dark:hover:bg-dark-surface-muted/80 transition-colors"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-muted dark:text-dark-muted" />
                ) : (
                  <Moon className="w-5 h-5 text-muted" />
                )}
              </button>
              <div className="hidden sm:block text-sm text-muted dark:text-dark-muted">
                {user?.merchantId && `Merchant ID: ${user.merchantId}`}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Onboarding Wizard */}
      <OnboardingWizard />
    </div>
  )
}
