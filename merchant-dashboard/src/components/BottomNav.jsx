import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
  ShoppingBag, Package, Wallet, MoreHorizontal,
  Smartphone, BarChart3, Megaphone, Settings, LifeBuoy, LogOut, X,
} from 'lucide-react'
import { logout } from '../store/slices/authSlice.js'

// Mobile-only bottom navigation. Mirrors the native merchant app's tab bar
// (Orders / Products / Earnings / More) so the app and the dashboard read as
// one surface. Desktop keeps the sidebar.
const TABS = [
  { to: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/dashboard/menu', label: 'Products', icon: Package },
  { to: '/dashboard/earnings', label: 'Earnings', icon: Wallet },
]

const MORE_LINKS = [
  { to: '/dashboard/vtu', label: 'Pay Bills', icon: Smartphone },
  { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/dashboard/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/dashboard/support', label: 'Support', icon: LifeBuoy },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const navItemCls = (isActive) =>
  `flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors ${
    isActive ? 'text-primary' : 'text-muted dark:text-dark-muted'
  }`

function TabItem({ to, label, icon: Icon }) {
  return (
    <NavLink to={to} className={({ isActive }) => navItemCls(isActive)}>
      {({ isActive }) => (
        <>
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${isActive ? 'bg-primary/10' : ''}`}>
            <Icon className="h-5 w-5" />
          </div>
          {label}
        </>
      )}
    </NavLink>
  )
}

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const signOut = async () => {
    setMoreOpen(false)
    await dispatch(logout())
    navigate('/login')
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-surface-muted bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-dark-surface-muted dark:bg-dark-surface/95">
        {TABS.map((tab) => (
          <TabItem key={tab.to} to={tab.to} label={tab.label} icon={tab.icon} />
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={navItemCls(false)}
          aria-label="More"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full">
            <MoreHorizontal className="h-5 w-5" />
          </div>
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-surface-muted bg-surface p-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-2xl dark:border-dark-surface-muted dark:bg-dark-surface">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-semibold text-text dark:text-dark-text">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-muted dark:text-dark-muted dark:hover:bg-dark-surface-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {MORE_LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                      isActive ? 'bg-primary/10 text-primary' : 'text-text hover:bg-surface-muted dark:text-dark-text dark:hover:bg-dark-surface-muted'
                    }`
                  }
                >
                  <l.icon className="h-5 w-5" />
                  {l.label}
                </NavLink>
              ))}
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-error hover:bg-error/10"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
