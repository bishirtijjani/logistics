import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { fetchDashboardStats } from '../store/slices/dashboardSlice'
import {
  Package,
  Store,
  Bike,
  Users,
  TrendingUp,
  DollarSign,
  Check,
  X,
  UserCheck
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useTheme } from '../contexts/ThemeContext'

export default function DashboardPage() {
  const dispatch = useDispatch()
  const { stats, loading } = useSelector((state) => state.dashboard)
  const { isDark } = useTheme()

  // Theme-aware chart palette (recharts can't read Tailwind classes).
  const brandColor = isDark ? '#FB923C' : '#EA580C'
  const axisColor = isDark ? '#9CA3AF' : '#6B7280'
  const gridColor = isDark ? '#2A2A2A' : '#E5E7EB'
  const tooltipStyle = {
    backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
    border: `1px solid ${isDark ? '#2A2A2A' : '#E5E7EB'}`,
    borderRadius: 8,
    color: isDark ? '#F9FAFB' : '#09090b',
  }

  useEffect(() => {
    dispatch(fetchDashboardStats())
  }, [dispatch])

  const statCards = [
    { title: 'Total Requests', value: stats?.totalRequests || 0, icon: Package },
    { title: 'Active Requests', value: stats?.activeRequests || 0, icon: TrendingUp },
    { title: 'Total Revenue', value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`, icon: DollarSign },
    { title: 'Merchants', value: stats?.totalMerchants || 0, icon: Store },
    { title: 'Riders', value: stats?.totalRiders || 0, icon: Bike },
    { title: 'Users', value: stats?.totalUsers || 0, icon: Users },
  ]

  const revenueData = stats?.revenueTrend || [
    { month: 'Jan', revenue: 450000 },
    { month: 'Feb', revenue: 520000 },
    { month: 'Mar', revenue: 480000 },
    { month: 'Apr', revenue: 610000 },
    { month: 'May', revenue: 590000 },
    { month: 'Jun', revenue: 720000 },
  ]

  const requestsData = stats?.requestTrend || [
    { month: 'Jan', requests: 120 },
    { month: 'Feb', requests: 145 },
    { month: 'Mar', requests: 132 },
    { month: 'Apr', requests: 168 },
    { month: 'May', requests: 155 },
    { month: 'Jun', requests: 192 },
  ]

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-center py-12 text-muted dark:text-dark-muted">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {statCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted dark:text-dark-muted">{card.title}</p>
                      <p className="text-2xl font-bold text-text dark:text-dark-text mt-1">{card.value}</p>
                    </div>
                    <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-lg">
                      <Icon size={24} className="text-primary" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Revenue Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="month" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => `₦${value.toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke={brandColor} strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Request Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={requestsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="month" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
                  <Legend />
                  <Bar dataKey="requests" fill={brandColor} name="Requests" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-8">
            {/* Pending Merchants */}
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text dark:text-dark-text">Pending Merchants</h3>
                <Link to="/merchants" className="text-sm text-primary hover:text-primary-700 dark:hover:text-primary-400">
                  View All
                </Link>
              </div>
              <div className="space-y-3">
                {stats?.pendingMerchants?.slice(0, 3)?.map((merchant) => (
                  <div key={merchant.id} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                        <Store size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text dark:text-dark-text">{merchant.name}</p>
                        <p className="text-xs text-muted dark:text-dark-muted">{merchant.type}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="p-1.5 bg-success/10 text-success rounded hover:bg-success/20 dark:bg-success/20 dark:text-success">
                        <Check size={14} />
                      </button>
                      <button className="p-1.5 bg-error/10 text-error rounded hover:bg-error/20 dark:bg-error/20 dark:text-error">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-muted dark:text-dark-muted text-center py-4">No pending merchants</p>
                )}
              </div>
            </div>

            {/* Failed Transactions */}
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text dark:text-dark-text">Failed Transactions</h3>
                <Link to="/transactions" className="text-sm text-primary hover:text-primary-700 dark:hover:text-primary-400">
                  View All
                </Link>
              </div>
              <div className="space-y-3">
                {stats?.failedTransactions?.slice(0, 3)?.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-text dark:text-dark-text">#{transaction.id.slice(-8)}</p>
                      <p className="text-xs text-muted dark:text-dark-muted">₦{transaction.amount?.toLocaleString()}</p>
                    </div>
                    <span className="text-xs text-error font-medium">Failed</span>
                  </div>
                )) || (
                  <p className="text-sm text-muted dark:text-dark-muted text-center py-4">No failed transactions</p>
                )}
              </div>
            </div>

            {/* Pending Riders */}
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text dark:text-dark-text">Pending Riders</h3>
                <Link to="/riders?status=PENDING_APPROVAL" className="text-sm text-primary hover:text-primary-700 dark:hover:text-primary-400">
                  View All
                </Link>
              </div>
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-3 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                  <UserCheck size={32} className="text-primary" />
                </div>
                <p className="text-3xl font-bold text-text dark:text-dark-text">{stats?.pendingRiders || 0}</p>
                <p className="text-sm text-muted dark:text-dark-muted">Pending Applications</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
