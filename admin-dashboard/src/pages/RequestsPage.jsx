import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import {
  fetchAllRequests,
  fetchRequestStats,
  fetchRequestDetail,
  clearRequestDetail,
  reassignRider,
  forceCancelRequest,
  adminUpdateStatus,
} from '../store/slices/requestsSlice'
import { fetchCategories } from '../store/slices/categoriesSlice'
import { fetchAllRiders } from '../store/slices/ridersSlice'
import { showSuccessToast, showErrorToast } from '../utils/toast'
import api from '../lib/api'
import {
  Search, Filter, User, Store, Bike, Clock, CheckCircle, X, MapPin, Phone, Mail,
  Download, Copy, Package, TrendingUp, AlertTriangle, XCircle, RefreshCw, ArrowRight, FileText,
} from 'lucide-react'
import Pagination from '../components/Pagination'
import LiveTrackingMap from '../components/LiveTrackingMap'

const STATUS_COLORS = {
  REQUESTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ACCEPTED: 'bg-primary/10 text-primary',
  PROCESSING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  READY_FOR_PICKUP: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  RIDER_ASSIGNED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  RIDER_EN_ROUTE: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  PICKED_UP: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  DELIVERED: 'bg-success/10 text-success',
  SETTLED: 'bg-success/10 text-success',
  CANCELLED: 'bg-error/10 text-error',
}

const TERMINAL_STATUSES = ['DELIVERED', 'SETTLED', 'CANCELLED']

// Mirrors the backend FSM (utils/status.js TRANSITIONS) minus CANCELLED
// (force-cancel has its own flow) and SETTLED (settlement is automatic).
const NEXT_STATUS = {
  REQUESTED: 'ACCEPTED',
  ACCEPTED: 'PROCESSING',
  PROCESSING: 'READY_FOR_PICKUP',
  READY_FOR_PICKUP: 'RIDER_ASSIGNED',
  RIDER_ASSIGNED: 'RIDER_EN_ROUTE',
  RIDER_EN_ROUTE: 'PICKED_UP',
  PICKED_UP: 'IN_TRANSIT',
  IN_TRANSIT: 'DELIVERED',
}

const statusLabel = (status) => (status || '').replaceAll('_', ' ')

const titleCase = (value) =>
  (value || '')
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')

const naira = (value) => `₦${Number(value ?? 0).toLocaleString()}`

const ageMinutes = (dateStr) => Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))

const formatAge = (dateStr) => {
  const mins = ageMinutes(dateStr)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

const StatusBadge = ({ status }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[status] || 'bg-surface-muted text-muted'}`}>
    {statusLabel(status)}
  </span>
)

const EMPTY_FILTERS = { search: '', status: '', type: '', categorySlug: '', startDate: '', endDate: '' }

export default function RequestsPage() {
  const dispatch = useDispatch()
  const { requests, total, page, loading, stats, detail, detailLoading } = useSelector((state) => state.requests)
  const { list: categories } = useSelector((s) => s.categories)
  const { riders, loading: ridersLoading } = useSelector((s) => s.riders)

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // Filters the current result set was fetched with. Pagination, auto-refresh,
  // and export use these so half-typed filter edits don't leak into requests
  // until the admin hits Apply.
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const [pageSize, setPageSize] = useState(20)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [newRiderId, setNewRiderId] = useState('')
  const [riderSearch, setRiderSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  // The modal renders the richer detail record (timeline, package details)
  // once it lands; the table row it opened from is a good-enough placeholder.
  const view = detail && detail.id === selectedRequest?.id ? detail : selectedRequest

  const loadPage = useCallback((targetPage, targetPageSize = pageSize, targetFilters = appliedFilters) => {
    dispatch(fetchAllRequests({ page: targetPage, limit: targetPageSize, ...targetFilters }))
  }, [dispatch, pageSize, appliedFilters])

  useEffect(() => {
    dispatch(fetchAllRequests({ page: 1, limit: 20 }))
    dispatch(fetchRequestStats())
    if (categories.length === 0) dispatch(fetchCategories({ limit: 200 }))
  }, [dispatch, categories.length])

  useEffect(() => {
    if (!autoRefresh) return
    const handle = setInterval(() => {
      loadPage(page)
      dispatch(fetchRequestStats())
    }, 30000)
    return () => clearInterval(handle)
  }, [autoRefresh, dispatch, loadPage, page])

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleSearch = () => {
    setAppliedFilters(filters)
    dispatch(fetchAllRequests({ page: 1, limit: pageSize, ...filters }))
  }

  const handlePageChange = (newPage) => loadPage(newPage)

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    loadPage(1, newPageSize)
  }

  const refreshAfterAction = () => {
    loadPage(page)
    dispatch(fetchRequestStats())
  }

  const handleViewDetails = (request) => {
    setSelectedRequest(request)
    setShowDetailsModal(true)
    dispatch(fetchRequestDetail(request.id))
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedRequest(null)
    dispatch(clearRequestDetail())
  }

  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(id)
      showSuccessToast('Request ID copied')
    } catch {
      showErrorToast('Could not copy to clipboard')
    }
  }

  const openReassignModal = () => {
    setNewRiderId('')
    setRiderSearch('')
    setShowReassignModal(true)
    // The fetch is driven by the debounced effect below (fires on open with an
    // empty search, then again as the admin types).
  }

  const closeReassignModal = () => {
    setShowReassignModal(false)
    setNewRiderId('')
    setRiderSearch('')
  }

  const handleReassignRider = async () => {
    if (!newRiderId) return
    setActionLoading('reassign')
    try {
      await dispatch(reassignRider({ requestId: selectedRequest.id, newRiderId })).unwrap()
      showSuccessToast('Rider assigned')
      closeReassignModal()
      dispatch(fetchRequestDetail(selectedRequest.id))
      refreshAfterAction()
    } catch (err) {
      showErrorToast(err.message || 'Failed to reassign rider')
    } finally {
      setActionLoading(null)
    }
  }

  // Server-side rider search: debounce the query so we hit the API ~300ms
  // after the admin stops typing, not on every keystroke. Runs on modal open
  // too (empty search → first page of approved riders).
  useEffect(() => {
    if (!showReassignModal) return
    const handle = setTimeout(() => {
      dispatch(fetchAllRiders({ page: 1, limit: 50, status: 'APPROVED', search: riderSearch.trim() }))
    }, 300)
    return () => clearTimeout(handle)
  }, [dispatch, showReassignModal, riderSearch])

  const handleForceCancel = async () => {
    if (!cancelReason.trim()) return
    setActionLoading('cancel')
    try {
      await dispatch(forceCancelRequest({ requestId: selectedRequest.id, reason: cancelReason })).unwrap()
      showSuccessToast('Request cancelled - refund is queued if the customer paid by wallet')
      setShowCancelModal(false)
      setCancelReason('')
      closeDetailsModal()
      refreshAfterAction()
    } catch (err) {
      showErrorToast(err.message || 'Failed to cancel request')
    } finally {
      setActionLoading(null)
    }
  }

  const nextStatus = view && NEXT_STATUS[view.status]
  // Moving into RIDER_ASSIGNED without a rider would strand the order - the
  // Assign Rider flow sets both the rider and the status.
  const canOverride = nextStatus && !(nextStatus === 'RIDER_ASSIGNED' && !view?.rider)

  const handleStatusOverride = async () => {
    setActionLoading('override')
    try {
      await dispatch(adminUpdateStatus({
        requestId: selectedRequest.id,
        status: nextStatus,
        reason: overrideReason.trim() || 'Admin update',
      })).unwrap()
      showSuccessToast(`Status updated to ${statusLabel(nextStatus)}`)
      setShowOverrideModal(false)
      setOverrideReason('')
      dispatch(fetchRequestDetail(selectedRequest.id))
      refreshAfterAction()
    } catch (err) {
      showErrorToast(err.message || 'Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const params = Object.fromEntries(
        Object.entries(appliedFilters).filter(([, v]) => v !== '' && v != null)
      )
      const response = await api.get('/admin/requests/export', { params, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `requests-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      showSuccessToast('Export downloaded')
    } catch (err) {
      showErrorToast(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const statCards = [
    { title: 'Active requests', value: stats?.active, icon: TrendingUp },
    { title: 'Awaiting rider', value: stats?.unassigned, icon: AlertTriangle, alert: (stats?.unassigned || 0) > 0 },
    { title: 'Delivered today', value: stats?.deliveredToday, icon: Package },
    { title: 'Cancelled today', value: stats?.cancelledToday, icon: XCircle },
  ]

  const timeline = view ? [
    { label: 'Created', at: view.createdAt },
    { label: 'Accepted', at: view.acceptedAt },
    { label: 'Processing', at: view.processingAt },
    { label: 'Ready for pickup', at: view.readyAt },
    { label: 'Rider assigned', at: view.riderAssignedAt },
    { label: 'Rider en route', at: view.riderEnRouteAt },
    { label: 'Picked up', at: view.pickedUpAt },
    { label: 'In transit', at: view.inTransitAt },
    { label: 'Delivered', at: view.deliveredAt },
    { label: 'Settled', at: view.settledAt },
    { label: 'Cancelled', at: view.cancelledAt },
  ].filter((e) => e.at).sort((a, b) => new Date(a.at) - new Date(b.at)) : []

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text dark:text-dark-text">Requests</h1>
        <label className="flex items-center gap-2 text-sm text-muted dark:text-dark-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-surface-muted text-primary focus:ring-primary"
          />
          <RefreshCw size={14} className={autoRefresh ? 'animate-spin text-primary' : ''} style={autoRefresh ? { animationDuration: '3s' } : undefined} />
          Auto-refresh (30s)
        </label>
      </div>

      {/* Live workload + today's outcomes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted dark:text-dark-muted">{card.title}</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text mt-1">
                    {card.value ?? '—'}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${card.alert ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-primary/10 dark:bg-primary/20'}`}>
                  <Icon size={24} className={card.alert ? 'text-amber-600 dark:text-amber-400' : 'text-primary'} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Search by request ID, customer name, phone, email, merchant, or rider..."
              className="w-full pl-9 pr-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm dark:bg-dark-surface-muted dark:text-dark-text"
            />
          </div>
          <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center lg:justify-between gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2 sm:gap-3 flex-1">
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm w-full lg:w-auto"
              >
                <option value="">All Statuses</option>
                <option value="REQUESTED">Requested</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="PROCESSING">Processing</option>
                <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                <option value="RIDER_ASSIGNED">Rider Assigned</option>
                <option value="RIDER_EN_ROUTE">Rider en Route</option>
                <option value="PICKED_UP">Picked Up</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="DELIVERED">Delivered</option>
                <option value="SETTLED">Settled</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm w-full lg:w-auto"
              >
                <option value="">All Types</option>
                <option value="MERCHANT_ORDER">Merchant Order</option>
                <option value="PACKAGE">Package</option>
              </select>
              <select
                value={filters.categorySlug}
                onChange={(e) => handleFilterChange('categorySlug', e.target.value)}
                disabled={filters.type === 'PACKAGE'}
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none disabled:opacity-50 text-sm w-full lg:w-auto"
              >
                <option value="">All Categories</option>
                {categories.filter((c) => c.isActive).map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm w-full lg:w-auto"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm w-full lg:w-auto"
              />
              <button
                onClick={handleSearch}
                className="col-span-2 sm:col-span-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 text-sm w-full lg:w-auto"
              >
                <Filter size={16} />
                Apply
              </button>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={exporting || total === 0}
              className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm w-full lg:w-auto"
            >
              <Download size={16} />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">No requests found</p>
            <p className="text-sm mt-1">Try adjusting the search or filters above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Request ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Merchant</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Rider</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {requests.map((request) => {
                const active = !TERMINAL_STATUSES.includes(request.status)
                const mins = active ? ageMinutes(request.createdAt) : 0
                // An order sitting without a rider is the case ops needs to
                // catch - escalate the age colour as it goes stale.
                const stale = active && !request.rider && mins >= 30
                return (
                  <tr key={request.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted cursor-pointer" onClick={() => handleViewDetails(request)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono">#{request.id.slice(-8)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyId(request.id) }}
                          className="text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text"
                          title="Copy full request ID"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      {request.customer ? (
                        <Link
                          to={`/customers/${request.customer.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 hover:text-primary hover:underline"
                        >
                          <User size={16} />
                          {request.customer.firstName} {request.customer.lastName}
                        </Link>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      {titleCase(request.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={request.status} />
                        {active && (
                          <span className={`flex items-center gap-1 text-xs ${stale ? (mins >= 60 ? 'text-error' : 'text-amber-600 dark:text-amber-400') : 'text-muted dark:text-dark-muted'}`}>
                            <Clock size={12} />
                            {formatAge(request.createdAt)}
                            {stale && ' · no rider'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      {request.merchant ? (
                        <div className="flex items-center gap-2">
                          <Store size={16} />
                          <div>
                            <p>{request.merchant.name}</p>
                            {request.merchant.category && (
                              <p className="text-xs opacity-70">{request.merchant.category.name}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      {request.rider ? (
                        <div className="flex items-center gap-2">
                          <Bike size={16} />
                          {request.rider.user?.firstName} {request.rider.user?.lastName}
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                      {naira(request.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      {new Date(request.createdAt).toLocaleDateString()}{' '}
                      <span className="text-xs opacity-70">
                        {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / pageSize)}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Request Details Modal */}
      {showDetailsModal && view && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-surface-muted dark:border-dark-surface-muted flex justify-between items-center sticky top-0 bg-surface dark:bg-dark-surface z-10">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text">Request Details</h2>
                {detailLoading && <span className="text-xs text-muted dark:text-dark-muted">Refreshing…</span>}
              </div>
              <button onClick={closeDetailsModal} className="text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Request ID</p>
                  <button
                    onClick={() => copyId(view.id)}
                    className="font-medium font-mono text-text dark:text-dark-text flex items-center gap-1.5 hover:text-primary"
                    title="Copy full request ID"
                  >
                    #{view.id.slice(-8)}
                    <Copy size={14} />
                  </button>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Type</p>
                  <p className="font-medium text-text dark:text-dark-text">{titleCase(view.type)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Status</p>
                  <StatusBadge status={view.status} />
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Payment Method</p>
                  <p className="font-medium text-text dark:text-dark-text">{titleCase(view.paymentMethod) || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Total Amount</p>
                  <p className="font-medium text-text dark:text-dark-text">{naira(view.total)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Created</p>
                  <p className="font-medium text-text dark:text-dark-text">{new Date(view.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {view.status === 'CANCELLED' && (
                <div className="rounded-lg bg-error/5 border border-error/20 p-3">
                  <p className="text-sm font-semibold text-error mb-1">Cancelled {view.cancelledBy ? `by ${view.cancelledBy}` : ''}</p>
                  {view.cancellationReason && (
                    <p className="text-sm text-muted dark:text-dark-muted">{view.cancellationReason}</p>
                  )}
                  {view.cancelledAt && (
                    <p className="text-xs text-muted dark:text-dark-muted mt-1">{new Date(view.cancelledAt).toLocaleString()}</p>
                  )}
                </div>
              )}

              <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <h3 className="font-semibold text-text dark:text-dark-text mb-3">Customer Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-muted" />
                    {view.customer?.id ? (
                      <Link to={`/customers/${view.customer.id}`} className="text-primary hover:underline">
                        {view.customer.firstName} {view.customer.lastName}
                      </Link>
                    ) : (
                      <span className="text-muted dark:text-dark-muted">{view.customer?.firstName} {view.customer?.lastName}</span>
                    )}
                  </div>
                  {view.customer?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-muted" />
                      <span className="text-muted dark:text-dark-muted">{view.customer.phone}</span>
                    </div>
                  )}
                  {view.customer?.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-muted" />
                      <span className="text-muted dark:text-dark-muted">{view.customer.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {view.merchant && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Merchant Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Store size={16} className="text-muted" />
                      <span className="text-muted dark:text-dark-muted">{view.merchant.name}</span>
                    </div>
                    {view.merchant.category && (
                      <p className="text-sm text-muted dark:text-dark-muted">Category: {view.merchant.category.name}</p>
                    )}
                    {view.merchant.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-muted" />
                        <span className="text-muted dark:text-dark-muted">{view.merchant.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {view.rider && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Rider Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bike size={16} className="text-muted" />
                      <span className="text-muted dark:text-dark-muted">
                        {view.rider.user?.firstName} {view.rider.user?.lastName}
                        {view.rider.vehicleType && (
                          <span className="text-xs opacity-70"> · {titleCase(view.rider.vehicleType)}{view.rider.plateNumber ? ` · ${view.rider.plateNumber}` : ''}</span>
                        )}
                      </span>
                    </div>
                    {view.rider.user?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-muted" />
                        <span className="text-muted dark:text-dark-muted">{view.rider.user.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <h3 className="font-semibold text-text dark:text-dark-text mb-3">Location Details</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-muted mt-1" />
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">Pickup{view.pickupName ? ` · ${view.pickupName}` : ''}</p>
                      <p className="text-muted dark:text-dark-muted">{view.pickupAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-muted mt-1" />
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">Dropoff{view.dropoffName ? ` · ${view.dropoffName}` : ''}</p>
                      <p className="text-muted dark:text-dark-muted">{view.dropoffAddress}</p>
                    </div>
                  </div>
                  {(view.distanceKm || view.estimatedMinutes) && (
                    <p className="text-xs text-muted dark:text-dark-muted pl-6">
                      {view.distanceKm ? `${view.distanceKm} km` : ''}
                      {view.distanceKm && view.estimatedMinutes ? ' · ' : ''}
                      {view.estimatedMinutes ? `~${view.estimatedMinutes} min` : ''}
                    </p>
                  )}
                  {/* Live tracking - rider pin follows the request's socket
                      room while a rider is moving the package (same feed the
                      customer app's tracking screen uses). Keyed by request so
                      switching rows resets the map state. */}
                  <LiveTrackingMap
                    key={view.id}
                    requestId={view.id}
                    status={view.status}
                    pickup={{ lat: view.pickupLat, lng: view.pickupLng, label: view.pickupName || view.pickupAddress }}
                    dropoff={{ lat: view.dropoffLat, lng: view.dropoffLng, label: view.dropoffName || view.dropoffAddress }}
                  />
                </div>
              </div>

              {view.items && view.items.length > 0 && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Order Items</h3>
                  <div className="space-y-2">
                    {view.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-muted dark:text-dark-muted">{item.name} x {item.quantity}</span>
                        <span className="text-text dark:text-dark-text">{naira(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {view.packageDetails && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Package Details</h3>
                  <div className="space-y-1 text-sm text-muted dark:text-dark-muted">
                    {view.packageDetails.description && <p>{view.packageDetails.description}</p>}
                    {view.packageDetails.size && <p>Size: {titleCase(view.packageDetails.size)}</p>}
                    {view.packageDetails.recipientName && (
                      <p>Recipient: {view.packageDetails.recipientName}{view.packageDetails.recipientPhone ? ` (${view.packageDetails.recipientPhone})` : ''}</p>
                    )}
                  </div>
                </div>
              )}

              {view.prescriptionUrl && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Prescription</h3>
                  <a
                    href={view.prescriptionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText size={16} />
                    View attached prescription
                  </a>
                </div>
              )}

              {/* Phase 5 - POD card. Visible once the rider has captured at
                  least one POD artefact (photo / signature). Investigators
                  click through to the Cloudinary asset for the full-res view. */}
              {(view.podPhotoUrl || view.podSignatureUrl) ? (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Proof of Delivery</h3>
                  {view.podCapturedAt ? (
                    <p className="text-xs text-muted dark:text-dark-muted mb-3">
                      Captured {new Date(view.podCapturedAt).toLocaleString()}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    {view.podPhotoUrl ? (
                      <a
                        href={view.podPhotoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-32 rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted"
                        title="Open doorstep photo"
                      >
                        <img src={view.podPhotoUrl} alt="Doorstep" className="w-full aspect-[4/3] object-cover" loading="lazy" />
                        <span className="block px-2 py-1 text-xs text-muted dark:text-dark-muted">Photo</span>
                      </a>
                    ) : null}
                    {view.podSignatureUrl ? (
                      <a
                        href={view.podSignatureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-32 rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted"
                        title="Open signature"
                      >
                        <div className="w-full aspect-[4/3] bg-white flex items-center justify-center">
                          <img src={view.podSignatureUrl} alt="Signature" className="max-w-full max-h-full object-contain" loading="lazy" />
                        </div>
                        <span className="block px-2 py-1 text-xs text-muted dark:text-dark-muted">Signature</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <h3 className="font-semibold text-text dark:text-dark-text mb-3">Financial Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Subtotal</span>
                    <span className="text-text dark:text-dark-text">{naira(view.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Delivery Fee</span>
                    <span className="text-text dark:text-dark-text">{naira(view.deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Platform Fee</span>
                    <span className="text-text dark:text-dark-text">{naira(view.platformFee)}</span>
                  </div>
                  {Number(view.discountAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted dark:text-dark-muted">
                        Discount{view.discountCode?.code ? ` (${view.discountCode.code})` : ''}
                      </span>
                      <span className="text-success">-{naira(view.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t border-surface-muted dark:border-dark-surface-muted pt-2">
                    <span className="text-text dark:text-dark-text">Total</span>
                    <span className="text-text dark:text-dark-text">{naira(view.total)}</span>
                  </div>
                  {(Number(view.merchantEarning) > 0 || Number(view.riderEarning) > 0 || Number(view.platformEarning) > 0) && (
                    <div className="pt-2 space-y-1 text-xs text-muted dark:text-dark-muted">
                      <p className="font-medium uppercase tracking-wide">Earnings split</p>
                      <div className="flex justify-between"><span>Merchant</span><span>{naira(view.merchantEarning)}</span></div>
                      <div className="flex justify-between"><span>Rider</span><span>{naira(view.riderEarning)}</span></div>
                      <div className="flex justify-between"><span>Platform</span><span>{naira(view.platformEarning)}</span></div>
                    </div>
                  )}
                </div>
              </div>

              {timeline.length > 0 && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Timeline</h3>
                  <ol className="space-y-2">
                    {timeline.map((entry) => (
                      <li key={entry.label} className="flex items-center gap-3 text-sm">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${entry.label === 'Cancelled' ? 'bg-error' : 'bg-primary'}`} />
                        <span className="text-text dark:text-dark-text w-36">{entry.label}</span>
                        <span className="text-muted dark:text-dark-muted">{new Date(entry.at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-6 border-t border-surface-muted dark:border-dark-surface-muted flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
              {!TERMINAL_STATUSES.includes(view.status) && (
                <>
                  {canOverride && (
                    <button
                      onClick={() => { setOverrideReason(''); setShowOverrideModal(true) }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors w-full sm:w-auto flex items-center justify-center gap-2"
                    >
                      Mark as {statusLabel(nextStatus)}
                      <ArrowRight size={16} />
                    </button>
                  )}
                  <button
                    onClick={openReassignModal}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors w-full sm:w-auto"
                  >
                    {view.rider ? 'Reassign Rider' : 'Assign Rider'}
                  </button>
                  <button
                    onClick={() => { setShowCancelModal(true) }}
                    className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/80 transition-colors w-full sm:w-auto"
                  >
                    Force Cancel
                  </button>
                </>
              )}
              <button
                onClick={closeDetailsModal}
                className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted transition-colors w-full sm:w-auto sm:ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Override Modal */}
      {showOverrideModal && view && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text mb-4">Update Status</h2>
            <div className="flex items-center justify-center gap-3 mb-4">
              <StatusBadge status={view.status} />
              <ArrowRight size={16} className="text-muted" />
              <StatusBadge status={nextStatus} />
            </div>
            <p className="text-sm text-muted dark:text-dark-muted mb-3">
              This override follows the normal lifecycle - the customer is notified, and any
              downstream automation (rider matching, settlement) runs as usual.
            </p>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 dark:bg-dark-surface-muted dark:text-dark-text"
              rows="2"
              placeholder="Reason (optional, recorded in the audit log)..."
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleStatusOverride}
                disabled={actionLoading === 'override'}
                className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading === 'override' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Confirm Update'
                )}
              </button>
              <button
                onClick={() => { setShowOverrideModal(false); setOverrideReason('') }}
                className="w-full sm:w-auto px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text mb-4">Cancel Request</h2>
            <p className="text-muted dark:text-dark-muted mb-4">
              Please provide a reason for cancelling this request. Wallet payments are
              refunded automatically; the reason is recorded in the audit log.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 dark:bg-dark-surface-muted dark:text-dark-text"
              rows="3"
              placeholder="Enter cancellation reason..."
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleForceCancel}
                disabled={!cancelReason.trim() || actionLoading === 'cancel'}
                className="w-full sm:w-auto px-4 py-2 bg-error text-white rounded-lg hover:bg-error/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading === 'cancel' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancel'
                )}
              </button>
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason('') }}
                className="w-full sm:w-auto px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Rider Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text mb-4">
              {view?.rider ? 'Reassign Rider' : 'Assign Rider'}
            </h2>
            <p className="text-muted dark:text-dark-muted mb-3">Select a rider to take over this delivery:</p>

            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={riderSearch}
                onChange={(e) => setRiderSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                placeholder="Search by name or phone..."
              />
            </div>

            <div className="max-h-64 overflow-y-auto border border-surface-muted dark:border-dark-surface-muted rounded-lg divide-y divide-surface-muted dark:divide-dark-surface-muted mb-4">
              {ridersLoading ? (
                <div className="p-6 text-center text-sm text-muted dark:text-dark-muted">Loading riders...</div>
              ) : riders.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted dark:text-dark-muted">
                  {riderSearch.trim() ? 'No riders match your search' : 'No approved riders found'}
                </div>
              ) : (
                riders.map((rider) => {
                  const isSelected = newRiderId === rider.id
                  const isCurrent = view?.rider?.id === rider.id
                  return (
                    <button
                      key={rider.id}
                      type="button"
                      onClick={() => setNewRiderId(rider.id)}
                      disabled={isCurrent}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bike size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text dark:text-dark-text truncate">
                          {rider.user?.firstName} {rider.user?.lastName}
                          {isCurrent && <span className="ml-2 text-xs text-muted">(current)</span>}
                        </p>
                        <p className="text-xs text-muted dark:text-dark-muted truncate">{rider.user?.phone || '-'}</p>
                      </div>
                      <span className={`text-xs font-medium shrink-0 ${rider.availability === 'ONLINE' ? 'text-success' : 'text-muted'}`}>
                        {(rider.availability || 'OFFLINE').replaceAll('_', ' ')}
                      </span>
                      {isSelected && <CheckCircle size={18} className="text-primary shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleReassignRider}
                disabled={!newRiderId || actionLoading === 'reassign'}
                className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading === 'reassign' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
              <button
                onClick={closeReassignModal}
                className="w-full sm:w-auto px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
