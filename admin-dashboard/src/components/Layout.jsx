import { Outlet, Link, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { 
  LayoutDashboard, 
  Package, 
  Store, 
  Bike, 
  UserCheck,
  Users, 
  Receipt, 
  Settings, 
  LogOut 
} from 'lucide-react'
import { logout } from '../store/slices/authSlice'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/requests', icon: Package, label: 'Requests' },
  { path: '/merchants', icon: Store, label: 'Merchants' },
  { path: '/riders', icon: Bike, label: 'Riders' },
  { path: '/pending-riders', icon: UserCheck, label: 'Pending Riders' },
  { path: '/users', icon: Users, label: 'Users' },
  { path: '/transactions', icon: Receipt, label: 'Transactions' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const location = useLocation()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)

  const handleLogout = () => {
    dispatch(logout())
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">VTU Logistics</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Dashboard</p>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
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

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 font-medium">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition-colors w-full px-4 py-2 rounded-lg hover:bg-red-50"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
