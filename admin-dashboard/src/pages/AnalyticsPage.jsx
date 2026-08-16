import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import {
  DollarSign,
  ShoppingCart,
  Users,
  MapPin,
  TrendingUp,
  Clock,
  Activity,
  RefreshCw,
  Store,
  Bike,
  CheckCircle2,
  XCircle,
  Percent,
  Calendar,
  Layers,
  ChevronRight,
  Navigation,
  ArrowUpRight
} from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../contexts/ThemeContext'

// Custom map markers
const dropoffPin = L.divIcon({
  className: '',
  html: `<div style="transform:translate(-50%,-100%);color:#EA580C;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C7.589 2 4 5.589 4 9.995C4 14.59 8.6 19.55 11.18 22.04C11.62 22.46 12.38 22.46 12.82 22.04C15.4 19.55 20 14.59 20 9.995C20 5.589 16.411 2 12 2ZM12 12.5C10.62 12.5 9.5 11.38 9.5 10C9.5 8.62 10.62 7.5 12 7.5C13.38 7.5 14.5 8.62 14.5 10C14.5 11.38 13.38 12.5 12 12.5Z"/>
    </svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 26],
})

const merchantPin = L.divIcon({
  className: '',
  html: `<div style="transform:translate(-50%,-100%);color:#4F46E5;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C7.589 2 4 5.589 4 9.995C4 14.59 8.6 19.55 11.18 22.04C11.62 22.46 12.38 22.46 12.82 22.04C15.4 19.55 20 14.59 20 9.995C20 5.589 16.411 2 12 2ZM12 12.5C10.62 12.5 9.5 11.38 9.5 10C9.5 8.62 10.62 7.5 12 7.5C13.38 7.5 14.5 8.62 14.5 10C14.5 11.38 13.38 12.5 12 12.5Z"/>
    </svg>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 28],
})

const STATUS_COLORS = {
  DELIVERED: '#10B981',
  SETTLED: '#059669',
  REQUESTED: '#F59E0B',
  ACCEPTED: '#3B82F6',
  PROCESSING: '#6366F1',
  READY_FOR_PICKUP: '#8B5CF6',
  RIDER_ASSIGNED: '#EC4899',
  RIDER_EN_ROUTE: '#3B82F6',
  PICKED_UP: '#06B6D4',
  IN_TRANSIT: '#0EA5E9',
  CANCELLED: '#EF4444',
  FAILED: '#DC2626'
}

export default function AnalyticsPage() {
  const { isDark } = useTheme()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [revenueData, setRevenueData] = useState(null)
  const [orderData, setOrderData] = useState(null)
  const [customerData, setCustomerData] = useState(null)
  const [geographicData, setGeographicData] = useState(null)
  const [realtimeData, setRealtimeData] = useState(null)

  // Chart theme colors
  const brandColor = isDark ? '#FB923C' : '#EA580C'
  const secondaryColor = '#3B82F6'
  const successColor = '#10B981'
  const axisColor = isDark ? '#9CA3AF' : '#6B7280'
  const gridColor = isDark ? '#2A2A2A' : '#E5E7EB'
  const tooltipStyle = {
    backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
    border: `1px solid ${isDark ? '#2A2A2A' : '#E5E7EB'}`,
    borderRadius: 10,
    color: isDark ? '#F9FAFB' : '#09090b',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  }

  const queryParams = useMemo(() => {
    if (dateRange === 'custom') {
      const q = new URLSearchParams()
      if (customStart) q.set('startDate', customStart)
      if (customEnd) q.set('endDate', customEnd)
      return q.toString() ? `?${q.toString()}` : ''
    }
    return `?range=${dateRange}`
  }, [dateRange, customStart, customEnd])

  const fetchAnalytics = async () => {
    try {
      const [revenueRes, ordersRes, customersRes, geographicRes, realtimeRes] = await Promise.all([
        api.get(`/admin/analytics/revenue${queryParams}`),
        api.get(`/admin/analytics/orders${queryParams}`),
        api.get(`/admin/analytics/customers${queryParams}`),
        api.get(`/admin/analytics/geographic${queryParams}`),
        api.get(`/admin/analytics/realtime`)
      ])

      if (revenueRes.data?.data) setRevenueData(revenueRes.data.data)
      if (ordersRes.data?.data) setOrderData(ordersRes.data.data)
      if (customersRes.data?.data) setCustomerData(customersRes.data.data)
      if (geographicRes.data?.data) setGeographicData(geographicRes.data.data)
      if (realtimeRes.data?.data) setRealtimeData(realtimeRes.data.data)
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
    setLoading(true)
    fetchAnalytics()
    const interval = setInterval(fetchAnalytics, 30000)
    return () => clearInterval(interval)
  }, [queryParams])

  const formatNgn = (num) => `₦${Number(num || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'geographic', label: 'Geographic', icon: MapPin },
  ]

  // Map center calculation
  const mapCenter = useMemo(() => {
    if (geographicData?.ordersByLocation?.length > 0) {
      const loc = geographicData.ordersByLocation[0]
      if (loc.lat && loc.lng) return [loc.lat, loc.lng]
    }
    if (geographicData?.merchantDistribution?.length > 0) {
      const m = geographicData.merchantDistribution.find(x => x.lat && x.lng)
      if (m) return [m.lat, m.lng]
    }
    return [13.0059, 7.6019] // Katsina city center fallback
  }, [geographicData])

  if (loading && !revenueData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-sm text-muted dark:text-dark-muted">Loading platform analytics...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-dark-text tracking-tight">Platform Analytics</h1>
          <p className="text-muted dark:text-dark-muted mt-1 text-sm">
            Live operational intelligence, verified revenue metrics, and order insights
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-xl bg-surface-muted dark:bg-dark-surface-muted p-1 border border-surface-muted dark:border-dark-surface-muted">
            {[
              { id: '24h', label: 'Today' },
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '90d', label: '90D' },
              { id: '1y', label: '1Y' },
              { id: 'all', label: 'All' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDateRange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateRange === p.id
                    ? 'bg-surface dark:bg-dark-surface text-primary shadow-sm'
                    : 'text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 bg-surface dark:bg-dark-surface p-1.5 rounded-xl border border-surface-muted dark:border-dark-surface-muted">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface text-text dark:text-dark-text outline-none"
              />
              <span className="text-xs text-muted dark:text-dark-muted">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface text-text dark:text-dark-text outline-none"
              />
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 bg-primary text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-xs font-medium shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Real-time Operational Pulse (Top Banner) */}
      {realtimeData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-4 sm:p-5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-xs font-medium uppercase tracking-wider">In-Flight Deliveries</p>
                <p className="text-2xl sm:text-3xl font-extrabold mt-1">{realtimeData.activeRequests || 0}</p>
                <Link to="/requests" className="text-primary-200 hover:text-white text-xs mt-1 inline-flex items-center gap-1 font-medium">
                  Dispatch console <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-3 bg-white/10 rounded-xl">
                <Bike className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-4 sm:p-5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Online Fleet</p>
                <p className="text-2xl sm:text-3xl font-extrabold mt-1">{realtimeData.systemHealth?.activeRiders || 0}</p>
                <Link to="/riders" className="text-emerald-200 hover:text-white text-xs mt-1 inline-flex items-center gap-1 font-medium">
                  View riders <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-3 bg-white/10 rounded-xl">
                <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-4 sm:p-5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-xs font-medium uppercase tracking-wider">Open Merchants</p>
                <p className="text-2xl sm:text-3xl font-extrabold mt-1">{realtimeData.systemHealth?.activeMerchants || 0}</p>
                <Link to="/merchants" className="text-indigo-200 hover:text-white text-xs mt-1 inline-flex items-center gap-1 font-medium">
                  Merchant list <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-3 bg-white/10 rounded-xl">
                <Store className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-4 sm:p-5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs font-medium uppercase tracking-wider">Recent Orders</p>
                <p className="text-2xl sm:text-3xl font-extrabold mt-1">{realtimeData.recentOrders?.length || 0}</p>
                <p className="text-purple-200 text-xs mt-1">Past 60 minutes</p>
              </div>
              <div className="p-3 bg-white/10 rounded-xl">
                <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 border-b-2 font-medium transition-all text-sm whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary dark:text-primary font-semibold'
                : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW */}
      {/* ======================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* High-level KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Platform Commission</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text mt-1.5">
                    {formatNgn(revenueData?.totalRevenue)}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Net platform cut
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Percent className="w-6 h-6 text-primary" />
                </div>
              </div>
            </div>

            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Gross Order Value (GMV)</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text mt-1.5">
                    {formatNgn(revenueData?.grossVolume)}
                  </p>
                  <p className="text-xs text-muted dark:text-dark-muted mt-1 font-medium">
                    {orderData?.completedOrders || 0} completed orders
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Fulfillment Rate</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text mt-1.5">
                    {orderData?.completionRate || 0}%
                  </p>
                  <p className="text-xs text-muted dark:text-dark-muted mt-1 font-medium">
                    {orderData?.cancellationRate || 0}% cancelled
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Avg Delivery Time</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text mt-1.5">
                    {orderData?.avgDeliveryTime || 25}m
                  </p>
                  <p className="text-xs text-muted dark:text-dark-muted mt-1 font-medium">
                    Pickup to doorstep
                  </p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Revenue & Volume Chart */}
          <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
              <div>
                <h3 className="text-lg font-bold text-text dark:text-dark-text">Revenue & Order Volume Trend</h3>
                <p className="text-xs text-muted dark:text-dark-muted mt-0.5">
                  Daily Gross Merchandise Value (GMV) vs Platform Commission
                </p>
              </div>
            </div>

            {revenueData?.revenueTrend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={revenueData.revenueTrend}>
                  <defs>
                    <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={brandColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={brandColor} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={successColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={successColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(val) => formatNgn(val)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="grossVolume"
                    stroke={brandColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorGmv)"
                    name="Gross Volume (GMV)"
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={successColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                    name="Platform Commission"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted dark:text-dark-muted">
                <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No revenue transactions recorded in this date window</p>
              </div>
            )}
          </div>

          {/* Quick Previews: Top Merchants & Top Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-text dark:text-dark-text">Top Merchants by GMV</h3>
                <Link to="/merchants" className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold">
                  All merchants <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {revenueData?.topMerchants?.slice(0, 5).map((merchant, idx) => (
                  <div key={merchant.merchantId || idx} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text dark:text-dark-text truncate">{merchant.name || 'Store'}</p>
                        <p className="text-xs text-muted dark:text-dark-muted">{merchant.category || 'Merchant'} · {merchant._count || 0} orders</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-text dark:text-dark-text">{formatNgn(merchant._sum?.amount)}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Cut: {formatNgn(merchant.commissionEarned)}</p>
                    </div>
                  </div>
                ))}
                {(!revenueData?.topMerchants || revenueData.topMerchants.length === 0) && (
                  <p className="text-sm text-center py-6 text-muted dark:text-dark-muted">No merchant sales in this window</p>
                )}
              </div>
            </div>

            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-text dark:text-dark-text">Top Customers</h3>
                <Link to="/customers" className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold">
                  All customers <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {customerData?.topCustomers?.slice(0, 5).map((customer, idx) => (
                  <div key={customer.id || idx} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center font-bold text-xs text-success shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text dark:text-dark-text truncate">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <p className="text-xs text-muted dark:text-dark-muted truncate">{customer.email}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-text dark:text-dark-text">{formatNgn(customer.totalSpent)}</p>
                      <p className="text-xs text-muted dark:text-dark-muted">{customer.orderCount} orders</p>
                    </div>
                  </div>
                ))}
                {(!customerData?.topCustomers || customerData.topCustomers.length === 0) && (
                  <p className="text-sm text-center py-6 text-muted dark:text-dark-muted">No customer activity in this window</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: REVENUE DEEP DIVE */}
      {/* ======================================================== */}
      {activeTab === 'revenue' && revenueData && (
        <div className="space-y-6">
          {/* Revenue Breakdown Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-4 border border-surface-muted dark:border-dark-surface-muted">
              <p className="text-xs text-muted dark:text-dark-muted font-medium">Platform Commission</p>
              <p className="text-xl font-bold text-primary mt-1">{formatNgn(revenueData.totalRevenue)}</p>
              <p className="text-xs text-muted dark:text-dark-muted mt-1">Platform net</p>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-4 border border-surface-muted dark:border-dark-surface-muted">
              <p className="text-xs text-muted dark:text-dark-muted font-medium">Gross Merchandise (GMV)</p>
              <p className="text-xl font-bold text-text dark:text-dark-text mt-1">{formatNgn(revenueData.grossVolume)}</p>
              <p className="text-xs text-muted dark:text-dark-muted mt-1">Total order volume</p>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-4 border border-surface-muted dark:border-dark-surface-muted">
              <p className="text-xs text-muted dark:text-dark-muted font-medium">Delivery Fees</p>
              <p className="text-xl font-bold text-text dark:text-dark-text mt-1">{formatNgn(revenueData.deliveryFees)}</p>
              <p className="text-xs text-muted dark:text-dark-muted mt-1">Logistics volume</p>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-4 border border-surface-muted dark:border-dark-surface-muted">
              <p className="text-xs text-muted dark:text-dark-muted font-medium">Merchant Payouts</p>
              <p className="text-xl font-bold text-text dark:text-dark-text mt-1">{formatNgn(revenueData.merchantEarnings)}</p>
              <p className="text-xs text-muted dark:text-dark-muted mt-1">Store net cut</p>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-4 border border-surface-muted dark:border-dark-surface-muted">
              <p className="text-xs text-muted dark:text-dark-muted font-medium">Rider Earnings</p>
              <p className="text-xl font-bold text-text dark:text-dark-text mt-1">{formatNgn(revenueData.riderEarnings)}</p>
              <p className="text-xs text-muted dark:text-dark-muted mt-1">Courier payouts</p>
            </div>
          </div>

          {/* Interactive Multi-series Revenue Chart */}
          <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
            <h3 className="text-lg font-bold text-text dark:text-dark-text mb-1">Financial Inflow & Commission Curve</h3>
            <p className="text-xs text-muted dark:text-dark-muted mb-6">Interactive time series of daily GMV, Platform Commission, and Delivery Fees</p>

            {revenueData.revenueTrend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={revenueData.revenueTrend}>
                  <defs>
                    <linearGradient id="revGmv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={brandColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={brandColor} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={successColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={successColor} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revFees" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(val) => formatNgn(val)} />
                  <Legend />
                  <Area type="monotone" dataKey="grossVolume" stroke={brandColor} strokeWidth={2} fillOpacity={1} fill="url(#revGmv)" name="Gross Volume (GMV)" />
                  <Area type="monotone" dataKey="revenue" stroke={successColor} strokeWidth={2} fillOpacity={1} fill="url(#revComm)" name="Platform Commission" />
                  <Area type="monotone" dataKey="deliveryFees" stroke={secondaryColor} strokeWidth={2} fillOpacity={1} fill="url(#revFees)" name="Delivery Fees" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted dark:text-dark-muted">
                <p className="text-sm">No transaction data in selected range</p>
              </div>
            )}
          </div>

          {/* Top Performing Merchants Table */}
          <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold text-text dark:text-dark-text mb-4">Top Performing Merchants</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-surface-muted dark:bg-dark-surface-muted text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider text-left">
                    <th className="px-4 py-3 rounded-l-xl">Merchant</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-center">Completed Orders</th>
                    <th className="px-4 py-3 text-right">Gross Sales (GMV)</th>
                    <th className="px-4 py-3 text-right">Platform Commission</th>
                    <th className="px-4 py-3 text-right rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted text-sm">
                  {revenueData.topMerchants?.map((m, idx) => (
                    <tr key={m.merchantId || idx} className="hover:bg-surface-muted/50 dark:hover:bg-dark-surface-muted/50 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-text dark:text-dark-text flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        {m.name || 'Store'}
                      </td>
                      <td className="px-4 py-3.5 text-muted dark:text-dark-muted">{m.category || 'Store'}</td>
                      <td className="px-4 py-3.5 text-center font-medium">{m._count || 0}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-text dark:text-dark-text">{formatNgn(m._sum?.amount)}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatNgn(m.commissionEarned)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/merchants/${m.merchantId}/analytics`}
                          className="text-xs text-primary hover:underline font-semibold"
                        >
                          Deep Dive →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {(!revenueData.topMerchants || revenueData.topMerchants.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted dark:text-dark-muted">
                        No merchant sales in this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ORDERS */}
      {/* ======================================================== */}
      {activeTab === 'orders' && orderData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Total Orders Placed</p>
              <p className="text-2xl font-bold text-text dark:text-dark-text mt-1">{orderData.totalOrders || 0}</p>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Successfully Completed</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{orderData.completedOrders || 0}</p>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Completion Rate</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{orderData.completionRate || 0}%</p>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Cancellation Rate</p>
              <p className="text-2xl font-bold text-red-500 dark:text-red-400 mt-1">{orderData.cancellationRate || 0}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders by Status */}
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <h3 className="text-lg font-bold text-text dark:text-dark-text mb-4">Orders by Status</h3>
              <div className="space-y-3">
                {orderData.ordersByStatus?.map((status) => (
                  <div key={status.status} className="flex items-center justify-between p-3.5 bg-surface-muted dark:bg-dark-surface-muted rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[status.status] || '#6B7280' }}
                      />
                      <span className="font-semibold text-text dark:text-dark-text capitalize">
                        {status.status.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="font-bold text-text dark:text-dark-text px-2.5 py-0.5 rounded-lg bg-surface dark:bg-dark-surface text-xs shadow-sm">
                      {status._count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Orders by Type */}
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <h3 className="text-lg font-bold text-text dark:text-dark-text mb-4">Fulfillment Mode</h3>
              <div className="space-y-4">
                {orderData.ordersByType?.map((type) => {
                  const isMerchant = type.type === 'MERCHANT_ORDER'
                  const percentage = orderData.totalOrders > 0 ? Math.round((type._count / orderData.totalOrders) * 100) : 0
                  return (
                    <div key={type.type} className="p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {isMerchant ? <Store className="w-4 h-4 text-primary" /> : <Bike className="w-4 h-4 text-blue-500" />}
                          <span className="font-bold text-sm text-text dark:text-dark-text">
                            {isMerchant ? 'Merchant Orders (Food/Store)' : 'Package Delivery (Courier)'}
                          </span>
                        </div>
                        <span className="font-bold text-sm text-text dark:text-dark-text">{type._count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-surface dark:bg-dark-surface rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${isMerchant ? 'bg-primary' : 'bg-blue-500'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: CUSTOMERS */}
      {/* ======================================================== */}
      {activeTab === 'customers' && customerData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Total Customer Accounts</p>
              <p className="text-2xl font-bold text-text dark:text-dark-text mt-1">{customerData.totalCustomers || 0}</p>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">New In Window</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{customerData.newCustomers || 0}</p>
            </div>
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-5 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">Active 30-Day Transactors</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{customerData.retention?.returningCustomers || 0}</p>
            </div>
          </div>

          <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold text-text dark:text-dark-text mb-4">Top Spending Customers</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-surface-muted dark:bg-dark-surface-muted text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider text-left">
                    <th className="px-4 py-3 rounded-l-xl">Customer</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3 text-center">Orders</th>
                    <th className="px-4 py-3 text-right">Total Spent</th>
                    <th className="px-4 py-3 text-right rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted text-sm">
                  {customerData.topCustomers?.map((c, idx) => (
                    <tr key={c.id || idx} className="hover:bg-surface-muted/50 dark:hover:bg-dark-surface-muted/50 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-text dark:text-dark-text flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-success/10 text-success text-xs flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        {c.firstName} {c.lastName}
                      </td>
                      <td className="px-4 py-3.5 text-muted dark:text-dark-muted">{c.email}</td>
                      <td className="px-4 py-3.5 text-muted dark:text-dark-muted">{c.phone || '—'}</td>
                      <td className="px-4 py-3.5 text-center font-medium">{c.orderCount}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-text dark:text-dark-text">{formatNgn(c.totalSpent)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Link to={`/customers/${c.id}`} className="text-xs text-primary hover:underline font-semibold">
                          Profile →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {(!customerData.topCustomers || customerData.topCustomers.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted dark:text-dark-muted">
                        No customer spending data found in this window
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: GEOGRAPHIC VISUALIZATION */}
      {/* ======================================================== */}
      {activeTab === 'geographic' && geographicData && (
        <div className="space-y-6">
          {/* Interactive Leaflet Map */}
          <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-text dark:text-dark-text">Delivery Density & Merchant Map</h3>
                <p className="text-xs text-muted dark:text-dark-muted mt-0.5">
                  Orange pins: Destination dropoff hotspots | Purple pins: Verified Merchant Locations
                </p>
              </div>
            </div>

            <div className="h-96 w-full rounded-xl overflow-hidden border border-surface-muted dark:border-dark-surface-muted relative z-0">
              <MapContainer
                center={mapCenter}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                {/* Dropoff Pins */}
                {geographicData.ordersByLocation?.map((loc, idx) => (
                  loc.lat && loc.lng ? (
                    <Marker key={`dropoff-${idx}`} position={[loc.lat, loc.lng]} icon={dropoffPin}>
                      <Popup>
                        <div className="p-1">
                          <p className="font-bold text-xs text-orange-600">Dropoff Location</p>
                          <p className="text-xs mt-1">{loc.address || `${loc.lat}, ${loc.lng}`}</p>
                          <p className="text-xs font-semibold mt-1">Orders: {loc.orderCount} | Vol: {formatNgn(loc.totalAmount)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ) : null
                ))}

                {/* Merchant Pins */}
                {geographicData.merchantDistribution?.map((m, idx) => (
                  m.lat && m.lng ? (
                    <Marker key={`merchant-${idx}`} position={[m.lat, m.lng]} icon={merchantPin}>
                      <Popup>
                        <div className="p-1">
                          <p className="font-bold text-xs text-indigo-600">{m.name}</p>
                          <p className="text-xs text-gray-500">{m.type} · {m.address || 'Katsina'}</p>
                          <p className="text-xs font-semibold mt-1">Orders: {m.orderCount} | Sales: {formatNgn(m.totalRevenue)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ) : null
                ))}
              </MapContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Merchant Distribution Table */}
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <h3 className="text-base font-bold text-text dark:text-dark-text mb-4">Merchant Hub Distribution</h3>
              <div className="space-y-3">
                {geographicData.merchantDistribution?.map((merchant, index) => (
                  <div key={merchant.id || merchant.name || index} className="flex items-center justify-between p-3.5 bg-surface-muted dark:bg-dark-surface-muted rounded-xl">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text dark:text-dark-text truncate">{merchant.name}</p>
                      <p className="text-xs text-muted dark:text-dark-muted truncate">{merchant.type} · {merchant.address || 'Katsina'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-text dark:text-dark-text">{formatNgn(merchant.totalRevenue)}</p>
                      <p className="text-xs text-muted dark:text-dark-muted">{merchant.orderCount} fulfilled</p>
                    </div>
                  </div>
                ))}
                {(!geographicData.merchantDistribution || geographicData.merchantDistribution.length === 0) && (
                  <p className="text-sm text-center py-6 text-muted dark:text-dark-muted">No merchant data available</p>
                )}
              </div>
            </div>

            {/* Top Dropoff Hotspots Table */}
            <div className="bg-surface dark:bg-dark-surface rounded-2xl p-6 border border-surface-muted dark:border-dark-surface-muted shadow-sm">
              <h3 className="text-base font-bold text-text dark:text-dark-text mb-4">Top Destination Hubs</h3>
              <div className="space-y-3">
                {geographicData.ordersByLocation?.slice(0, 10).map((loc, index) => (
                  <div key={index} className="flex items-center justify-between p-3.5 bg-surface-muted dark:bg-dark-surface-muted rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text dark:text-dark-text truncate">
                          {loc.address || `Coord: ${loc.lat}, ${loc.lng}`}
                        </p>
                        <p className="text-xs text-muted dark:text-dark-muted">{loc.lat}, {loc.lng}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-text dark:text-dark-text">{loc.orderCount} orders</p>
                      <p className="text-xs text-muted dark:text-dark-muted">{formatNgn(loc.totalAmount)}</p>
                    </div>
                  </div>
                ))}
                {(!geographicData.ordersByLocation || geographicData.ordersByLocation.length === 0) && (
                  <p className="text-sm text-center py-6 text-muted dark:text-dark-muted">No location data found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
