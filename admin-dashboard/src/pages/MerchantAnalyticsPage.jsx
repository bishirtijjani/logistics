import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { fetchMerchantAnalytics, clearMerchantAnalytics } from '../store/slices/merchantsSlice'
import {
  ArrowLeft, TrendingUp, TrendingDown, ShoppingBag, Star, DollarSign,
  BarChart2, XCircle, CheckCircle, Activity, Calendar, RefreshCw,
  Store, Users, Percent, Clock,
} from 'lucide-react'

const Spinner = ({ size = 16 }) => (
  <span
    className="inline-block border-2 border-primary border-t-transparent rounded-full animate-spin"
    style={{ width: size, height: size }}
  />
)

const KPICard = ({ label, value, sub, icon, trend, trendLabel, color = 'primary' }) => {
  const colorMap = {
    primary: { bg: 'bg-primary/5 dark:bg-primary/10', icon: 'text-primary', border: 'border-primary/10 dark:border-primary/20' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-500/20' },
    amber:   { bg: 'bg-amber-50 dark:bg-amber-500/10',   icon: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-100 dark:border-amber-500/20' },
    blue:    { bg: 'bg-blue-50 dark:bg-blue-500/10',    icon: 'text-blue-600 dark:text-blue-400',    border: 'border-blue-100 dark:border-blue-500/20' },
    red:     { bg: 'bg-red-50 dark:bg-red-500/10',     icon: 'text-red-500 dark:text-red-400',     border: 'border-red-100 dark:border-red-500/20' },
    purple:  { bg: 'bg-purple-50 dark:bg-purple-500/10',  icon: 'text-purple-600 dark:text-purple-400',  border: 'border-purple-100 dark:border-purple-500/20' },
  }
  const c = colorMap[color] || colorMap.primary

  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted dark:text-dark-muted font-medium">{label}</p>
        <div className={`w-9 h-9 rounded-xl bg-surface dark:bg-dark-surface flex items-center justify-center shadow-sm ${c.icon}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-text dark:text-dark-text leading-none">{value}</p>
      {sub && <p className="text-xs text-muted dark:text-dark-muted mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trendLabel || `${Math.abs(trend)}%`}
        </div>
      )}
    </div>
  )
}

const TrendRow = ({ row }) => {
  const period = row.period
    ? (typeof row.period === 'string' ? row.period.slice(0, 10) : new Date(row.period).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }))
    : '-'

  return (
    <tr className="border-t border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted/60 dark:hover:bg-dark-surface-muted/60 transition-colors">
      <td className="px-5 py-3 text-sm text-muted dark:text-dark-muted">{period}</td>
      <td className="px-5 py-3 text-sm font-medium text-text dark:text-dark-text">{Number(row.orders || 0).toLocaleString()}</td>
      <td className="px-5 py-3 text-sm font-medium text-text dark:text-dark-text">₦{Number(row.revenue || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
      <td className="px-5 py-3 text-sm text-primary font-medium">₦{Number(row.commission || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
    </tr>
  )
}

export default function MerchantAnalyticsPage() {
  const { merchantId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { merchantAnalytics, analyticsLoading } = useSelector((s) => s.merchants)

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const [params, setParams] = useState({
    startDate: thirtyDaysAgo.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
    period: 'daily',
  })

  useEffect(() => {
    dispatch(fetchMerchantAnalytics({ merchantId, ...params }))
    return () => dispatch(clearMerchantAnalytics())
  }, [dispatch, merchantId]) // eslint-disable-line

  const handleRefresh = () => {
    dispatch(fetchMerchantAnalytics({ merchantId, ...params }))
  }

  const handlePeriodChange = (newParams) => {
    const updated = { ...params, ...newParams }
    setParams(updated)
    dispatch(fetchMerchantAnalytics({ merchantId, ...updated }))
  }

  const d = merchantAnalytics
  const s = d?.summary
  const m = d?.merchant

  const formatCurrency = (n) => `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`

  const PRESETS = [
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
  ]

  const applyPreset = (days) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    handlePeriodChange({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    })
  }

  return (
    <div className="bg-background dark:bg-dark-background">
      {/* Back nav */}
      <button
        onClick={() => navigate('/merchants')}
        className="flex items-center gap-2 text-sm text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text mb-5 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Merchants
      </button>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="min-w-0">
          {m ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                  <Store size={22} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text truncate">{m.name}</h1>
                  <p className="text-xs sm:text-sm text-muted dark:text-dark-muted">{m.type} · {m.commissionRate}% commission · Rating {m.averageRating?.toFixed(1) || '-'}</p>
                </div>
              </div>
            </>
          ) : (
            <h1 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text">Merchant Analytics</h1>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period presets */}
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => applyPreset(p.days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                params.endDate === today.toISOString().slice(0, 10)
                  ? 'bg-primary/10 dark:bg-primary/20 text-primary'
                  : 'bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted hover:bg-surface dark:hover:bg-dark-surface'
              }`}
            >
              Last {p.label}
            </button>
          ))}

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={params.startDate}
              onChange={(e) => handlePeriodChange({ startDate: e.target.value })}
              className="px-3 py-1.5 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface text-text dark:text-dark-text rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <span className="text-muted dark:text-dark-muted text-sm">to</span>
            <input
              type="date"
              value={params.endDate}
              onChange={(e) => handlePeriodChange({ endDate: e.target.value })}
              className="px-3 py-1.5 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface text-text dark:text-dark-text rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <select
            value={params.period}
            onChange={(e) => handlePeriodChange({ period: e.target.value })}
            className="px-3 py-1.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-surface dark:bg-dark-surface text-text dark:text-dark-text"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>

          <button
            onClick={handleRefresh}
            disabled={analyticsLoading}
            className="p-2 rounded-xl border border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={analyticsLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {analyticsLoading && !d ? (
        <div className="flex justify-center items-center py-24">
          <div className="text-center">
            <Spinner size={36} />
            <p className="text-sm text-muted dark:text-dark-muted mt-3">Loading analytics...</p>
          </div>
        </div>
      ) : !d ? (
        <div className="bg-surface dark:bg-dark-surface rounded-2xl border border-surface-muted dark:border-dark-surface-muted p-12 text-center text-muted dark:text-dark-muted">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>No analytics data available</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Orders"
              value={s.totalOrders?.toLocaleString() || '0'}
              sub={`${s.completedOrders} completed`}
              icon={<ShoppingBag size={18} />}
              color="blue"
            />
            <KPICard
              label="Total Revenue"
              value={formatCurrency(s.totalRevenue)}
              sub="Gross merchandise value"
              icon={<DollarSign size={18} />}
              color="emerald"
            />
            <KPICard
              label="Platform Commission"
              value={formatCurrency(s.platformCommission)}
              sub={`${m.commissionRate}% commission rate`}
              icon={<Percent size={18} />}
              color="primary"
            />
            <KPICard
              label="Avg Order Value"
              value={formatCurrency(s.averageOrderValue)}
              sub="Per completed order"
              icon={<TrendingUp size={18} />}
              color="purple"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Acceptance Rate"
              value={`${s.acceptanceRate}%`}
              sub="Completed ÷ total orders"
              icon={<CheckCircle size={18} />}
              color="emerald"
            />
            <KPICard
              label="Cancellation Rate"
              value={`${s.cancellationRate}%`}
              sub="Cancelled ÷ total orders"
              icon={<XCircle size={18} />}
              color="red"
            />
            <KPICard
              label="Average Rating"
              value={s.averageRating ? Number(s.averageRating).toFixed(2) : '-'}
              sub={`${s.totalRatings} ratings`}
              icon={<Star size={18} />}
              color="amber"
            />
            <KPICard
              label="Merchant Earnings"
              value={formatCurrency(s.merchantEarnings)}
              sub="After platform commission"
              icon={<Activity size={18} />}
              color="blue"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Trend table */}
            <div className="lg:col-span-2 bg-surface dark:bg-dark-surface rounded-2xl border border-surface-muted dark:border-dark-surface-muted shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-muted dark:border-dark-surface-muted flex items-center justify-between">
                <h2 className="font-semibold text-text dark:text-dark-text">Revenue Trend</h2>
                <span className="text-xs text-muted dark:text-dark-muted bg-surface-muted dark:bg-dark-surface-muted px-2 py-1 rounded-lg capitalize">{params.period}</span>
              </div>
              {d.trends?.length === 0 ? (
                <div className="py-10 text-center text-muted dark:text-dark-muted text-sm">No trend data for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-muted dark:bg-dark-surface-muted">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">Period</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">Orders</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">Revenue</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.trends?.map((row, i) => <TrendRow key={i} row={row} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent orders */}
            <div className="bg-surface dark:bg-dark-surface rounded-2xl border border-surface-muted dark:border-dark-surface-muted shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-muted dark:border-dark-surface-muted">
                <h2 className="font-semibold text-text dark:text-dark-text">Recent Orders</h2>
              </div>
              <div className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
                {d.recentOrders?.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted dark:text-dark-muted">No recent orders</p>
                ) : (
                  d.recentOrders?.map((order) => (
                    <div key={order.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-text dark:text-dark-text">
                            {order.customer?.firstName} {order.customer?.lastName}
                          </p>
                          <p className="text-xs text-muted dark:text-dark-muted mt-0.5">
                            {new Date(order.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-text dark:text-dark-text">₦{Number(order.subtotal || order.total || 0).toLocaleString()}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            order.status === 'DELIVERED' || order.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' :
                            order.status === 'CANCELLED' ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                          }`}>
                            {order.status?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Summary footer */}
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 border border-primary/10 dark:border-primary/20 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <BarChart2 size={16} className="text-white" />
              </div>
              <h3 className="font-semibold text-text dark:text-dark-text">Period Summary</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                ['Total Orders',     s.totalOrders?.toLocaleString() || '0'],
                ['Completed',         s.completedOrders?.toLocaleString() || '0'],
                ['Cancelled',         s.cancelledOrders?.toLocaleString() || '0'],
                ['Platform Earned',  formatCurrency(s.platformCommission)],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-muted dark:text-dark-muted">{label}</p>
                  <p className="font-bold text-text dark:text-dark-text">{val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
