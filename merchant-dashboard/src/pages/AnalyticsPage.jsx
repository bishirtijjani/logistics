import { useEffect, useState, useCallback, useRef } from 'react'
import { API_URL } from '../lib/api'
import { useSelector, useDispatch } from 'react-redux'
import {
  fetchSalesSummary,
  fetchOrderHistory,
  fetchEarningsBreakdown,
} from '../store/slices/analyticsSlice.js'
import { showSuccessToast, showErrorToast, showLoadingToast, dismissToast } from '../utils/toast.js'
import LoadingSkeleton, { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton.jsx'
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Calendar,
  Download,
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
import { useTheme } from '../contexts/ThemeContext.jsx'

export default function AnalyticsPage() {
  const { user } = useSelector((state) => state.auth)
  const merchantId = user?.merchantId
  const dispatch = useDispatch()
  const { salesSummary, orderHistory, earningsBreakdown, loading, error } = useSelector((state) => state.analytics)
  const { isDark } = useTheme()

  // Theme-aware chart palette (recharts can't read Tailwind classes).
  const brandColor = isDark ? '#FB923C' : '#EA580C'
  const axisColor = isDark ? '#9CA3AF' : '#6B7280'
  const gridColor = isDark ? '#2A2A2A' : '#E5E7EB'
  const tooltipStyle = {
    backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
    border: `1px solid ${isDark ? '#2A2A2A' : '#E5E7EB'}`,
    borderRadius: 8,
    color: isDark ? '#FAFAFA' : '#09090b',
  }
  const [period, setPeriod] = useState('7d')
  const [isCustomRange, setIsCustomRange] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 seconds
  const intervalRef = useRef(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Data caching strategy
  const cacheRef = useRef({
    salesSummary: null,
    orderHistory: null,
    earningsBreakdown: null,
    timestamp: null,
    cacheExpiry: 5 * 60 * 1000 // 5 minutes
  })

  const fetchAnalyticsData = useCallback(async (useCache = true) => {
    const now = Date.now()
    const cache = cacheRef.current

    // Check if cache is valid
    if (useCache && cache.timestamp && (now - cache.timestamp) < cache.cacheExpiry) {
      console.log('Using cached data')
      return
    }

    const params = { merchantId }
    if (isCustomRange && startDate && endDate) {
      params.startDate = startDate
      params.endDate = endDate
    } else {
      params.period = period
    }

    try {
      await Promise.all([
        dispatch(fetchSalesSummary(params)),
        dispatch(fetchOrderHistory({ ...params, page: 1, limit: 10 })),
        dispatch(fetchEarningsBreakdown(params))
      ])
      
      // Update cache
      cacheRef.current = {
        salesSummary: salesSummary,
        orderHistory: orderHistory,
        earningsBreakdown: earningsBreakdown,
        timestamp: now,
        cacheExpiry: cache.cacheExpiry
      }
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    }
  }, [dispatch, merchantId, period, isCustomRange, startDate, endDate, salesSummary, orderHistory, earningsBreakdown])

  useEffect(() => {
    fetchAnalyticsData()
  }, [fetchAnalyticsData])

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchAnalyticsData(false) // Don't use cache for auto-refresh
      }, refreshInterval)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, refreshInterval, fetchAnalyticsData])

  const handleCustomRangeSubmit = () => {
    if (startDate && endDate) {
      setIsCustomRange(true)
      fetchAnalyticsData(false) // Don't use cache for custom range
    }
  }

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod)
    setIsCustomRange(false)
    setStartDate('')
    setEndDate('')
  }

  const exportData = async (format = 'csv') => {
    try {
      const params = { merchantId, format }
      if (isCustomRange && startDate && endDate) {
        params.startDate = startDate
        params.endDate = endDate
      } else {
        params.period = period
      }

      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/merchants/${merchantId}/analytics/export?${new URLSearchParams(params)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        showSuccessToast(`Analytics exported as ${format.toUpperCase()}`)
      } else {
        throw new Error('Failed to export data')
      }
    } catch (error) {
      showErrorToast('Failed to export analytics data')
    }
  }

  const stats = [
    {
      name: 'Total Orders',
      value: salesSummary?.totalOrders || 0,
      icon: ShoppingCart,
      color: 'bg-primary',
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
          <h1 className="text-2xl font-bold text-text dark:text-dark-text">Analytics</h1>
          <p className="text-muted dark:text-dark-muted">Track your sales and performance</p>
          {lastUpdated && (
            <p className="text-xs text-muted dark:text-dark-muted mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Custom Date Range */}
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
              />
              <span className="text-muted dark:text-dark-muted">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
              />
              <button
                onClick={handleCustomRangeSubmit}
                className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                Apply
              </button>
            </div>
          )}

          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-primary border-surface-muted dark:border-dark-surface-muted rounded focus:ring-primary"
            />
            <label htmlFor="autoRefresh" className="text-sm text-text dark:text-dark-text">
              Auto-refresh
            </label>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-2 py-1 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded text-sm dark:text-dark-text"
              >
                <option value={15000}>15s</option>
                <option value={30000}>30s</option>
                <option value={60000}>1m</option>
                <option value={300000}>5m</option>
              </select>
            )}
          </div>

          {/* Export Button */}
          <button
            onClick={() => exportData('csv')}
            className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors flex items-center gap-2 text-sm text-text dark:text-dark-text"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          {/* Refresh Button */}
          <button
            onClick={async () => {
              const toastId = showLoadingToast('Refreshing analytics data...')
              try {
                await fetchAnalyticsData(false)
                dismissToast(toastId)
                showSuccessToast('Analytics data refreshed successfully!')
              } catch (error) {
                dismissToast(toastId)
                showErrorToast('Failed to refresh analytics data')
              }
            }}
            className="p-2 text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-surface dark:bg-dark-surface rounded-lg shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-2">Failed to load analytics</h3>
          <p className="text-muted dark:text-dark-muted mb-4">{error}</p>
          <button
            onClick={() => {
              dispatch(fetchSalesSummary({ merchantId, period }))
              dispatch(fetchOrderHistory({ merchantId, page: 1, limit: 10 }))
              dispatch(fetchEarningsBreakdown({ merchantId, period }))
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : !salesSummary || (revenueData.length === 0 && ordersData.length === 0) ? (
        <div className="bg-surface dark:bg-dark-surface rounded-lg shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-surface-muted dark:bg-dark-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-muted dark:text-dark-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-2">No analytics data available</h3>
          <p className="text-muted dark:text-dark-muted mb-4">
            Start receiving orders to see your sales analytics and performance metrics here.
          </p>
          <button
            onClick={() => {
              dispatch(fetchSalesSummary({ merchantId, period }))
              dispatch(fetchOrderHistory({ merchantId, page: 1, limit: 10 }))
              dispatch(fetchEarningsBreakdown({ merchantId, period }))
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Refresh Data
          </button>
        </div>
      ) : loading ? (
        <>
          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>

          {/* Charts Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div key={stat.name} className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted dark:text-dark-muted">{stat.name}</p>
                    <p className="text-2xl font-bold text-text dark:text-dark-text mt-1">{stat.value}</p>
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
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Revenue Trend</h3>
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
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Orders Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ordersData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="day" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
                  <Legend />
                  <Bar dataKey="orders" fill={brandColor} name="Orders" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Earnings Breakdown</h3>
            {earningsBreakdown ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted mb-2">Total Earnings</p>
                  <p className="text-3xl font-bold text-success">
                    ₦{earningsBreakdown.totalEarnings?.toLocaleString() || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted mb-2">Total Withdrawals</p>
                  <p className="text-3xl font-bold text-error">
                    ₦{earningsBreakdown.totalWithdrawals?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted dark:text-dark-muted">No earnings data available</p>
            )}
          </div>

          {/* Advanced Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Performance Analysis */}
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Product Performance</h3>
              <div className="space-y-4">
                {salesSummary?.topProducts?.slice(0, 5).map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted dark:text-dark-muted">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-text dark:text-dark-text">{product.name}</p>
                        <p className="text-sm text-muted dark:text-dark-muted">{product.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-text dark:text-dark-text">₦{product.revenue.toLocaleString()}</p>
                      <p className="text-sm text-success">+{product.growth}%</p>
                    </div>
                  </div>
                )) || <p className="text-muted dark:text-dark-muted">No product data available</p>}
              </div>
            </div>

            {/* Customer Analytics */}
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Customer Analytics</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Total Customers</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text">
                    {salesSummary?.customerAnalytics?.totalCustomers || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Repeat Customers</p>
                  <p className="text-2xl font-bold text-primary">
                    {salesSummary?.customerAnalytics?.repeatCustomers || 0}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted dark:text-dark-muted mb-2">Customer Lifetime Value</p>
                <p className="text-xl font-bold text-success">
                  ₦{salesSummary?.customerAnalytics?.ltv?.toLocaleString() || '0'}
                </p>
              </div>
            </div>

            {/* Peak Hours Analysis */}
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Peak Hours Analysis</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={salesSummary?.peakHours || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="hour" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="orders" fill={brandColor} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion Tracking */}
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Conversion Tracking</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted dark:text-dark-muted">Total Views</span>
                  <span className="font-medium text-text dark:text-dark-text">
                    {salesSummary?.conversionTracking?.totalViews?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted dark:text-dark-muted">Total Orders</span>
                  <span className="font-medium text-text dark:text-dark-text">
                    {salesSummary?.conversionTracking?.totalOrders || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted dark:text-dark-muted">Conversion Rate</span>
                  <span className="font-medium text-success">
                    {salesSummary?.conversionTracking?.conversionRate || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Zone Performance */}
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Delivery Zone Performance</h3>
              <div className="space-y-3">
                {salesSummary?.deliveryZones?.slice(0, 4).map((zone, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-text dark:text-dark-text">{zone.name}</p>
                      <p className="text-sm text-muted dark:text-dark-muted">{zone.orders} orders</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted dark:text-dark-muted">Avg Time</p>
                      <p className="font-medium text-text dark:text-dark-text">{zone.avgDeliveryTime}m</p>
                    </div>
                  </div>
                )) || <p className="text-muted dark:text-dark-muted">No delivery zone data available</p>}
              </div>
            </div>

            {/* Cancellation Rate Analysis */}
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Cancellation Analysis</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Total Orders</p>
                  <p className="text-xl font-bold text-text dark:text-dark-text">
                    {salesSummary?.cancellationAnalysis?.totalOrders || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Cancelled</p>
                  <p className="text-xl font-bold text-error">
                    {salesSummary?.cancellationAnalysis?.cancelledOrders || 0}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted dark:text-dark-muted mb-2">Cancellation Rate</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-surface-muted dark:bg-dark-surface-muted rounded-full h-2">
                    <div 
                      className="bg-error h-2 rounded-full" 
                      style={{ width: `${salesSummary?.cancellationAnalysis?.cancellationRate || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-error">
                    {salesSummary?.cancellationAnalysis?.cancellationRate || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
