import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchDashboardStats } from '../store/slices/dashboardSlice'
import {
  Package,
  Store,
  Bike,
  Users,
  TrendingUp,
  DollarSign
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const dispatch = useDispatch()
  const { stats, loading } = useSelector((state) => state.dashboard)

  useEffect(() => {
    dispatch(fetchDashboardStats())
  }, [dispatch])

  const statCards = [
    {
      title: 'Total Requests',
      value: stats?.totalRequests || 0,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      title: 'Active Requests',
      value: stats?.activeRequests || 0,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      title: 'Total Revenue',
      value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      title: 'Merchants',
      value: stats?.totalMerchants || 0,
      icon: Store,
      color: 'bg-orange-500',
    },
    {
      title: 'Riders',
      value: stats?.totalRiders || 0,
      icon: Bike,
      color: 'bg-cyan-500',
    },
    {
      title: 'Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'bg-pink-500',
    },
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
    { month: 'Jun', revenue: 192 },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {statCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{card.title}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                    </div>
                    <div className={`${card.color} p-3 rounded-lg`}>
                      <Icon size={24} className="text-white" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={requestsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="requests" fill="#3b82f6" name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
