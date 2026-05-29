import { Outlet, Link, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ShieldCheck,
  Package, 
  Store, 
  Bike,
  Users,
  Receipt, 
  FileText,
  Settings, 
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Clock,
  BarChart3,
  DollarSign,
  MessageCircle,
  Headphones,
  Megaphone,
  Shield,
  Wifi,
  Network,
  Tags,
  ListChecks
} from 'lucide-react'
import { logout } from '../store/slices/authSlice'
import Breadcrumb from './Breadcrumb'
import { useTheme } from '../contexts/ThemeContext'
import { useAuthSession } from '../lib/useAuthSession'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/requests', icon: Package, label: 'Requests' },
  { path: '/merchants', icon: Store, label: 'Merchants' },
  { path: '/categories', icon: Tags, label: 'Categories' },
  { path: '/riders', icon: Bike, label: 'Riders' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/financial', icon: DollarSign, label: 'Financial' },
  { path: '/disputes', icon: MessageCircle, label: 'Disputes' },
  { path: '/support', icon: Headphones, label: 'Support' },
  { path: '/marketing', icon: Megaphone, label: 'Marketing' },
  { path: '/waitlist', icon: ListChecks, label: 'Waitlist' },
  { path: '/rider-operations', icon: Bike, label: 'Rider Ops' },
  { path: '/safety', icon: Shield, label: 'Safety' },
  { path: '/vtu-plans', icon: Wifi, label: 'VTU Plans' },
  { path: '/vtu-networks', icon: Network, label: 'VTU Networks' },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/audit-logs', icon: FileText, label: 'Audit Logs' },
  { path: '/transactions', icon: Receipt, label: 'Transactions' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const location = useLocation()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isDark, toggleTheme } = useTheme()
  const { showWarning, timeRemaining, extending, formatTimeRemaining, handleLogout, extendSession } = useAuthSession()

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

  const isActivePath = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="flex h-[100dvh] bg-background dark:bg-dark-background">
      {/* Mobile menu button — only when closed, so it never overlaps the sidebar */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          aria-expanded={false}
          aria-controls="admin-sidebar"
          className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface dark:bg-dark-surface rounded-lg shadow-lg border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        id="admin-sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-surface dark:bg-dark-surface border-r border-surface-muted dark:border-dark-surface-muted flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white shrink-0">
              <ShieldCheck size={22} />
            </span>
            <div className="min-w-0">
              <h1
                className="text-xl font-bold text-text dark:text-dark-text leading-tight"
                style={{ fontFamily: "Roboto, sans-serif" }}
              >iPrime</h1>
              <p className="text-xs text-muted dark:text-dark-muted">Admin Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="lg:hidden p-2 -mr-2 rounded-lg text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = isActivePath(item.path)
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/10 dark:bg-primary/20 text-primary font-medium'
                        : 'text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
                    }`}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-surface-muted dark:border-dark-surface-muted">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-medium">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div>
              <Link to="/profile" className="text-sm font-medium text-text dark:text-dark-text hover:text-primary transition-colors">
                {user?.firstName} {user?.lastName}
              </Link>
              <p className="text-xs text-muted dark:text-dark-muted">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center justify-center gap-2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors flex-1 px-4 py-2 rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-muted dark:text-dark-muted hover:text-error transition-colors flex-1 px-4 py-2 rounded-lg hover:bg-error/10 dark:hover:bg-error/20"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="px-4 pt-16 pb-6 sm:px-6 sm:pt-8 sm:pb-8 lg:p-8 bg-background dark:bg-dark-background min-h-full">
          <Breadcrumb />
          <Outlet />
        </div>
      </main>

      {/* Session Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Clock size={24} className="text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">Session Expiring</h3>
            </div>
            <p className="text-muted dark:text-dark-muted mb-2">
              Your session will expire in <span className="font-semibold">{formatTimeRemaining(timeRemaining)}</span>
            </p>
            <p className="text-sm text-muted dark:text-dark-muted mb-6">
              Please save your work or extend your session to continue.
            </p>
            <div className="flex gap-3">
              <button
                onClick={extendSession}
                disabled={extending}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {extending ? 'Extending…' : 'Extend Session'}
              </button>
              <button
                onClick={handleLogout}
                disabled={extending}
                className="flex-1 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text disabled:opacity-60"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
