import { useState, useEffect } from 'react'
import { API_URL } from '../lib/api'
import { DollarSign, ShoppingCart, Users, MapPin, TrendingUp, Clock, Activity, RefreshCw, Store } from 'lucide-react'

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState('7d')

  const [revenueData, setRevenueData] = useState(null)
  const [orderData, setOrderData] = useState(null)
  const [customerData, setCustomerData] = useState(null)
  const [geographicData, setGeographicData] = useState(null)
  const [realtimeData, setRealtimeData] = useState(null)

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const [revenue, orders, customers, geographic, realtime] = await Promise.all([
        fetch(`${API_URL}/admin/analytics/revenue?range=${dateRange}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/orders?range=${dateRange}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/customers?range=${dateRange}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/geographic?range=${dateRange}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()),
        fetch(`${API_URL}/admin/analytics/realtime`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json())
      ])

      if (revenue.success) setRevenueData(revenue.data)
      if (orders.success) setOrderData(orders.data)
      if (customers.success) setCustomerData(customers.data)
      if (geographic.success) setGeographicData(geographic.data)
      if (realtime.success) setRealtimeData(realtime.data)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAnalytics()
  }

  useEffect(() => {
    fetchAnalytics()
    const interval = setInterval(fetchAnalytics, 30000) // Auto-refresh every 30s
    return () => clearInterval(interval)
  }, [dateRange])

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'geographic', label: 'Geographic', icon: MapPin },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Platform Analytics</h1>
          <p className="text-muted dark:text-dark-muted mt-1 text-sm">
            Comprehensive platform insights and performance metrics
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm w-full sm:w-auto"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 sm:gap-4 border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 sm:px-4 py-3 border-b-2 transition-colors text-sm whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary dark:text-primary'
                : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Real-time Metrics */}
      {realtimeData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-primary to-primary-700 rounded-xl p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-sm">Active Requests</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{realtimeData.systemHealth?.activeRiders || 0}</p>
                <p className="text-primary-100 text-xs mt-1">Riders online</p>
              </div>
              <Activity className="w-8 h-8 sm:w-10 sm:h-10 text-primary-200 shrink-0" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-success to-success-700 rounded-xl p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-success-100 text-sm">Active Merchants</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{realtimeData.systemHealth?.activeMerchants || 0}</p>
                <p className="text-success-100 text-xs mt-1">Currently open</p>
              </div>
              <Store className="w-8 h-8 sm:w-10 sm:h-10 text-success-200 shrink-0" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">In Progress</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{realtimeData.activeRequests || 0}</p>
                <p className="text-purple-100 text-xs mt-1">Active orders</p>
              </div>
              <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-purple-200 shrink-0" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Recent Orders</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{realtimeData.recentOrders?.length || 0}</p>
                <p className="text-orange-100 text-xs mt-1">Last hour</p>
              </div>
              <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-orange-200 shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {revenueData && (
            <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Total Revenue</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text">
                    ₦{(revenueData.totalRevenue / 1000).toFixed(1)}K
                  </p>
                </div>
              </div>
            </div>
          )}
          {orderData && (
            <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Total Orders</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text">
                    {orderData.totalOrders}
                  </p>
                </div>
              </div>
            </div>
          )}
          {customerData && (
            <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-success/10 rounded-lg">
                  <Users className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Total Customers</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text">
                    {customerData.totalCustomers}
                  </p>
                </div>
              </div>
            </div>
          )}
          {orderData && (
            <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Avg Delivery</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text">
                    {Math.round(orderData.avgDeliveryTime)}m
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && revenueData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Revenue Trend</h3>
            <div className="h-64 flex items-center justify-center text-muted dark:text-dark-muted">
              <p>Revenue chart will be rendered here</p>
            </div>
          </div>
          <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Top Merchants</h3>
            <div className="space-y-3">
              {revenueData.topMerchants?.map((merchant, index) => (
                <div key={merchant.merchantId} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    <span className="text-text dark:text-dark-text">Merchant {merchant.merchantId.slice(0, 8)}</span>
                  </div>
                  <span className="font-semibold text-text dark:text-dark-text">
                    ₦{(merchant._sum.amount / 1000).toFixed(1)}K
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && orderData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Orders by Status</h3>
            <div className="space-y-3">
              {orderData.ordersByStatus?.map((status) => (
                <div key={status.status} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <span className="text-text dark:text-dark-text capitalize">{status.status.toLowerCase()}</span>
                  <span className="font-semibold text-text dark:text-dark-text">{status._count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Orders by Type</h3>
            <div className="space-y-3">
              {orderData.ordersByType?.map((type) => (
                <div key={type.type} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <span className="text-text dark:text-dark-text">{type.type}</span>
                  <span className="font-semibold text-text dark:text-dark-text">{type._count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && customerData && (
        <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
          <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Top Customers</h3>
          <div className="space-y-3">
            {customerData.topCustomers?.map((customer, index) => (
              <div key={customer.id} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center text-success font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-text dark:text-dark-text font-medium">
                      {customer.firstName} {customer.lastName}
                    </p>
                    <p className="text-sm text-muted dark:text-dark-muted">{customer.orderCount} orders</p>
                  </div>
                </div>
                <span className="font-semibold text-text dark:text-dark-text">
                  ₦{(customer.totalSpent / 1000).toFixed(1)}K
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geographic Tab */}
      {activeTab === 'geographic' && geographicData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Merchant Distribution</h3>
            <div className="space-y-3">
              {geographicData.merchantDistribution?.map((merchant, index) => (
                <div key={merchant.name} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <div>
                    <p className="text-text dark:text-dark-text font-medium">{merchant.name}</p>
                    <p className="text-sm text-muted dark:text-dark-muted">{merchant.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-text dark:text-dark-text">
                      ₦{(merchant.totalRevenue / 1000).toFixed(1)}K
                    </p>
                    <p className="text-sm text-muted dark:text-dark-muted">{merchant.orderCount} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface dark:bg-dark-surface rounded-xl p-6 border border-surface-muted dark:border-dark-surface-muted">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Order Density</h3>
            <div className="h-64 flex items-center justify-center text-muted dark:text-dark-muted">
              <p>Map visualization will be rendered here</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
