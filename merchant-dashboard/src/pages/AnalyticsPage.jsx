import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import {
  fetchSalesSummary,
  fetchOrderHistory,
  fetchEarningsBreakdown,
} from '../store/slices/analyticsSlice.js'
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export default function AnalyticsPage() {
  const { merchantId } = useParams()
  const dispatch = useDispatch()
  const { salesSummary, orderHistory, earningsBreakdown, loading } = useSelector((state) => state.analytics)
  const [period, setPeriod] = useState('7d')

  useEffect(() => {
    dispatch(fetchSalesSummary({ merchantId, period }))
    dispatch(fetchOrderHistory({ merchantId, page: 1, limit: 10 }))
    dispatch(fetchEarningsBreakdown({ merchantId, period }))
  }, [dispatch, merchantId, period])

  const stats = [
    {
      name: 'Total Orders',
      value: salesSummary?.totalOrders || 0,
      icon: ShoppingCart,
      color: 'bg-blue-500',
    },
    {
      name: 'Total Revenue',
      value: `₦${(salesSummary?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-green-500',
    },
    {
      name: 'Completed Orders',
      value: salesSummary?.completedOrders || 0,
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
  ]

  // Use real data from API - salesSummary should contain revenue and order trends
  const revenueData = salesSummary?.revenueTrend || []
  const ordersData = salesSummary?.orderTrend || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your sales and performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-gray-100"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={() => {
              dispatch(fetchSalesSummary({ merchantId, period }))
              dispatch(fetchOrderHistory({ merchantId, page: 1, limit: 10 }))
              dispatch(fetchEarningsBreakdown({ merchantId, period }))
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div key={stat.name} className="bg-white dark:bg-dark-surface rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{stat.name}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Orders Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ordersData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="orders" fill="#8b5cf6" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings Breakdown</h3>
            {earningsBreakdown ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Total Earnings</p>
                  <p className="text-3xl font-bold text-green-600">
                    ₦{earningsBreakdown.totalEarnings?.toLocaleString() || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Total Withdrawals</p>
                  <p className="text-3xl font-bold text-red-600">
                    ₦{earningsBreakdown.totalWithdrawals?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-600">No earnings data available</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
