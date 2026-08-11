import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  fetchAllRiders, fetchPendingRiders, fetchRiderStats,
  fetchRiderEarnings, fetchRiderDeliveryHistory,
  fetchRiderTransactions, fetchRiderTransactionReceipt, clearRiderTransactionReceipt,
  reviewRider, suspendRider, unsuspendRider, forceOfflineRider, resetRiderPin,
  updateRiderAccount, fetchRiderLocation,
  setSelectedRider, clearSelectedRider,
} from '../store/slices/ridersSlice'
import { TransactionReceiptModal } from './CustomerDetailPage'
import { exportToCSV } from '../lib/exportToCSV'
import Pagination from '../components/Pagination'
import ActionMenu from '../components/ActionMenu'
import api from '../lib/api'
import {
  Bike, Search, Eye, Check, X, Clock, Phone, Mail, Star, Package, MapPin,
  Power, ShieldCheck, Ban, FileText, ExternalLink, AlertTriangle, User,
  Calendar, DollarSign, CheckCircle, Hash, Truck, Download, Users, Wifi, KeyRound, Pencil, TrendingUp,
} from 'lucide-react'

// ── Design tokens (mirrors MerchantsPage kit so the two pages match) ──────────

// Light-mode text bumped to -800 (vs -700) so every badge clears WCAG AA 4.5:1
// on its pale -100 background; dark-mode halves use -300 on -900/30.
const STATUS_META = {
  PENDING_APPROVAL: { label: 'Pending', cls: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50', dot: 'bg-amber-500' },
  APPROVED:         { label: 'Active',   cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50', dot: 'bg-emerald-500' },
  SUSPENDED:        { label: 'Suspended', cls: 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50', dot: 'bg-red-500' },
  REJECTED:         { label: 'Rejected', cls: 'bg-surface-muted text-muted border border-surface-muted dark:bg-dark-surface-muted dark:text-dark-muted dark:border-dark-surface-muted', dot: 'bg-gray-400 dark:bg-dark-muted' },
}

const AVAIL_META = {
  ONLINE:      { label: 'Online',      cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500' },
  ON_DELIVERY: { label: 'On delivery', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
  OFFLINE:     { label: 'Offline',     cls: 'bg-surface-muted text-muted dark:bg-dark-surface-muted dark:text-dark-muted', dot: 'bg-gray-400 dark:bg-dark-muted' },
}

const TABS = [
  { id: 'all', label: 'All Riders', icon: Bike },
  { id: 'pending', label: 'Pending Approvals', icon: Clock },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
]

const naira = (v) => `₦${Number(v || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`
const fullName = (r) => `${r?.user?.firstName || ''} ${r?.user?.lastName || ''}`.trim() || 'Unnamed rider'
const maskNin = (nin) => (nin ? `••• ••• ${String(nin).slice(-4)}` : null)

// The live truth for a rider's presence is the heartbeat (`liveOnline` from the
// API), NOT the sticky DB `availability` flag, which lags the reconcile sweep by
// up to a couple of minutes and is what made an online rider read "Offline"
// here. Show ON_DELIVERY only when the rider is both live and on a delivery;
// otherwise ONLINE when live, OFFLINE when not. Fall back to the DB flag only
// when `liveOnline` isn't present (e.g. the pending list, which never enriches).
const effectiveAvailability = (r) => {
  if (r?.liveOnline === true) return r.availability === 'ON_DELIVERY' ? 'ON_DELIVERY' : 'ONLINE'
  if (r?.liveOnline === false) return 'OFFLINE'
  return r?.availability || 'OFFLINE'
}

const Spinner = ({ size = 16, cls = 'border-white' }) => (
  <span className={`inline-block border-2 ${cls} border-t-transparent rounded-full animate-spin`} style={{ width: size, height: size }} />
)

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { label: status, cls: 'bg-surface-muted text-muted border border-surface-muted dark:bg-dark-surface-muted dark:text-dark-muted dark:border-dark-surface-muted', dot: 'bg-gray-400 dark:bg-dark-muted' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

const AvailabilityBadge = ({ availability }) => {
  const m = AVAIL_META[availability] || AVAIL_META.OFFLINE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${availability === 'ONLINE' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  )
}

const Modal = ({ open, onClose, title, children, maxW = 'max-w-lg' }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative bg-surface dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${maxW} max-h-[95vh] sm:max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-surface-muted dark:border-dark-surface-muted sticky top-0 bg-surface dark:bg-dark-surface z-10">
          <h2 className="text-base sm:text-lg font-bold text-text dark:text-dark-text truncate pr-2">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5">{children}</div>
      </div>
    </div>
  )
}

const FormField = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-text dark:text-dark-text mb-1.5">{label}</label>
    {children}
  </div>
)

const Textarea = ({ className = '', ...props }) => (
  <textarea
    className={`w-full px-3.5 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted dark:placeholder:text-dark-muted resize-none ${className}`}
    {...props}
  />
)

const Select = ({ className = '', ...props }) => (
  <select
    className={`w-full px-3.5 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${className}`}
    {...props}
  />
)

const Btn = ({ variant = 'primary', size = 'md', loading, children, className = '', ...props }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-sm' }
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-700 shadow-sm hover:shadow',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
    ghost: 'bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted/70 dark:hover:bg-dark-surface-muted/70',
    outline: 'border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner size={14} cls={variant === 'ghost' || variant === 'outline' ? 'border-text dark:border-dark-text' : 'border-white'} /> : null}
      {children}
    </button>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="text-muted dark:text-dark-muted mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted dark:text-dark-muted">{label}</p>
        <p className="text-sm text-text dark:text-dark-text break-words">{value || '-'}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, accent = 'text-text dark:text-dark-text' }) {
  return (
    <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-3 text-center">
      <div className="flex justify-center mb-1 text-muted dark:text-dark-muted">{icon}</div>
      <p className={`font-bold text-lg leading-none ${accent}`}>{value}</p>
      <p className="text-xs text-muted dark:text-dark-muted mt-0.5">{label}</p>
    </div>
  )
}

const Avatar = ({ size = 40 }) => (
  <div className="rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
    <Bike size={size * 0.45} className="text-primary" />
  </div>
)

// Document expiry → badge metadata. Premium KYC signal nobody surfaced before.
function expiryMeta(date) {
  if (!date) return null
  const d = new Date(date)
  const days = Math.ceil((d - Date.now()) / 86400000)
  if (days < 0) return { label: 'Expired', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
  if (days <= 30) return { label: `Expires in ${days}d`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
  return { label: `Valid · ${d.toLocaleDateString()}`, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
}

function DocCard({ label, url, expiresAt, fallbackText }) {
  const exp = expiryMeta(expiresAt)
  return (
    <div className="border border-surface-muted dark:border-dark-surface-muted rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text dark:text-dark-text flex items-center gap-2">
          <FileText size={15} className="text-muted dark:text-dark-muted" /> {label}
        </span>
        {exp && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${exp.cls}`}>{exp.label}</span>}
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="group block rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted bg-surface-muted dark:bg-dark-surface-muted">
          <img src={url} alt={label} loading="lazy" className="w-full h-28 object-cover group-hover:opacity-90 transition-opacity" />
          <span className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-primary font-medium">
            <ExternalLink size={13} /> Open document
          </span>
        </a>
      ) : (
        <div className="h-28 rounded-lg border border-dashed border-surface-muted dark:border-dark-surface-muted flex items-center justify-center text-xs text-muted dark:text-dark-muted">
          {fallbackText || 'Not uploaded'}
        </div>
      )}
    </div>
  )
}

// ── KPI cards ─────────────────────────────────────────────────────────────

function KpiCards({ stats, onPendingClick }) {
  const cards = [
    { key: 'total', label: 'Total Riders', value: stats?.total ?? 0, icon: <Users size={18} className="text-primary" />, bg: 'bg-primary/5', sub: `${stats?.online ?? 0} online now` },
    { key: 'approved', label: 'Active', value: stats?.approved ?? 0, icon: <ShieldCheck size={18} className="text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { key: 'pending', label: 'Pending Review', value: stats?.pending ?? 0, icon: <Clock size={18} className="text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-900/20', action: onPendingClick },
    { key: 'suspended', label: 'Suspended', value: stats?.suspended ?? 0, icon: <Ban size={18} className="text-red-500" />, bg: 'bg-red-50 dark:bg-red-900/20' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {cards.map((c) => (
        <button
          key={c.key}
          onClick={c.action}
          disabled={!c.action}
          className={`${c.bg} rounded-2xl p-4 text-left flex items-center gap-3 transition-shadow ${c.action ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
        >
          <span className="w-10 h-10 bg-surface dark:bg-dark-surface rounded-xl flex items-center justify-center shadow-sm shrink-0">{c.icon}</span>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text leading-none truncate">{c.value}</p>
            <p className="text-xs text-muted dark:text-dark-muted truncate mt-1">{c.label}</p>
            {c.sub && <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">{c.sub}</p>}
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Row action set (shared by table row + mobile card) ───────────────────────

function RowActions({ rider, actionLoading, onView, onReview, onSuspend, onUnsuspend, onForceOffline, compact }) {
  const busy = actionLoading === rider.id
  if (compact) {
    // Mobile: labeled small buttons
    return (
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" variant="outline" onClick={() => onView(rider)}><Eye size={14} /> View</Btn>
        {rider.status === 'PENDING_APPROVAL' && (
          <>
            <Btn size="sm" variant="success" loading={busy} onClick={() => onReview(rider, 'approve')}><Check size={14} /> Approve</Btn>
            <Btn size="sm" variant="danger" loading={busy} onClick={() => onReview(rider, 'reject')}><X size={14} /> Reject</Btn>
          </>
        )}
        {rider.status === 'APPROVED' && (
          <Btn size="sm" variant="danger" onClick={() => onSuspend(rider)}><Ban size={14} /> Suspend</Btn>
        )}
        {rider.status === 'SUSPENDED' && (
          <Btn size="sm" variant="success" loading={busy} onClick={() => onUnsuspend(rider)}><ShieldCheck size={14} /> Unsuspend</Btn>
        )}
        {rider.availability !== 'OFFLINE' && rider.status === 'APPROVED' && (
          <Btn size="sm" variant="warning" onClick={() => onForceOffline(rider)}><Power size={14} /> Offline</Btn>
        )}
      </div>
    )
  }
  return (
    <div className="flex">
      <ActionMenu
        align="left"
        actions={[
          { label: 'View details', icon: Eye, onClick: () => onView(rider) },
          {
            label: 'Approve',
            icon: Check,
            disabled: busy,
            hidden: rider.status !== 'PENDING_APPROVAL',
            onClick: () => onReview(rider, 'approve'),
          },
          {
            label: 'Reject',
            icon: X,
            danger: true,
            disabled: busy,
            hidden: rider.status !== 'PENDING_APPROVAL',
            onClick: () => onReview(rider, 'reject'),
          },
          {
            label: 'Force offline',
            icon: Power,
            hidden: !(rider.status === 'APPROVED' && rider.availability !== 'OFFLINE'),
            onClick: () => onForceOffline(rider),
          },
          {
            label: 'Suspend',
            icon: Ban,
            danger: true,
            hidden: rider.status !== 'APPROVED',
            onClick: () => onSuspend(rider),
          },
          {
            label: 'Unsuspend',
            icon: ShieldCheck,
            disabled: busy,
            hidden: rider.status !== 'SUSPENDED',
            onClick: () => onUnsuspend(rider),
          },
        ]}
      />
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RidersPage() {
  const dispatch = useDispatch()
  const {
    riders, total, page, loading,
    pending, pendingTotal, pendingLoading,
    stats, selectedRider, riderEarnings, riderDeliveries,
    riderTransactions, transactionReceipt,
  } = useSelector((s) => s.riders)

  // Honour the dashboard deep-link /riders?status=PENDING_APPROVAL → open the
  // Pending tab; any other status pre-seeds the All-tab status filter.
  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status') || ''
  const [activeTab, setActiveTab] = useState(initialStatus === 'PENDING_APPROVAL' ? 'pending' : 'all')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: initialStatus === 'PENDING_APPROVAL' ? '' : initialStatus, availability: '' })
  const [pageSize, setPageSize] = useState(20)
  const [drawerTab, setDrawerTab] = useState('profile')
  const [actionLoading, setActionLoading] = useState(null)
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [offlineTarget, setOfflineTarget] = useState(null)
  const [offlineReason, setOfflineReason] = useState('')
  const [resetPinTarget, setResetPinTarget] = useState(null)
  const [resetPinReason, setResetPinReason] = useState('')
  const [editAccountTarget, setEditAccountTarget] = useState(null)
  const [performance, setPerformance] = useState([])
  const [performanceLoading, setPerformanceLoading] = useState(false)

  // Stats once on mount.
  useEffect(() => { dispatch(fetchRiderStats()) }, [dispatch])

  // All-riders list: debounced server-side search + filters (reset to page 1).
  useEffect(() => {
    const handle = setTimeout(() => {
      dispatch(fetchAllRiders({ page: 1, limit: pageSize, ...filters, search: search.trim() }))
    }, 300)
    return () => clearTimeout(handle)
  }, [dispatch, search, filters, pageSize])

  // Pending queue loads when its tab is first opened (and stays fresh on review).
  useEffect(() => {
    if (activeTab === 'pending') dispatch(fetchPendingRiders({ page: 1, limit: 50 }))
  }, [dispatch, activeTab])

  // Performance leaderboard - fetched on first open of the tab, not polled.
  useEffect(() => {
    if (activeTab !== 'performance') return
    setPerformanceLoading(true)
    api.get('/admin/riders/performance')
      .then((res) => setPerformance(res.data?.data || []))
      .catch((err) => console.error('Failed to fetch rider performance:', err))
      .finally(() => setPerformanceLoading(false))
  }, [activeTab])

  const openDrawer = (rider) => {
    dispatch(setSelectedRider(rider))
    setDrawerTab('profile')
    dispatch(fetchRiderEarnings({ riderId: rider.id }))
    dispatch(fetchRiderDeliveryHistory({ riderId: rider.id, page: 1, limit: 20 }))
    dispatch(fetchRiderTransactions({ riderId: rider.id, page: 1, limit: 20 }))
  }
  const closeDrawer = () => dispatch(clearSelectedRider())

  const handleReview = async (rider, decision) => {
    if (decision === 'reject') { setRejectTarget(rider); return }
    setActionLoading(rider.id)
    await dispatch(reviewRider({ riderId: rider.id, decision }))
    setActionLoading(null)
  }

  const confirmReject = async () => {
    if (!rejectTarget) return
    setActionLoading(rejectTarget.id)
    const r = await dispatch(reviewRider({ riderId: rejectTarget.id, decision: 'reject' }))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') { setRejectTarget(null); if (selectedRider?.id === rejectTarget.id) closeDrawer() }
  }

  const handleUnsuspend = async (rider) => {
    setActionLoading(rider.id)
    const r = await dispatch(unsuspendRider({ riderId: rider.id }))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') toast.success('Rider reinstated - wallet unlocked')
    else toast.error(r.error?.message || 'Failed to unsuspend')
  }

  const confirmSuspend = async () => {
    if (!suspendReason.trim()) return
    setActionLoading('suspend')
    const r = await dispatch(suspendRider({ riderId: suspendTarget.id, reason: suspendReason }))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Rider suspended - wallet locked')
      setSuspendTarget(null); setSuspendReason('')
    } else toast.error(r.error?.message || 'Failed to suspend')
  }

  const confirmForceOffline = async () => {
    setActionLoading('offline')
    const r = await dispatch(forceOfflineRider({ riderId: offlineTarget.id, reason: offlineReason.trim() || undefined }))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Rider taken offline')
      setOfflineTarget(null); setOfflineReason('')
    } else toast.error(r.error?.message || 'Failed to take rider offline')
  }

  const confirmResetPin = async () => {
    setActionLoading('resetPin')
    const r = await dispatch(resetRiderPin({ riderId: resetPinTarget.id, reason: resetPinReason.trim() || undefined }))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success("Rider's PIN reset - they'll set a new one on their next transaction")
      setResetPinTarget(null); setResetPinReason('')
    } else toast.error(r.error?.message || 'Failed to reset PIN')
  }

  const confirmEditAccount = async (changes) => {
    setActionLoading('editAccount')
    const r = await dispatch(updateRiderAccount({ riderId: editAccountTarget.id, changes }))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Rider account updated')
      setEditAccountTarget(null)
    } else toast.error(r.payload || r.error?.message || 'Failed to update account')
  }

  const handleExportCSV = () => {
    const rows = riders.map((r) => ({
      id: r.id,
      name: fullName(r),
      email: r.user?.email || '',
      phone: r.user?.phone || '',
      vehicleType: r.vehicleType,
      plateNumber: r.plateNumber,
      status: r.status,
      availability: r.availability,
      rating: r.averageRating,
      deliveries: r.totalDeliveries,
      totalEarnings: r.totalEarnings,
    }))
    exportToCSV(rows, 'riders', ['id', 'name', 'email', 'phone', 'vehicleType', 'plateNumber', 'status', 'availability', 'rating', 'deliveries', 'totalEarnings'])
  }

  const pendingBadge = stats?.pending ?? pendingTotal ?? 0

  const rowActionProps = {
    actionLoading,
    onView: openDrawer,
    onReview: handleReview,
    onSuspend: (r) => setSuspendTarget(r),
    onUnsuspend: handleUnsuspend,
    onForceOffline: (r) => setOfflineTarget(r),
  }

  return (
    <div className="min-h-screen bg-background dark:bg-dark-background">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Riders Management</h1>
        <p className="text-sm text-muted dark:text-dark-muted mt-1">Roster, KYC documents, earnings and account lifecycle for every rider</p>
      </div>

      <KpiCards stats={stats} onPendingClick={() => setActiveTab('pending')} />

      <div className="bg-surface dark:bg-dark-surface rounded-2xl shadow-sm border border-surface-muted dark:border-dark-surface-muted overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3 sm:px-5 py-3 sm:py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${isActive ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted'}`}
              >
                <Icon size={16} />
                {t.label}
                {t.id === 'pending' && pendingBadge > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-amber-500 text-white text-xs font-bold rounded-full">
                    {pendingBadge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {activeTab === 'all' && (
          <>
            {/* Search + filters */}
            <div className="p-4 border-b border-surface-muted dark:border-dark-surface-muted space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-9 pr-4 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 sm:gap-3 lg:items-center">
                <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="text-sm w-full lg:w-44">
                  <option value="">All Statuses</option>
                  <option value="PENDING_APPROVAL">Pending</option>
                  <option value="APPROVED">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
                <Select value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value })} className="text-sm w-full lg:w-44">
                  <option value="">All Availability</option>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="ON_DELIVERY">On delivery</option>
                </Select>
                <div className="flex flex-wrap gap-2 lg:ml-auto col-span-full">
                  <Btn variant="outline" className="flex-1 lg:flex-none" onClick={handleExportCSV} disabled={riders.length === 0}>
                    <Download size={16} /> Export
                  </Btn>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-16"><Spinner size={32} cls="border-primary" /></div>
            ) : riders.length === 0 ? (
              <div className="text-center py-16 text-muted dark:text-dark-muted">
                <Bike size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No riders found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-muted dark:bg-dark-surface-muted text-left">
                        {['Rider', 'Contact', 'Vehicle', 'Status', 'Availability', 'Rating', 'Deliveries', 'Actions'].map((h) => (
                          <th key={h} className="px-5 py-3.5 text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {riders.map((r) => (
                        <tr key={r.id} className="border-t border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted/80 dark:hover:bg-dark-surface-muted/80 transition-colors group">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => openDrawer(r)}>
                              <Avatar />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-text dark:text-dark-text truncate group-hover:text-primary transition-colors">{fullName(r)}</p>
                                <p className="text-xs text-muted dark:text-dark-muted truncate">{r.user?.email || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-muted dark:text-dark-muted">{r.user?.phone || '-'}</td>
                          <td className="px-5 py-4 text-sm">
                            <p className="text-text dark:text-dark-text capitalize">{(r.vehicleType || '').toLowerCase() || '-'}</p>
                            <p className="text-xs text-muted dark:text-dark-muted">{r.plateNumber || '-'}</p>
                          </td>
                          <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                          <td className="px-5 py-4"><AvailabilityBadge availability={effectiveAvailability(r)} /></td>
                          <td className="px-5 py-4 text-sm text-text dark:text-dark-text">
                            <span className="flex items-center gap-1">
                              <Star size={13} className="text-amber-400 fill-amber-400" />
                              {r.averageRating?.toFixed(1) || '-'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-text dark:text-dark-text">{r.totalDeliveries || 0}</td>
                          <td className="px-5 py-4"><RowActions rider={r} {...rowActionProps} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="lg:hidden divide-y divide-surface-muted dark:divide-dark-surface-muted">
                  {riders.map((r) => (
                    <div key={r.id} className="p-4">
                      <div className="flex items-start gap-3 cursor-pointer" onClick={() => openDrawer(r)}>
                        <Avatar />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text dark:text-dark-text truncate">{fullName(r)}</p>
                          <p className="text-xs text-muted dark:text-dark-muted truncate flex items-center gap-1"><Phone size={11} /> {r.user?.phone || '-'}</p>
                          <p className="text-xs text-muted dark:text-dark-muted truncate capitalize flex items-center gap-1"><Truck size={11} /> {(r.vehicleType || '').toLowerCase()} · {r.plateNumber || '-'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <StatusBadge status={r.status} />
                          <AvailabilityBadge availability={effectiveAvailability(r)} />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted dark:text-dark-muted">
                        <span className="flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400" /> {r.averageRating?.toFixed(1) || '-'}</span>
                        <span className="flex items-center gap-1"><Package size={12} /> {r.totalDeliveries || 0} deliveries</span>
                      </div>
                      <div className="mt-3">
                        <RowActions rider={r} {...rowActionProps} compact />
                      </div>
                    </div>
                  ))}
                </div>

                {total > 0 && (
                  <div className="p-4">
                    <Pagination
                      currentPage={page}
                      totalPages={Math.ceil(total / pageSize)}
                      totalItems={total}
                      pageSize={pageSize}
                      onPageChange={(p) => dispatch(fetchAllRiders({ page: p, limit: pageSize, ...filters, search: search.trim() }))}
                      onPageSizeChange={(s) => setPageSize(s)}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'pending' && (
          <div className="p-4">
            {pendingLoading ? (
              <div className="flex justify-center items-center py-16"><Spinner size={32} cls="border-primary" /></div>
            ) : pending.length === 0 ? (
              <div className="text-center py-16 text-muted dark:text-dark-muted">
                <CheckCircle size={40} className="mx-auto mb-3 opacity-30 text-emerald-500" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm mt-1">No rider applications pending review</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-surface-muted dark:border-dark-surface-muted shadow-sm overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar size={44} />
                        <div className="min-w-0">
                          <p className="font-semibold text-text dark:text-dark-text truncate">{fullName(r)}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted dark:text-dark-muted mt-0.5">
                            <span className="flex items-center gap-1"><Phone size={11} /> {r.user?.phone || '-'}</span>
                            <span className="flex items-center gap-1 capitalize"><Truck size={11} /> {(r.vehicleType || '').toLowerCase()} · {r.plateNumber || '-'}</span>
                            <span className="flex items-center gap-1"><Calendar size={11} /> Applied {new Date(r.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Btn size="sm" variant="outline" onClick={() => openDrawer(r)}><FileText size={14} /> Documents</Btn>
                        <Btn size="sm" variant="success" loading={actionLoading === r.id} onClick={() => handleReview(r, 'approve')}><Check size={14} /> Approve</Btn>
                        <Btn size="sm" variant="danger" onClick={() => setRejectTarget(r)}><X size={14} /> Reject</Btn>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="overflow-x-auto">
            {performanceLoading ? (
              <div className="flex justify-center items-center py-16"><Spinner size={32} cls="border-primary" /></div>
            ) : (
              <table className="w-full min-w-[720px]">
                <thead className="bg-surface-muted dark:bg-dark-surface-muted text-left">
                  <tr>
                    {['Rider', 'Email', 'Deliveries', 'Rating', 'Earnings', 'Availability'].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {performance.map((rider, i) => (
                    <tr key={rider.id} className="border-t border-surface-muted dark:border-dark-surface-muted">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-xs font-bold text-muted dark:text-dark-muted">#{i + 1}</span>
                          <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Bike size={15} className="text-primary" /></span>
                          <span className="text-sm font-medium text-text dark:text-dark-text">{rider.user?.firstName} {rider.user?.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted dark:text-dark-muted">{rider.user?.email}</td>
                      <td className="px-4 py-3 text-sm text-text dark:text-dark-text">
                        <span className="flex items-center gap-1"><Package size={13} className="text-muted dark:text-dark-muted" /> {rider.totalDeliveries || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text dark:text-dark-text">
                        <span className="flex items-center gap-1"><Star size={13} className="text-amber-400 fill-amber-400" /> {rider.averageRating?.toFixed(1) || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text dark:text-dark-text">{naira(rider.totalEarnings)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${(AVAIL_META[rider.availability] || AVAIL_META.OFFLINE).cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${(AVAIL_META[rider.availability] || AVAIL_META.OFFLINE).dot}`} />
                          {(AVAIL_META[rider.availability] || AVAIL_META.OFFLINE).label}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {performance.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted dark:text-dark-muted">No approved riders found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <RiderDrawer
        rider={selectedRider}
        earnings={riderEarnings}
        deliveries={riderDeliveries}
        transactions={riderTransactions}
        onTxClick={(t) => selectedRider && dispatch(fetchRiderTransactionReceipt({ riderId: selectedRider.id, transactionId: t.id }))}
        tab={drawerTab}
        setTab={setDrawerTab}
        actionLoading={actionLoading}
        onClose={closeDrawer}
        onReview={handleReview}
        onSuspend={(r) => setSuspendTarget(r)}
        onUnsuspend={handleUnsuspend}
        onForceOffline={(r) => setOfflineTarget(r)}
        onResetPin={(r) => setResetPinTarget(r)}
        onEditAccount={(r) => setEditAccountTarget(r)}
      />

      {/* Transaction receipt - mirrors the in-app receipt the rider sees */}
      {transactionReceipt.data && (
        <TransactionReceiptModal
          tx={transactionReceipt.data}
          loading={transactionReceipt.loading}
          onClose={() => dispatch(clearRiderTransactionReceipt())}
          onRefunded={() => selectedRider && dispatch(fetchRiderTransactions({ riderId: selectedRider.id, page: riderTransactions.page, limit: riderTransactions.limit }))}
        />
      )}

      {/* Suspend (reason required) */}
      <Modal open={!!suspendTarget} onClose={() => { setSuspendTarget(null); setSuspendReason('') }} title={`Suspend - ${suspendTarget ? fullName(suspendTarget) : ''}`}>
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 flex gap-3">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">The rider's wallet will be locked and they won't be able to accept new deliveries until reinstated.</p>
          </div>
          <FormField label="Suspension reason (required)">
            <Textarea rows={4} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Describe why this rider is being suspended and what's needed to lift it..." />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => { setSuspendTarget(null); setSuspendReason('') }}>Cancel</Btn>
            <Btn variant="warning" loading={actionLoading === 'suspend'} disabled={!suspendReason.trim()} onClick={confirmSuspend}><Ban size={15} /> Suspend Rider</Btn>
          </div>
        </div>
      </Modal>

      {/* Reject confirm (no reason stored backend-side) */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title={`Reject application - ${rejectTarget ? fullName(rejectTarget) : ''}`}>
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 flex gap-3">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">This marks the application as <strong>Rejected</strong>. The rider will not be able to go online. You can still re-review them later from the database.</p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Btn>
            <Btn variant="danger" loading={actionLoading === rejectTarget?.id} onClick={confirmReject}><X size={15} /> Reject</Btn>
          </div>
        </div>
      </Modal>

      {/* Force offline (optional reason) */}
      <Modal open={!!offlineTarget} onClose={() => { setOfflineTarget(null); setOfflineReason('') }} title={`Take offline - ${offlineTarget ? fullName(offlineTarget) : ''}`}>
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 flex gap-3">
            <Power size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">The rider is flipped to <strong>Offline</strong> and removed from dispatch immediately. They can go back online themselves unless also suspended.</p>
          </div>
          <FormField label="Reason (optional - sent to the rider)">
            <Textarea rows={3} value={offlineReason} onChange={(e) => setOfflineReason(e.target.value)} placeholder="e.g. End of shift, suspected device issue..." />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => { setOfflineTarget(null); setOfflineReason('') }}>Cancel</Btn>
            <Btn variant="warning" loading={actionLoading === 'offline'} onClick={confirmForceOffline}><Power size={15} /> Take Offline</Btn>
          </div>
        </div>
      </Modal>

      {/* Reset PIN (clears it; rider sets a fresh one in-app) */}
      <Modal open={!!resetPinTarget} onClose={() => { setResetPinTarget(null); setResetPinReason('') }} title={`Reset PIN - ${resetPinTarget ? fullName(resetPinTarget) : ''}`}>
        <div className="space-y-4">
          <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-4 flex gap-3">
            <KeyRound size={18} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted dark:text-dark-muted">
              This clears the rider's transaction PIN. They'll be prompted to set a new one on their next transaction. You won't see or choose it. Audit-logged.
            </p>
          </div>
          <FormField label="Reason (optional)">
            <Textarea rows={2} value={resetPinReason} onChange={(e) => setResetPinReason(e.target.value)} placeholder="e.g. rider reported forgotten PIN" />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => { setResetPinTarget(null); setResetPinReason('') }}>Cancel</Btn>
            <Btn variant="danger" loading={actionLoading === 'resetPin'} onClick={confirmResetPin}><KeyRound size={15} /> Reset PIN</Btn>
          </div>
        </div>
      </Modal>

      {/* Edit rider account identity (login email / name / phone) */}
      <EditRiderAccountModal
        rider={editAccountTarget}
        saving={actionLoading === 'editAccount'}
        onClose={() => setEditAccountTarget(null)}
        onSave={confirmEditAccount}
      />
    </div>
  )
}

// ── Edit rider account (login email / name / phone) ──────────────────────────
// Riders can't change their own email/phone in-app (login credentials), so this
// is the admin-side correction path. A reason is required when email or phone
// changes, mirroring the customer edit flow, and the change is audit-logged
// server-side. Only changed fields are sent.

const ACCOUNT_INPUT_CLS =
  'w-full px-3.5 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted dark:placeholder:text-dark-muted'

function EditRiderAccountModal({ rider, saving, onClose, onSave }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (rider) {
      setForm({
        firstName: rider.user?.firstName || '',
        lastName: rider.user?.lastName || '',
        email: rider.user?.email || '',
        phone: rider.user?.phone || '',
      })
      setReason('')
      setError('')
    }
  }, [rider])

  if (!rider) return null
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    const changes = {}
    for (const k of ['firstName', 'lastName', 'email', 'phone']) {
      const next = form[k].trim()
      const prev = rider.user?.[k] || ''
      if (next !== prev) changes[k] = next
    }
    if (Object.keys(changes).length === 0) { setError('No changes to save.'); return }
    const sensitiveChanged = 'email' in changes || 'phone' in changes
    if (sensitiveChanged && !reason.trim()) {
      setError('A reason is required when changing the email or phone.')
      return
    }
    if (reason.trim()) changes.reason = reason.trim()
    onSave(changes)
  }

  return (
    <Modal open={!!rider} onClose={onClose} title={`Edit account - ${fullName(rider)}`}>
      <div className="space-y-4">
        <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-4 flex gap-3">
          <Mail size={18} className="text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted dark:text-dark-muted">
            Riders can't change their own email or phone in the app - update it here on their behalf.
            Changing the email or phone signs the rider out of their current sessions and is audit-logged.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="First name">
            <input className={ACCOUNT_INPUT_CLS} value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
          </FormField>
          <FormField label="Last name">
            <input className={ACCOUNT_INPUT_CLS} value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Email">
          <input type="email" className={ACCOUNT_INPUT_CLS} value={form.email} onChange={(e) => setField('email', e.target.value)} />
        </FormField>
        <FormField label="Phone">
          <input className={ACCOUNT_INPUT_CLS} value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
        </FormField>
        <FormField label="Reason (required for email/phone changes)">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. rider mistyped their email at signup and can't receive OTPs" />
        </FormField>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={submit}><Pencil size={15} /> Save Changes</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ── Live location map ────────────────────────────────────────────────────────

// A divIcon (pure CSS dot) sidesteps Leaflet's default-marker asset paths, which
// break under Vite's bundling. Green matches the "online" badge.
const RIDER_PIN = L.divIcon({
  className: 'rider-live-pin',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#10b981;border:3px solid #fff;box-shadow:0 0 0 2px rgba(16,185,129,.45)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Follow the rider without yanking zoom, and fix the blank-tiles issue when the
// map mounts inside a tab/flex container (needs an invalidateSize after layout).
function MapRecenter({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number') map.setView([lat, lng], map.getZoom() || 15)
  }, [lat, lng, map])
  return null
}
function MapResizeFix() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120)
    return () => clearTimeout(t)
  }, [map])
  return null
}

// Polls the rider's live location every 4s while mounted (i.e. while the
// Location tab is open). Kept in local state - transient, not in the slice.
function RiderLocationTab({ riderId }) {
  const dispatch = useDispatch()
  const [loc, setLoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const data = await dispatch(fetchRiderLocation(riderId)).unwrap()
        if (!alive) return
        setLoc(data)
        setError(null)
      } catch (_) {
        if (alive) setError('Could not load location')
      } finally {
        if (alive) setLoading(false)
      }
    }
    tick()
    const timer = setInterval(tick, 4000)
    return () => { alive = false; clearInterval(timer) }
  }, [dispatch, riderId])

  const hasPos = loc && typeof loc.lat === 'number' && typeof loc.lng === 'number'
  const badge = loc?.online ? (loc.availability === 'ON_DELIVERY' ? 'ON_DELIVERY' : 'ONLINE') : 'OFFLINE'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <AvailabilityBadge availability={badge} />
        <span className="text-xs text-muted dark:text-dark-muted">
          {loc?.online ? 'Live · updates every 4s' : 'Rider is offline'}
        </span>
      </div>

      {loading && !loc ? (
        <div className="h-72 rounded-xl bg-surface-muted dark:bg-dark-surface-muted animate-pulse" />
      ) : hasPos ? (
        <>
          <div className="h-72 rounded-xl overflow-hidden border border-surface-muted dark:border-dark-surface-muted">
            <MapContainer center={[loc.lat, loc.lng]} zoom={15} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <Marker position={[loc.lat, loc.lng]} icon={RIDER_PIN} />
              <MapRecenter lat={loc.lat} lng={loc.lng} />
              <MapResizeFix />
            </MapContainer>
          </div>
          <InfoRow icon={<MapPin size={16} />} label="Address" value={loc.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`} />
          <InfoRow icon={<Clock size={16} />} label="Last update" value={loc.lastLocationAt ? new Date(loc.lastLocationAt).toLocaleString() : '—'} />
          {!loc.online && (
            <p className="text-xs text-muted dark:text-dark-muted">
              Showing the last known position — the rider isn't streaming right now, so it won't move until they're back online.
            </p>
          )}
        </>
      ) : (
        <div className="h-72 rounded-xl border border-dashed border-surface-muted dark:border-dark-surface-muted flex flex-col items-center justify-center text-center px-6">
          <MapPin size={28} className="text-muted dark:text-dark-muted mb-2" />
          <p className="text-sm font-medium text-text dark:text-dark-text">No location yet</p>
          <p className="text-xs text-muted dark:text-dark-muted mt-1">No GPS fix has ever been received for this rider. It appears here once they go online and start streaming.</p>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}
    </div>
  )
}

// ── Detail drawer ────────────────────────────────────────────────────────────

const DRAWER_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'location', label: 'Location' },
  { id: 'documents', label: 'Documents' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'transactions', label: 'Transactions' },
]

function RiderDrawer({ rider, earnings, deliveries, transactions, onTxClick, tab, setTab, actionLoading, onClose, onReview, onSuspend, onUnsuspend, onForceOffline, onResetPin, onEditAccount }) {
  if (!rider) return null
  const busy = actionLoading === rider.id

  return (
    <Modal open={!!rider} onClose={onClose} title={fullName(rider)} maxW="max-w-3xl">
      {/* Identity header */}
      <div className="flex items-start gap-3 sm:gap-4 mb-4">
        <Avatar size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-text dark:text-dark-text truncate">{fullName(rider)}</h3>
            <StatusBadge status={rider.status} />
            <AvailabilityBadge availability={effectiveAvailability(rider)} />
          </div>
          <p className="text-xs text-muted dark:text-dark-muted mt-1">Rider ID #{rider.id.slice(-8)} · Joined {new Date(rider.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      {rider.status === 'SUSPENDED' && rider.suspensionReason && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 mb-4 flex gap-2.5">
          <Ban size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300"><span className="font-semibold">Suspended:</span> {rider.suspensionReason}</p>
        </div>
      )}

      {/* Inner tabs */}
      <div className="flex border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
        {DRAWER_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="py-4">
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <StatCard label="Rating" value={rider.averageRating?.toFixed(1) || '-'} icon={<Star size={16} className="text-amber-400 fill-amber-400" />} />
              <StatCard label="Deliveries" value={rider.totalDeliveries || 0} icon={<Package size={16} />} />
              <StatCard label="Lifetime" value={naira(rider.totalEarnings)} icon={<DollarSign size={16} />} accent="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <InfoRow icon={<Phone size={16} />} label="Phone" value={rider.user?.phone} />
              <InfoRow icon={<Mail size={16} />} label="Email" value={rider.user?.email} />
              <InfoRow icon={<Truck size={16} />} label="Vehicle" value={rider.vehicleType ? `${rider.vehicleType[0]}${rider.vehicleType.slice(1).toLowerCase()}` : null} />
              <InfoRow icon={<Hash size={16} />} label="Plate number" value={rider.plateNumber} />
              <InfoRow icon={<Bike size={16} />} label="Vehicle colour" value={rider.vehicleColor} />
              <InfoRow icon={<Hash size={16} />} label="NIN" value={maskNin(rider.ninNumber)} />
              <InfoRow icon={<MapPin size={16} />} label="Last seen" value={rider.lastLocationAt ? new Date(rider.lastLocationAt).toLocaleString() : 'No location yet'} />
              <InfoRow icon={<Calendar size={16} />} label="Joined" value={new Date(rider.createdAt).toLocaleDateString()} />
            </div>
          </div>
        )}

        {tab === 'location' && <RiderLocationTab riderId={rider.id} />}

        {tab === 'documents' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DocCard label="Government ID" url={rider.idDocumentUrl} expiresAt={rider.idDocExpiresAt} />
            <DocCard label="Driver's licence" url={rider.driverLicenceUrl} expiresAt={rider.driverLicenceExpiresAt} />
            <DocCard label="Vehicle registration" url={rider.vehicleRegUrl} expiresAt={rider.vehicleRegExpiresAt} />
            <DocCard label="Insurance" url={rider.insuranceDocUrl} expiresAt={rider.insuranceExpiresAt} />
            <DocCard label="Vehicle photo" url={rider.vehiclePhotoUrl} />
            <div className="border border-surface-muted dark:border-dark-surface-muted rounded-xl p-3">
              <span className="text-sm font-medium text-text dark:text-dark-text flex items-center gap-2"><Hash size={15} className="text-muted dark:text-dark-muted" /> NIN</span>
              <p className="text-sm text-muted dark:text-dark-muted mt-2">{maskNin(rider.ninNumber) || 'Not provided'}</p>
            </div>
          </div>
        )}

        {tab === 'earnings' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <StatCard label="Total earnings" value={naira(earnings?.totalEarnings ?? rider.totalEarnings)} icon={<DollarSign size={16} />} accent="text-emerald-600 dark:text-emerald-400" />
              <StatCard label="Completed deliveries" value={earnings?.completedDeliveries ?? rider.totalDeliveries ?? 0} icon={<CheckCircle size={16} />} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide mb-2">Recent earnings</p>
              {!earnings ? (
                <div className="flex justify-center py-8"><Spinner size={24} cls="border-primary" /></div>
              ) : (earnings.earnings || []).length === 0 ? (
                <p className="text-sm text-muted dark:text-dark-muted text-center py-6">No earnings recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {earnings.earnings.slice(0, 20).map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-muted dark:bg-dark-surface-muted">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text dark:text-dark-text truncate">{t.description || 'Delivery earning'}</p>
                        <p className="text-xs text-muted dark:text-dark-muted">{new Date(t.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">+{naira(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'deliveries' && (
          <div>
            {!deliveries ? (
              <div className="flex justify-center py-8"><Spinner size={24} cls="border-primary" /></div>
            ) : deliveries.length === 0 ? (
              <p className="text-sm text-muted dark:text-dark-muted text-center py-6">No delivery history</p>
            ) : (
              <div className="space-y-3">
                {deliveries.map((d) => (
                  <div key={d.id} className="p-3 rounded-xl bg-surface-muted dark:bg-dark-surface-muted">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-medium text-text dark:text-dark-text flex items-center gap-1.5"><Package size={14} /> #{d.id.slice(-8)}</span>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <InfoRow icon={<MapPin size={13} />} label="From" value={d.pickupAddress} />
                      <InfoRow icon={<MapPin size={13} />} label="To" value={d.dropoffAddress} />
                      <InfoRow icon={<DollarSign size={13} />} label="Earning" value={naira(d.riderEarning)} />
                      <InfoRow icon={<Calendar size={13} />} label="Date" value={new Date(d.deliveredAt || d.createdAt).toLocaleDateString()} />
                    </div>
                    {(d.podPhotoUrl || d.podSignatureUrl) && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-surface dark:border-dark-surface">
                        {d.podPhotoUrl && (
                          <a href={d.podPhotoUrl} target="_blank" rel="noopener noreferrer" className="w-20 h-16 rounded-lg overflow-hidden border border-surface dark:border-dark-surface" title="Doorstep photo">
                            <img src={d.podPhotoUrl} alt="POD" className="w-full h-full object-cover" loading="lazy" />
                          </a>
                        )}
                        {d.podSignatureUrl && (
                          <a href={d.podSignatureUrl} target="_blank" rel="noopener noreferrer" className="w-20 h-16 rounded-lg overflow-hidden border border-surface dark:border-dark-surface bg-white flex items-center justify-center" title="Signature">
                            <img src={d.podSignatureUrl} alt="Signature" className="max-w-full max-h-full object-contain" loading="lazy" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'transactions' && (
          <div>
            {transactions?.loading && !transactions?.data?.length ? (
              <div className="flex justify-center py-8"><Spinner size={24} cls="border-primary" /></div>
            ) : !transactions?.data?.length ? (
              <p className="text-sm text-muted dark:text-dark-muted text-center py-6">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.data.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onTxClick(t)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-muted dark:bg-dark-surface-muted text-left hover:opacity-90 transition-opacity"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text dark:text-dark-text truncate">{t.description || (t.type || '').replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted dark:text-dark-muted">{new Date(t.createdAt).toLocaleString()} · {t.status}</p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${t.direction === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-text dark:text-dark-text'}`}>
                      {t.direction === 'CREDIT' ? '+' : '-'}{naira(t.amount)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contextual footer actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end border-t border-surface-muted dark:border-dark-surface-muted pt-4">
        <Btn variant="outline" onClick={onClose}>Close</Btn>
        <Btn variant="ghost" onClick={() => onEditAccount(rider)}><Pencil size={15} /> Edit Account</Btn>
        <Btn variant="ghost" onClick={() => onResetPin(rider)}><KeyRound size={15} /> Reset PIN</Btn>
        {rider.status === 'PENDING_APPROVAL' && (
          <>
            <Btn variant="danger" onClick={() => onReview(rider, 'reject')}><X size={15} /> Reject</Btn>
            <Btn variant="success" loading={busy} onClick={() => onReview(rider, 'approve')}><Check size={15} /> Approve</Btn>
          </>
        )}
        {rider.status === 'APPROVED' && (
          <>
            {rider.availability !== 'OFFLINE' && <Btn variant="warning" onClick={() => onForceOffline(rider)}><Power size={15} /> Take Offline</Btn>}
            <Btn variant="danger" onClick={() => onSuspend(rider)}><Ban size={15} /> Suspend</Btn>
          </>
        )}
        {rider.status === 'SUSPENDED' && (
          <Btn variant="success" loading={busy} onClick={() => onUnsuspend(rider)}><ShieldCheck size={15} /> Reinstate</Btn>
        )}
      </div>
    </Modal>
  )
}
