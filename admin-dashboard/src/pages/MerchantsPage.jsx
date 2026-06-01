import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  fetchAllMerchants, fetchMerchantById, approveMerchant, rejectMerchant,
  suspendMerchant, unsuspendMerchant, updateMerchantCommission, updateMerchantProfile,
  createMerchant, deleteMerchant, fetchCommissionHistory,
  setWithdrawalHold, fetchPendingWithdrawals, fetchWithdrawalHistory,
  approveWithdrawal, rejectWithdrawal, bulkApproveWithdrawals,
  fetchAllTags, createTag, updateTag, deleteTag, setMerchantTags,
  fetchBankList, updateMerchantBankAccount,
  clearSelectedMerchant,
} from '../store/slices/merchantsSlice'
import { fetchCategories } from '../store/slices/categoriesSlice'
import { exportToCSV } from '../lib/exportToCSV'
import Pagination from '../components/Pagination'
import LocationPicker from '../components/LocationPicker'
import {
  Store, CheckCircle, XCircle, ShieldAlert, Shield, MoreVertical,
  Mail, Phone, DollarSign, MapPin, Eye, Edit2, Trash2, Download,
  ChevronRight, TrendingUp, Clock, Star, Hash, Tag, AlertCircle,
  PauseCircle, PlayCircle, CheckSquare, Square, RefreshCw, Plus,
  X, Search, Filter, ArrowUpRight, Building2, Users, BarChart2,
  Banknote, History, ToggleLeft, ToggleRight, Pencil, Globe,
} from 'lucide-react'

// ── Design tokens ────────────────────────────────────────────

const STATUS_META = {
  PENDING_APPROVAL: { label: 'Pending Review', cls: 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50', dot: 'bg-amber-500' },
  APPROVED:         { label: 'Active',          cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50', dot: 'bg-emerald-500' },
  SUSPENDED:        { label: 'Suspended',        cls: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50', dot: 'bg-red-500' },
  REJECTED:         { label: 'Rejected',         cls: 'bg-surface-muted text-muted border border-surface-muted dark:bg-dark-surface-muted dark:text-dark-muted dark:border-dark-surface-muted', dot: 'bg-gray-400 dark:bg-dark-muted' },
}

// merchant.category is sent by the API; this helper renders a label + color swatch
// when no category is loaded yet (e.g. immediately after create).
const categoryLabel = (merchant) => merchant?.category?.name || '—'
const categoryColor = (merchant) => merchant?.category?.color || '#9CA3AF'

// Map a bank code to its display name when the bank list is loaded; fall back
// to the raw code (or em-dash) otherwise.
const bankLabel = (banks, code) =>
  (Array.isArray(banks) ? banks : []).find((b) => (b.code || b.bankCode) === code)?.name || code || '—'

const TABS = [
  { id: 'overview',    label: 'All Merchants',    icon: Store },
  { id: 'pending',     label: 'Pending Review',   icon: Clock },
  { id: 'withdrawals', label: 'Withdrawals',       icon: Banknote },
  { id: 'tags',        label: 'Tags & Categories', icon: Tag },
]

const Spinner = ({ size = 16, cls = 'border-white' }) => (
  <span
    className={`inline-block border-2 ${cls} border-t-transparent rounded-full animate-spin`}
    style={{ width: size, height: size }}
  />
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

const FormField = ({ label, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-text dark:text-dark-text mb-1.5">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
)

const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full px-3.5 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted dark:placeholder:text-dark-muted ${className}`}
    {...props}
  />
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
    primary:  'bg-primary text-white hover:bg-primary-700 shadow-sm hover:shadow',
    danger:   'bg-red-500 text-white hover:bg-red-600 shadow-sm',
    warning:  'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
    success:  'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
    ghost:    'bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted/70 dark:hover:bg-dark-surface-muted/70',
    outline:  'border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner size={14} cls={variant === 'ghost' || variant === 'outline' ? 'border-text dark:border-dark-text' : 'border-white'} /> : null}
      {children}
    </button>
  )
}

// ── Merchant Detail Drawer ────────────────────────────────────

function MerchantDrawer({ merchant, onClose, onAction }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { commissionHistory, commissionHistoryLoading, banks } = useSelector((s) => s.merchants)
  const [tab, setTab] = useState('info')
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [commissionValue, setCommissionValue] = useState('')
  const [commissionReason, setCommissionReason] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [loading, setLoading] = useState(null)
  const [bankEditMode, setBankEditMode] = useState(false)
  const [bankForm, setBankForm] = useState({ bankCode: '', accountNumber: '', accountName: '' })

  useEffect(() => {
    if (merchant && tab === 'commission') {
      dispatch(fetchCommissionHistory({ merchantId: merchant.id }))
    }
  }, [merchant, tab, dispatch])

  // Load the bank list when viewing the Wallet tab so a saved bank code renders
  // as its proper name (and so the editor's dropdown is ready).
  useEffect(() => {
    if (merchant && tab === 'wallet' && !banks?.length) {
      dispatch(fetchBankList())
    }
  }, [merchant, tab, banks, dispatch])

  useEffect(() => {
    if (merchant) {
      setEditData({
        name: merchant.name || '',
        description: merchant.description || '',
        phone: merchant.phone || '',
        email: merchant.email || '',
        address: merchant.address || '',
        lat: typeof merchant.lat === 'number' ? merchant.lat : 0,
        lng: typeof merchant.lng === 'number' ? merchant.lng : 0,
        openingTime: merchant.openingTime || '08:00',
        closingTime: merchant.closingTime || '22:00',
        adminActiveOverride: merchant.adminActiveOverride !== false,
      })
      setCommissionValue(merchant.commissionRate?.toString() || '15')
    }
  }, [merchant])

  if (!merchant) return null

  const act = async (key, fn) => {
    setLoading(key)
    try { await fn() }
    finally { setLoading(null) }
  }

  const handleSaveProfile = () =>
    act('saveProfile', async () => {
      const result = await dispatch(updateMerchantProfile({ merchantId: merchant.id, ...editData }))
      if (result.meta.requestStatus === 'fulfilled') {
        toast.success('Profile updated')
        setEditMode(false)
        onAction?.()
      } else {
        toast.error(result.error?.message || 'Update failed')
      }
    })

  const handleUpdateCommission = () =>
    act('commission', async () => {
      const rate = parseFloat(commissionValue)
      if (isNaN(rate) || rate < 0 || rate > 100) return toast.error('Enter a valid rate (0–100)')
      const result = await dispatch(updateMerchantCommission({ merchantId: merchant.id, commissionRate: rate, reason: commissionReason }))
      if (result.meta.requestStatus === 'fulfilled') {
        toast.success(`Commission updated to ${rate}%`)
        setCommissionReason('')
        dispatch(fetchCommissionHistory({ merchantId: merchant.id }))
        onAction?.()
      } else {
        toast.error(result.error?.message || 'Failed to update commission')
      }
    })

  const handleWithdrawalHold = (held) =>
    act('hold', async () => {
      if (held && !holdReason.trim()) return toast.error('Please provide a hold reason')
      const result = await dispatch(setWithdrawalHold({ merchantId: merchant.id, held, reason: holdReason }))
      if (result.meta.requestStatus === 'fulfilled') {
        toast.success(held ? 'Withdrawal hold enabled' : 'Withdrawal hold released')
        setHoldReason('')
        onAction?.()
      } else {
        toast.error(result.error?.message || 'Failed to update hold')
      }
    })

  const startBankEdit = () => {
    setBankForm({
      bankCode: merchant.wallet?.bankCode || '',
      accountNumber: merchant.wallet?.accountNumber || '',
      accountName: merchant.wallet?.accountName || '',
    })
    if (!banks?.length) dispatch(fetchBankList())
    setBankEditMode(true)
  }

  const handleSaveBank = () =>
    act('saveBank', async () => {
      if (!bankForm.bankCode || bankForm.accountNumber.length !== 10) {
        return toast.error('Select a bank and enter a 10-digit account number')
      }
      if (!bankForm.accountName || bankForm.accountName.trim().length < 2) {
        return toast.error('Enter the account name')
      }
      const r = await dispatch(updateMerchantBankAccount({
        merchantId: merchant.id,
        bankCode: bankForm.bankCode,
        accountNumber: bankForm.accountNumber,
        accountName: bankForm.accountName.trim(),
      }))
      if (r.meta.requestStatus === 'fulfilled') {
        toast.success('Bank account updated')
        setBankEditMode(false)
        onAction?.()
      } else {
        toast.error(r.error?.message || 'Failed to save bank account')
      }
    })

  const drawerTabs = [
    { id: 'info',       label: 'Profile' },
    { id: 'commission', label: 'Commission' },
    { id: 'wallet',     label: 'Wallet' },
    { id: 'tags',       label: 'Tags' },
  ]

  const walletHeld = merchant.wallet?.withdrawalHeld

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-surface dark:bg-dark-surface w-full sm:max-w-xl h-full overflow-y-auto flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface dark:bg-dark-surface border-b border-surface-muted dark:border-dark-surface-muted px-4 sm:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {merchant.logoUrl ? (
                <img src={merchant.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Store size={22} className="text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-text dark:text-dark-text truncate">{merchant.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted dark:text-dark-muted">
                    <span className="w-2 h-2 rounded-full" style={{ background: categoryColor(merchant) }} />
                    {categoryLabel(merchant)}
                  </span>
                  <StatusBadge status={merchant.status} />
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted flex-shrink-0">
              <X size={20} />
            </button>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {merchant.status === 'PENDING_APPROVAL' && (
              <>
                <Btn size="sm" variant="success" loading={loading === 'approve'}
                  onClick={() => act('approve', async () => {
                    const r = await dispatch(approveMerchant(merchant.id))
                    if (r.meta.requestStatus === 'fulfilled') { toast.success('Merchant approved — welcome email sent'); onAction?.() }
                    else toast.error(r.error?.message || 'Failed')
                  })}>
                  <CheckCircle size={14} /> Approve
                </Btn>
                <Btn size="sm" variant="danger" loading={loading === 'reject'}
                  onClick={() => onAction?.('reject', merchant)}>
                  <XCircle size={14} /> Reject
                </Btn>
              </>
            )}
            {merchant.status === 'APPROVED' && (
              <Btn size="sm" variant="warning" loading={loading === 'suspend'}
                onClick={() => onAction?.('suspend', merchant)}>
                <ShieldAlert size={14} /> Suspend
              </Btn>
            )}
            {merchant.status === 'SUSPENDED' && (
              <Btn size="sm" variant="success" loading={loading === 'unsuspend'}
                onClick={() => act('unsuspend', async () => {
                  const r = await dispatch(unsuspendMerchant(merchant.id))
                  if (r.meta.requestStatus === 'fulfilled') { toast.success('Merchant unsuspended'); onAction?.() }
                  else toast.error(r.error?.message || 'Failed')
                })}>
                <Shield size={14} /> Unsuspend
              </Btn>
            )}
            <Btn size="sm" variant="ghost"
              onClick={() => navigate(`/merchants/${merchant.id}/analytics`)}>
              <BarChart2 size={14} /> Analytics
            </Btn>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-surface-muted dark:border-dark-surface-muted mt-4 -mb-4 overflow-x-auto">
            {drawerTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:text-dark-text'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-5">

          {/* ── Profile Tab ── */}
          {tab === 'info' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-text dark:text-dark-text">Business Information</h4>
                <Btn size="sm" variant="ghost" onClick={() => setEditMode((v) => !v)}>
                  {editMode ? <><X size={13} /> Cancel</> : <><Pencil size={13} /> Edit</>}
                </Btn>
              </div>

              {editMode ? (
                <div className="space-y-4">
                  <FormField label="Business Name">
                    <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                  </FormField>
                  <FormField label="Description">
                    <Textarea rows={3} value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} />
                  </FormField>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Phone">
                      <Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
                    </FormField>
                    <FormField label="Email">
                      <Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                    </FormField>
                  </div>
                  <FormField label="Location">
                    <LocationPicker
                      value={{ address: editData.address, lat: editData.lat, lng: editData.lng }}
                      onChange={({ address, lat, lng }) => setEditData({ ...editData, address, lat, lng })}
                    />
                  </FormField>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Opening Time">
                      <Input type="time" value={editData.openingTime} onChange={(e) => setEditData({ ...editData, openingTime: e.target.value })} />
                    </FormField>
                    <FormField label="Closing Time">
                      <Input type="time" value={editData.closingTime} onChange={(e) => setEditData({ ...editData, closingTime: e.target.value })} />
                    </FormField>
                  </div>
                  <FormField label="Admin Visibility Override">
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        type="button"
                        onClick={() => setEditData({ ...editData, adminActiveOverride: !editData.adminActiveOverride })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editData.adminActiveOverride ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-surface-muted'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-surface dark:bg-dark-surface shadow transition-transform ${editData.adminActiveOverride ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className="text-sm text-muted dark:text-dark-muted">{editData.adminActiveOverride ? 'Visible to customers' : 'Hidden from customers (admin override)'}</span>
                    </div>
                  </FormField>
                  <div className="flex justify-end gap-2 pt-2">
                    <Btn variant="outline" onClick={() => setEditMode(false)}>Cancel</Btn>
                    <Btn variant="primary" loading={loading === 'saveProfile'} onClick={handleSaveProfile}>Save Changes</Btn>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {merchant.description && (
                    <p className="text-sm text-muted dark:text-dark-muted bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-3">{merchant.description}</p>
                  )}
                  <InfoRow icon={<Phone size={15} />} label="Phone" value={merchant.phone} />
                  <InfoRow icon={<Mail size={15} />} label="Email" value={merchant.email || merchant.user?.email} />
                  <InfoRow icon={<MapPin size={15} />} label="Address" value={merchant.address} />
                  <InfoRow icon={<Clock size={15} />} label="Hours" value={`${merchant.openingTime} – ${merchant.closingTime}`} />
                  <InfoRow icon={<Globe size={15} />} label="Coordinates" value={`${merchant.lat?.toFixed(5)}, ${merchant.lng?.toFixed(5)}`} />
                  <div className="pt-2 border-t border-surface-muted dark:border-dark-surface-muted">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted dark:text-dark-muted">Admin Visibility</span>
                      <span className={`text-sm font-medium ${merchant.adminActiveOverride !== false ? 'text-emerald-600' : 'text-red-500'}`}>
                        {merchant.adminActiveOverride !== false ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                  </div>
                  {merchant.coverImageUrl && (
                    <div>
                      <p className="text-xs text-muted dark:text-dark-muted mb-2">Cover Image</p>
                      <img src={merchant.coverImageUrl} alt="cover" className="w-full h-28 object-cover rounded-xl" />
                    </div>
                  )}
                  {merchant.suspensionReason && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-3">
                      <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Suspension Reason</p>
                      <p className="text-sm text-red-600 dark:text-red-400">{merchant.suspensionReason}</p>
                    </div>
                  )}
                  {merchant.rejectionReason && (
                    <div className="bg-surface-muted dark:bg-dark-surface-muted border border-surface-muted dark:border-dark-surface-muted rounded-xl p-3">
                      <p className="text-xs font-medium text-muted dark:text-dark-muted mb-1">Rejection Reason</p>
                      <p className="text-sm text-muted dark:text-dark-muted">{merchant.rejectionReason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <StatCard label="Rating" value={merchant.averageRating?.toFixed(1) || '—'} icon={<Star size={14} className="text-amber-500" />} />
                <StatCard label="Orders" value={merchant.totalOrders?.toLocaleString() || '0'} icon={<TrendingUp size={14} className="text-blue-500" />} />
                <StatCard label="Commission" value={`${merchant.commissionRate}%`} icon={<DollarSign size={14} className="text-primary" />} />
              </div>
            </div>
          )}

          {/* ── Commission Tab ── */}
          {tab === 'commission' && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-5">
                <p className="text-sm text-muted dark:text-dark-muted mb-1">Current Commission Rate</p>
                <p className="text-4xl font-bold text-text dark:text-dark-text">{merchant.commissionRate}%</p>
                <p className="text-xs text-muted dark:text-dark-muted mt-1">Applied to all orders from this merchant</p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-text dark:text-dark-text text-sm">Update Rate</h4>
                <div className="flex gap-2">
                  <Input
                    type="number" min="0" max="100" step="0.5"
                    placeholder="New rate %"
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    className="flex-1"
                  />
                  <Btn variant="primary" loading={loading === 'commission'} onClick={handleUpdateCommission}>
                    Update
                  </Btn>
                </div>
                <Textarea
                  rows={2} placeholder="Reason for change (optional)"
                  value={commissionReason}
                  onChange={(e) => setCommissionReason(e.target.value)}
                />
              </div>

              <div>
                <h4 className="font-semibold text-text dark:text-dark-text text-sm mb-3">Change History</h4>
                {commissionHistoryLoading ? (
                  <div className="flex justify-center py-6"><Spinner size={20} cls="border-primary" /></div>
                ) : commissionHistory.length === 0 ? (
                  <p className="text-sm text-muted dark:text-dark-muted text-center py-4">No commission changes recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {commissionHistory.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-xl">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted dark:text-dark-muted line-through">{entry.previousRate}%</span>
                            <ChevronRight size={12} className="text-muted dark:text-dark-muted" />
                            <span className="text-sm font-semibold text-text dark:text-dark-text">{entry.newRate}%</span>
                          </div>
                          {entry.reason && <p className="text-xs text-muted dark:text-dark-muted mt-0.5 truncate">{entry.reason}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-muted dark:text-dark-muted">{new Date(entry.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Wallet Tab ── */}
          {tab === 'wallet' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">Available</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    ₦{Number(merchant.wallet?.availableBalance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Pending</p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    ₦{Number(merchant.wallet?.pendingBalance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${walletHeld ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30' : 'bg-surface-muted dark:bg-dark-surface-muted border-surface-muted dark:border-dark-surface-muted'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${walletHeld ? 'bg-red-100 dark:bg-red-900/30' : 'bg-surface-muted dark:bg-dark-surface-muted'}`}>
                  {walletHeld ? <PauseCircle size={20} className="text-red-600" /> : <PlayCircle size={20} className="text-muted dark:text-dark-muted" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text dark:text-dark-text">{walletHeld ? 'Withdrawal Hold Active' : 'Withdrawals Normal'}</p>
                  {merchant.wallet?.withdrawalHoldReason && (
                    <p className="text-xs text-muted dark:text-dark-muted mt-0.5">{merchant.wallet.withdrawalHoldReason}</p>
                  )}
                </div>
              </div>

              {!walletHeld ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-text dark:text-dark-text text-sm">Place Withdrawal Hold</h4>
                  <p className="text-xs text-muted dark:text-dark-muted">Pauses withdrawals without suspending the merchant's operations.</p>
                  <Textarea
                    rows={2} placeholder="Reason for hold (required)"
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                  />
                  <Btn variant="warning" loading={loading === 'hold'} onClick={() => handleWithdrawalHold(true)}>
                    <PauseCircle size={14} /> Place Hold
                  </Btn>
                </div>
              ) : (
                <div className="space-y-3">
                  <Btn variant="success" loading={loading === 'hold'} onClick={() => handleWithdrawalHold(false)}>
                    <PlayCircle size={14} /> Release Hold
                  </Btn>
                </div>
              )}

              {merchant.wallet && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-text dark:text-dark-text text-sm">Payout Bank Account</h4>
                    {!bankEditMode && (
                      <Btn size="sm" variant="ghost" onClick={startBankEdit}>
                        <Pencil size={13} /> {merchant.wallet.accountNumber ? 'Change' : 'Set up'}
                      </Btn>
                    )}
                  </div>

                  {!bankEditMode ? (
                    merchant.wallet.accountNumber ? (
                      <>
                        <InfoRow label="Account Name" value={merchant.wallet.accountName || '—'} />
                        <InfoRow label="Account Number" value={merchant.wallet.accountNumber} />
                        <InfoRow label="Bank" value={bankLabel(banks, merchant.wallet.bankCode)} />
                      </>
                    ) : (
                      <p className="text-sm text-muted dark:text-dark-muted">No bank account linked yet</p>
                    )
                  ) : (
                    <div className="space-y-3">
                      <FormField label="Bank">
                        <Select
                          value={bankForm.bankCode}
                          onChange={(e) => setBankForm((f) => ({ ...f, bankCode: e.target.value }))}
                        >
                          <option value="">Select a bank</option>
                          {(Array.isArray(banks) ? banks : []).map((b) => (
                            <option key={b.code || b.bankCode} value={b.code || b.bankCode}>{b.name || b.bankName}</option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Account Number">
                        <Input
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="10-digit account number"
                          value={bankForm.accountNumber}
                          onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))}
                        />
                      </FormField>
                      <FormField label="Account Name">
                        <Input
                          placeholder="Name on the account"
                          value={bankForm.accountName}
                          onChange={(e) => setBankForm((f) => ({ ...f, accountName: e.target.value }))}
                        />
                      </FormField>

                      <div className="flex flex-wrap gap-2">
                        <Btn size="sm" variant="primary" loading={loading === 'saveBank'}
                          disabled={!bankForm.bankCode || bankForm.accountNumber.length !== 10 || !bankForm.accountName.trim()}
                          onClick={handleSaveBank}>
                          Save
                        </Btn>
                        <Btn size="sm" variant="ghost" onClick={() => setBankEditMode(false)}>
                          Cancel
                        </Btn>
                      </div>
                      <p className="text-xs text-muted dark:text-dark-muted">
                        KatPay can&apos;t auto-verify names — double-check the account number and name before saving.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tags Tab ── */}
          {tab === 'tags' && (
            <MerchantTagsPanel merchant={merchant} onSaved={onAction} />
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="text-muted dark:text-dark-muted mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted dark:text-dark-muted">{label}</p>
        <p className="text-sm text-text dark:text-dark-text break-words">{value || '—'}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="font-bold text-text dark:text-dark-text text-lg leading-none">{value}</p>
      <p className="text-xs text-muted dark:text-dark-muted mt-0.5">{label}</p>
    </div>
  )
}

function MerchantTagsPanel({ merchant, onSaved }) {
  const dispatch = useDispatch()
  const { tags, tagsLoading } = useSelector((s) => s.merchants)
  const [selected, setSelected] = useState(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dispatch(fetchAllTags())
  }, [dispatch])

  useEffect(() => {
    if (merchant?.tags) {
      setSelected(new Set(merchant.tags.map((mt) => mt.tagId || mt.tag?.id)))
    }
  }, [merchant])

  const toggle = (id) => {
    setSelected((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const r = await dispatch(setMerchantTags({ merchantId: merchant.id, tagIds: Array.from(selected) }))
    setSaving(false)
    if (r.meta.requestStatus === 'fulfilled') { toast.success('Tags updated'); onSaved?.() }
    else toast.error(r.error?.message || 'Failed to save tags')
  }

  const grouped = tags.reduce((acc, tag) => {
    const cat = tag.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tag)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted dark:text-dark-muted">Select tags to assign to this merchant. Tags power search and filtering in the customer app.</p>
      {tagsLoading ? (
        <div className="flex justify-center py-6"><Spinner size={20} cls="border-primary" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-muted dark:text-dark-muted py-4 text-center">No tags yet — create some in the Tags tab</p>
      ) : (
        Object.entries(grouped).map(([cat, catTags]) => (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide mb-2">{cat}</p>
            <div className="flex flex-wrap gap-2">
              {catTags.map((tag) => {
                const active = selected.has(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggle(tag.id)}
                    style={active && tag.color ? { backgroundColor: tag.color + '20', borderColor: tag.color, color: tag.color } : {}}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${active ? 'shadow-sm' : 'bg-surface-muted dark:bg-dark-surface-muted border-surface-muted dark:border-dark-surface-muted text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted'}`}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))
      )}
      <Btn variant="primary" loading={saving} onClick={handleSave} className="w-full">
        Save Tags
      </Btn>
    </div>
  )
}

// ── Structured Application Review Panel ─────────────────────

function ApplicationReviewPanel({ merchant, onAction }) {
  const dispatch = useDispatch()
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(null)

  const act = async (key, fn) => {
    setLoading(key)
    try { await fn() }
    finally { setLoading(null) }
  }

  return (
    <div className="bg-surface dark:bg-dark-surface rounded-2xl border border-surface-muted dark:border-dark-surface-muted shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-surface-muted dark:border-dark-surface-muted">
        <div className="flex items-start gap-4">
          {merchant.logoUrl ? (
            <img src={merchant.logoUrl} alt="logo" className="w-16 h-16 rounded-xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-surface-muted dark:bg-dark-surface-muted flex items-center justify-center">
              <Store size={28} className="text-muted dark:text-dark-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-text dark:text-dark-text">{merchant.name}</h3>
              <span
                className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                style={{ background: `${categoryColor(merchant)}1A`, color: categoryColor(merchant) }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: categoryColor(merchant) }} />
                {categoryLabel(merchant)}
              </span>
            </div>
            <p className="text-sm text-muted dark:text-dark-muted mt-0.5">{merchant.description || 'No description provided'}</p>
            <p className="text-xs text-muted dark:text-dark-muted mt-1">Applied {new Date(merchant.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-surface-muted dark:divide-dark-surface-muted">
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">Contact</p>
          <InfoRow icon={<Phone size={14} />} label="Phone" value={merchant.phone} />
          <InfoRow icon={<Mail size={14} />} label="Email" value={merchant.email || merchant.user?.email} />
          <InfoRow icon={<MapPin size={14} />} label="Address" value={merchant.address} />
          <InfoRow icon={<Globe size={14} />} label="Coordinates" value={`${merchant.lat?.toFixed(4)}, ${merchant.lng?.toFixed(4)}`} />
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">Operations</p>
          <InfoRow icon={<Clock size={14} />} label="Hours" value={`${merchant.openingTime} – ${merchant.closingTime}`} />
          <InfoRow label="Account Owner" value={merchant.user ? `${merchant.user.firstName} ${merchant.user.lastName}` : '—'} />
          <InfoRow label="Owner Email" value={merchant.user?.email} />
        </div>
      </div>

      {merchant.coverImageUrl && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide mb-2">Cover Image</p>
          <img src={merchant.coverImageUrl} alt="cover" className="w-full h-36 object-cover rounded-xl" />
        </div>
      )}

      {/* Bank account */}
      {merchant.wallet && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide mb-3">Bank Account (verify manually)</p>
          <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted dark:text-dark-muted">Account Name</p>
              <p className="text-sm font-medium text-text dark:text-dark-text">{merchant.wallet.accountName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted dark:text-dark-muted">Account Number</p>
              <p className="text-sm font-medium text-text dark:text-dark-text">{merchant.wallet.accountNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted dark:text-dark-muted">Bank Code</p>
              <p className="text-sm font-medium text-text dark:text-dark-text">{merchant.wallet.bankCode || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col sm:flex-row gap-3">
        <Btn
          variant="success" className="flex-1"
          loading={loading === 'approve'}
          onClick={() => act('approve', async () => {
            const r = await dispatch(approveMerchant(merchant.id))
            if (r.meta.requestStatus === 'fulfilled') { toast.success('Merchant approved'); onAction?.() }
            else toast.error(r.error?.message || 'Failed')
          })}
        >
          <CheckCircle size={16} /> Approve Application
        </Btn>
        <Btn
          variant="danger" className="flex-1"
          loading={loading === 'reject'}
          onClick={() => onAction?.('reject', merchant)}
        >
          <XCircle size={16} /> Reject
        </Btn>
      </div>
    </div>
  )
}

// ── Withdrawal Row ───────────────────────────────────────────

function WithdrawalRow({ w, selected, onSelect, onApprove, onReject, loading }) {
  return (
    <div className={`flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all ${selected ? 'border-primary/30 bg-primary/5' : 'border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface hover:border-surface-muted dark:hover:border-dark-surface-muted'}`}>
      <button onClick={() => onSelect(w.id)} className="shrink-0">
        {selected ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-muted dark:text-dark-muted" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-text dark:text-dark-text text-sm truncate">{w.merchantWallet?.merchant?.name || '—'}</p>
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full shrink-0">Pending</span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-xs text-muted dark:text-dark-muted truncate">{w.accountName} · {w.accountNumber}</span>
          <span className="text-xs text-muted dark:text-dark-muted">{new Date(w.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-text dark:text-dark-text text-sm sm:text-base">₦{Number(w.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
        <Btn size="sm" variant="success" loading={loading === `approve-${w.id}`} onClick={() => onApprove(w.id)}>
          <CheckCircle size={13} />
        </Btn>
        <Btn size="sm" variant="danger" loading={loading === `reject-${w.id}`} onClick={() => onReject(w)}>
          <XCircle size={13} />
        </Btn>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function MerchantsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const {
    merchants, total, page, limit, loading,
    pendingWithdrawals, pendingWithdrawalsTotal, withdrawalsLoading,
    tags, tagsLoading,
  } = useSelector((s) => s.merchants)
  const { list: categories } = useSelector((s) => s.categories)

  const [activeTab, setActiveTab] = useState('overview')
  const [filters, setFilters] = useState({ categoryId: '', status: '' })
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)

  // Drawer
  const [drawerMerchant, setDrawerMerchant] = useState(null)

  // Action modals
  const [rejectModal, setRejectModal] = useState(null) // merchant
  const [suspendModal, setSuspendModal] = useState(null) // merchant
  const [deleteModal, setDeleteModal] = useState(null) // merchant
  const [createModal, setCreateModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [suspendReason, setSuspendReason] = useState('')

  // Withdrawal state
  const [selectedWithdrawals, setSelectedWithdrawals] = useState(new Set())
  const [rejectWithdrawalModal, setRejectWithdrawalModal] = useState(null)
  const [withdrawalRejectReason, setWithdrawalRejectReason] = useState('')
  const [wLoading, setWLoading] = useState(null)

  // Tags state
  const [tagModal, setTagModal] = useState(null) // null | { mode: 'create' | 'edit', tag?: {} }
  const [tagForm, setTagForm] = useState({ name: '', category: '', color: '#EA580C', icon: '' })
  const [tLoading, setTLoading] = useState(null)

  // Create merchant
  const [newMerchant, setNewMerchant] = useState({ name: '', categoryId: '', email: '', phone: '', address: '', lat: 0, lng: 0 })
  const [actionLoading, setActionLoading] = useState(null)

  // Load categories once for the filter + create modal
  useEffect(() => {
    if (categories.length === 0) dispatch(fetchCategories({ limit: 200 }))
  }, [dispatch, categories.length])

  // Default the new-merchant form's category to the first active category once loaded
  useEffect(() => {
    if (!newMerchant.categoryId && categories.length > 0) {
      const firstActive = categories.find((c) => c.isActive)
      if (firstActive) setNewMerchant((m) => ({ ...m, categoryId: firstActive.id }))
    }
  }, [categories, newMerchant.categoryId])

  useEffect(() => {
    if (activeTab === 'overview') {
      dispatch(fetchAllMerchants({ page: 1, limit: pageSize, ...filters }))
    } else if (activeTab === 'pending') {
      dispatch(fetchAllMerchants({ page: 1, limit: pageSize, status: 'PENDING_APPROVAL' }))
    } else if (activeTab === 'withdrawals') {
      dispatch(fetchPendingWithdrawals({ page: 1, limit: 30 }))
    } else if (activeTab === 'tags') {
      dispatch(fetchAllTags())
    }
  }, [dispatch, activeTab, filters, pageSize])

  const refreshMerchants = useCallback(() => {
    const statusFilter = activeTab === 'pending' ? 'PENDING_APPROVAL' : filters.status
    dispatch(fetchAllMerchants({ page: 1, limit: pageSize, ...filters, ...(activeTab === 'pending' && { status: 'PENDING_APPROVAL' }) }))
  }, [dispatch, activeTab, filters, pageSize])

  const pendingCount = merchants.filter((m) => m.status === 'PENDING_APPROVAL').length

  // ── Merchant actions ──
  const handleDrawerAction = async (type, merchant) => {
    if (type === 'reject') { setRejectModal(merchant); setDrawerMerchant(null) }
    else if (type === 'suspend') { setSuspendModal(merchant); setDrawerMerchant(null) }
    else refreshMerchants()
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setActionLoading('reject')
    const r = await dispatch(rejectMerchant({ merchantId: rejectModal.id, reason: rejectReason }))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Merchant rejected — email sent')
      setRejectModal(null); setRejectReason(''); refreshMerchants()
    } else toast.error(r.error?.message || 'Failed')
  }

  const handleSuspend = async () => {
    if (!suspendReason.trim()) return
    setActionLoading('suspend')
    const r = await dispatch(suspendMerchant({ merchantId: suspendModal.id, reason: suspendReason }))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Merchant suspended — email sent')
      setSuspendModal(null); setSuspendReason(''); refreshMerchants()
    } else toast.error(r.error?.message || 'Failed')
  }

  const handleDelete = async () => {
    setActionLoading('delete')
    const r = await dispatch(deleteMerchant(deleteModal.id))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Merchant removed')
      setDeleteModal(null); refreshMerchants()
    } else toast.error(r.error?.message || 'Failed')
  }

  const handleCreateMerchant = async () => {
    if (!newMerchant.name || !newMerchant.phone) return
    if (!newMerchant.categoryId) {
      toast.error('Pick a category')
      return
    }
    setActionLoading('create')
    const r = await dispatch(createMerchant(newMerchant))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Merchant created')
      setCreateModal(false)
      const firstActive = categories.find((c) => c.isActive)
      setNewMerchant({ name: '', categoryId: firstActive?.id || '', email: '', phone: '', address: '', lat: 0, lng: 0 })
      refreshMerchants()
    } else toast.error(r.error?.message || 'Failed')
  }

  // ── Withdrawal actions ──
  const toggleWithdrawal = (id) =>
    setSelectedWithdrawals((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const toggleAllWithdrawals = () => {
    if (selectedWithdrawals.size === pendingWithdrawals.length) setSelectedWithdrawals(new Set())
    else setSelectedWithdrawals(new Set(pendingWithdrawals.map((w) => w.id)))
  }

  const handleApproveWithdrawal = async (withdrawalId) => {
    setWLoading(`approve-${withdrawalId}`)
    const r = await dispatch(approveWithdrawal(withdrawalId))
    setWLoading(null)
    if (r.meta.requestStatus === 'fulfilled') toast.success('Withdrawal approved — email sent')
    else toast.error(r.error?.message || 'Failed')
  }

  const handleRejectWithdrawal = async () => {
    if (!withdrawalRejectReason.trim()) return
    setWLoading(`reject-${rejectWithdrawalModal.id}`)
    const r = await dispatch(rejectWithdrawal({ withdrawalId: rejectWithdrawalModal.id, reason: withdrawalRejectReason }))
    setWLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success('Withdrawal rejected — funds returned')
      setRejectWithdrawalModal(null); setWithdrawalRejectReason('')
    } else toast.error(r.error?.message || 'Failed')
  }

  const handleBulkApprove = async () => {
    if (selectedWithdrawals.size === 0) return
    setWLoading('bulk')
    const r = await dispatch(bulkApproveWithdrawals(Array.from(selectedWithdrawals)))
    setWLoading(null)
    const res = r.payload
    if (r.meta.requestStatus === 'fulfilled') {
      const approved = res.approved?.length || 0
      const failed = res.failed?.length || 0
      toast.success(`${approved} approved${failed > 0 ? `, ${failed} failed` : ''}`)
      setSelectedWithdrawals(new Set())
    } else toast.error(r.error?.message || 'Bulk approval failed')
  }

  // ── Tag actions ──
  const handleSaveTag = async () => {
    if (!tagForm.name.trim()) return
    setTLoading('save')
    let r
    if (tagModal?.mode === 'edit') {
      r = await dispatch(updateTag({ tagId: tagModal.tag.id, ...tagForm }))
    } else {
      r = await dispatch(createTag(tagForm))
    }
    setTLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success(tagModal?.mode === 'edit' ? 'Tag updated' : 'Tag created')
      setTagModal(null)
      setTagForm({ name: '', category: '', color: '#EA580C', icon: '' })
    } else toast.error(r.error?.message || 'Failed')
  }

  const handleDeleteTag = async (tagId) => {
    setTLoading(`delete-${tagId}`)
    const r = await dispatch(deleteTag(tagId))
    setTLoading(null)
    if (r.meta.requestStatus === 'fulfilled') toast.success('Tag deleted')
    else toast.error(r.error?.message || 'Failed')
  }

  const handleExportCSV = () => {
    exportToCSV(
      merchants.map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, category: m.category?.name || '', status: m.status, commissionRate: m.commissionRate, createdAt: m.createdAt })),
      'merchants',
      ['id', 'name', 'email', 'phone', 'type', 'status', 'commissionRate', 'createdAt']
    )
  }

  // Filtered merchants for table
  const filteredMerchants = merchants.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.phone?.includes(q)
  })

  return (
    <div className="min-h-screen bg-background dark:bg-dark-background">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Merchant Management</h1>
        <p className="text-sm text-muted dark:text-dark-muted mt-1">Manage all merchants, applications, withdrawals and tags</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Total Merchants', value: total, icon: <Store size={18} className="text-primary" />, bg: 'bg-primary/5' },
          { label: 'Pending Review', value: merchants.filter(m => m.status === 'PENDING_APPROVAL').length, icon: <Clock size={18} className="text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-900/20', action: () => setActiveTab('pending') },
          { label: 'Active', value: merchants.filter(m => m.status === 'APPROVED').length, icon: <CheckCircle size={18} className="text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Pending Withdrawals', value: pendingWithdrawalsTotal, icon: <Banknote size={18} className="text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/20', action: () => setActiveTab('withdrawals') },
        ].map((s, i) => (
          <button
            key={i}
            onClick={s.action}
            className={`${s.bg} rounded-2xl p-4 text-left ${s.action ? 'hover:shadow-md cursor-pointer' : 'cursor-default'} transition-all`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-surface dark:bg-dark-surface rounded-xl flex items-center justify-center shadow-sm shrink-0">
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text truncate">{s.value}</p>
                <p className="text-xs text-muted dark:text-dark-muted truncate">{s.label}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="bg-surface dark:bg-dark-surface rounded-2xl shadow-sm border border-surface-muted dark:border-dark-surface-muted overflow-hidden mb-1">
        <div className="flex border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3 sm:px-5 py-3 sm:py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${isActive ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted'}`}
              >
                <Icon size={16} />
                {t.label}
                {t.id === 'pending' && merchants.filter(m => m.status === 'PENDING_APPROVAL').length > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-amber-500 text-white text-xs font-bold rounded-full">
                    {merchants.filter(m => m.status === 'PENDING_APPROVAL').length}
                  </span>
                )}
                {t.id === 'withdrawals' && pendingWithdrawalsTotal > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-blue-500 text-white text-xs font-bold rounded-full">
                    {pendingWithdrawalsTotal}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div>
            <div className="p-4 border-b border-surface-muted dark:border-dark-surface-muted space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email or phone..."
                  className="w-full pl-9 pr-4 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 sm:gap-3 lg:items-center">
                <Select
                  value={filters.categoryId}
                  onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                  className="text-sm w-full lg:w-40"
                >
                  <option value="">All Categories</option>
                  {categories.filter((c) => c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="text-sm w-full lg:w-44"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING_APPROVAL">Pending</option>
                  <option value="APPROVED">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
                <div className="flex flex-wrap gap-2 lg:ml-auto col-span-full">
                  <Btn variant="primary" className="flex-1 lg:flex-none" onClick={() => setCreateModal(true)}>
                    <Plus size={16} /> Add Merchant
                  </Btn>
                  <Btn variant="outline" className="flex-1 lg:flex-none" onClick={handleExportCSV} disabled={merchants.length === 0}>
                    <Download size={16} /> Export
                  </Btn>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-16">
                <Spinner size={32} cls="border-primary" />
              </div>
            ) : filteredMerchants.length === 0 ? (
              <div className="text-center py-16 text-muted dark:text-dark-muted">
                <Store size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No merchants found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="bg-surface-muted dark:bg-dark-surface-muted text-left">
                      {['Merchant', 'Type', 'Status', 'Wallet', 'Commission', 'Rating', 'Actions'].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMerchants.map((m) => (
                      <tr
                        key={m.id}
                        className="border-t border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted/80 dark:hover:bg-dark-surface-muted/80 transition-colors group"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setDrawerMerchant(m)}>
                            {m.logoUrl ? (
                              <img src={m.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Store size={18} className="text-primary" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-text dark:text-dark-text truncate group-hover:text-primary transition-colors">{m.name}</p>
                              <p className="text-xs text-muted dark:text-dark-muted truncate">{m.email || m.user?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <span className="flex items-center gap-1.5 text-muted dark:text-dark-muted">
                            <span className="w-2 h-2 rounded-full" style={{ background: categoryColor(m) }} />
                            <span>{categoryLabel(m)}</span>
                          </span>
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={m.status} /></td>
                        <td className="px-5 py-4 text-sm text-text dark:text-dark-text font-medium">
                          ₦{Number(m.wallet?.availableBalance || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-sm text-text dark:text-dark-text">{m.commissionRate}%</td>
                        <td className="px-5 py-4 text-sm text-text dark:text-dark-text">
                          <span className="flex items-center gap-1">
                            <Star size={13} className="text-amber-400 fill-amber-400" />
                            {m.averageRating?.toFixed(1) || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-1">
                            <button onClick={() => setDrawerMerchant(m)} className="p-2 rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors" title="View Details">
                              <Eye size={16} />
                            </button>
                            <button onClick={() => navigate(`/merchants/${m.id}/analytics`)} className="p-2 rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted hover:text-primary transition-colors" title="Analytics">
                              <BarChart2 size={16} />
                            </button>
                            <button onClick={() => setDeleteModal(m)} className="p-2 rounded-lg hover:bg-red-50 text-muted dark:text-dark-muted hover:text-red-500 transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Pending Review Tab ── */}
        {activeTab === 'pending' && (
          <div className="p-4 sm:p-5">
            {loading ? (
              <div className="flex justify-center py-16"><Spinner size={32} cls="border-primary" /></div>
            ) : merchants.filter(m => m.status === 'PENDING_APPROVAL').length === 0 ? (
              <div className="text-center py-16 text-muted dark:text-dark-muted">
                <CheckCircle size={40} className="mx-auto mb-3 opacity-30 text-emerald-500" />
                <p className="font-medium text-muted dark:text-dark-muted">All caught up!</p>
                <p className="text-sm mt-1">No merchant applications pending review</p>
              </div>
            ) : (
              <div className="space-y-4">
                {merchants.filter(m => m.status === 'PENDING_APPROVAL').map((merchant) => (
                  <ApplicationReviewPanel
                    key={merchant.id}
                    merchant={merchant}
                    onAction={(type, m) => {
                      if (type === 'reject') { setRejectModal(m) }
                      else refreshMerchants()
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Withdrawals Tab ── */}
        {activeTab === 'withdrawals' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-text dark:text-dark-text">Pending Withdrawals</h3>
                <p className="text-sm text-muted dark:text-dark-muted">{pendingWithdrawalsTotal} request{pendingWithdrawalsTotal !== 1 ? 's' : ''} awaiting approval</p>
              </div>
              {selectedWithdrawals.size > 0 && (
                <Btn variant="success" loading={wLoading === 'bulk'} onClick={handleBulkApprove}>
                  <CheckCircle size={15} /> Approve {selectedWithdrawals.size} Selected
                </Btn>
              )}
            </div>

            {pendingWithdrawals.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={toggleAllWithdrawals} className="flex items-center gap-2 text-sm text-muted dark:text-dark-muted hover:text-text dark:text-dark-text">
                  {selectedWithdrawals.size === pendingWithdrawals.length
                    ? <CheckSquare size={16} className="text-primary" />
                    : <Square size={16} />}
                  Select all
                </button>
              </div>
            )}

            {withdrawalsLoading ? (
              <div className="flex justify-center py-8"><Spinner size={28} cls="border-primary" /></div>
            ) : pendingWithdrawals.length === 0 ? (
              <div className="text-center py-12 text-muted dark:text-dark-muted">
                <Banknote size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium text-muted dark:text-dark-muted">No pending withdrawals</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingWithdrawals.map((w) => (
                  <WithdrawalRow
                    key={w.id}
                    w={w}
                    selected={selectedWithdrawals.has(w.id)}
                    onSelect={toggleWithdrawal}
                    onApprove={handleApproveWithdrawal}
                    onReject={(wd) => { setRejectWithdrawalModal(wd); setWithdrawalRejectReason('') }}
                    loading={wLoading}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tags Tab ── */}
        {activeTab === 'tags' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-text dark:text-dark-text">Tags & Categories</h3>
                <p className="text-sm text-muted dark:text-dark-muted">Global taxonomy assigned to merchants for search and filtering</p>
              </div>
              <Btn variant="primary" className="w-full sm:w-auto" onClick={() => { setTagModal({ mode: 'create' }); setTagForm({ name: '', category: '', color: '#EA580C', icon: '' }) }}>
                <Plus size={15} /> New Tag
              </Btn>
            </div>

            {tagsLoading ? (
              <div className="flex justify-center py-8"><Spinner size={28} cls="border-primary" /></div>
            ) : tags.length === 0 ? (
              <div className="text-center py-12 text-muted dark:text-dark-muted">
                <Tag size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium text-muted dark:text-dark-muted">No tags yet</p>
                <p className="text-sm mt-1">Create your first tag to organise merchants</p>
              </div>
            ) : (
              (() => {
                const grouped = tags.reduce((acc, tag) => {
                  const cat = tag.category || 'General'
                  if (!acc[cat]) acc[cat] = []
                  acc[cat].push(tag)
                  return acc
                }, {})
                return Object.entries(grouped).map(([cat, catTags]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide mb-3">{cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {catTags.map((tag) => (
                        <div
                          key={tag.id}
                          className="group relative flex items-center gap-2 px-3 py-2 rounded-xl border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface hover:border-surface-muted dark:hover:border-dark-surface-muted transition-all"
                          style={tag.color ? { borderColor: tag.color + '40' } : {}}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color || '#9ca3af' }}
                          />
                          <span className="text-sm font-medium text-text dark:text-dark-text">{tag.name}</span>
                          {tag._count && (
                            <span className="text-xs text-muted dark:text-dark-muted">({tag._count.merchants})</span>
                          )}
                          <div className="flex sm:hidden sm:group-hover:flex gap-1 ml-1">
                            <button
                              onClick={() => { setTagModal({ mode: 'edit', tag }); setTagForm({ name: tag.name, category: tag.category || '', color: tag.color || '#EA580C', icon: tag.icon || '' }) }}
                              className="p-1 rounded hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag.id)}
                              disabled={tLoading === `delete-${tag.id}`}
                              className="p-1 rounded hover:bg-red-50 text-muted dark:text-dark-muted hover:text-red-500"
                            >
                              {tLoading === `delete-${tag.id}` ? <Spinner size={12} cls="border-red-500" /> : <Trash2 size={12} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {activeTab === 'overview' && total > 0 && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / pageSize)}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={(p) => dispatch(fetchAllMerchants({ page: p, limit: pageSize, ...filters }))}
          onPageSizeChange={(s) => { setPageSize(s); dispatch(fetchAllMerchants({ page: 1, limit: s, ...filters })) }}
        />
      )}

      {/* ── Merchant Drawer ── */}
      {drawerMerchant && (
        <MerchantDrawer
          merchant={drawerMerchant}
          onClose={() => setDrawerMerchant(null)}
          onAction={handleDrawerAction}
        />
      )}

      {/* ── Reject Modal ── */}
      <Modal open={!!rejectModal} onClose={() => { setRejectModal(null); setRejectReason('') }} title={`Reject — ${rejectModal?.name}`}>
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-300">The merchant will be notified by email with this reason and instructions to reapply.</p>
          </div>
          <FormField label="Rejection Reason (required)">
            <Textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why the application was rejected and what the merchant needs to fix..."
            />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => { setRejectModal(null); setRejectReason('') }}>Cancel</Btn>
            <Btn variant="danger" loading={actionLoading === 'reject'} disabled={!rejectReason.trim()} onClick={handleReject}>
              Reject Application
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Suspend Modal ── */}
      <Modal open={!!suspendModal} onClose={() => { setSuspendModal(null); setSuspendReason('') }} title={`Suspend — ${suspendModal?.name}`}>
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">The merchant's wallet will be locked and they'll receive an email notification. Withdrawals will be paused.</p>
          </div>
          <FormField label="Suspension Reason (required)">
            <Textarea
              rows={4}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Describe the reason for suspension and what the merchant needs to do to have it lifted..."
            />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => { setSuspendModal(null); setSuspendReason('') }}>Cancel</Btn>
            <Btn variant="warning" loading={actionLoading === 'suspend'} disabled={!suspendReason.trim()} onClick={handleSuspend}>
              Suspend Merchant
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ── */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Merchant">
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-300">
              This will soft-delete <strong>{deleteModal?.name}</strong>. The merchant will no longer appear in the customer app. This action can be reversed from the database.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => setDeleteModal(null)}>Cancel</Btn>
            <Btn variant="danger" loading={actionLoading === 'delete'} onClick={handleDelete}>
              <Trash2 size={15} /> Delete
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Create Merchant Modal ── */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Add Merchant" maxW="max-w-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Business Name">
              <Input value={newMerchant.name} onChange={(e) => setNewMerchant({ ...newMerchant, name: e.target.value })} placeholder="e.g. Chicken Republic" />
            </FormField>
            <FormField label="Category">
              <Select
                value={newMerchant.categoryId}
                onChange={(e) => setNewMerchant({ ...newMerchant, categoryId: e.target.value })}
                disabled={categories.length === 0}
              >
                {categories.length === 0 && <option value="">Loading…</option>}
                {categories.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Email">
              <Input type="email" value={newMerchant.email} onChange={(e) => setNewMerchant({ ...newMerchant, email: e.target.value })} placeholder="business@example.com" />
            </FormField>
            <FormField label="Phone">
              <Input value={newMerchant.phone} onChange={(e) => setNewMerchant({ ...newMerchant, phone: e.target.value })} placeholder="08012345678" />
            </FormField>
          </div>
          <FormField label="Location">
            <LocationPicker
              value={{ address: newMerchant.address, lat: newMerchant.lat, lng: newMerchant.lng }}
              onChange={({ address, lat, lng }) => setNewMerchant({ ...newMerchant, address, lat, lng })}
            />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end pt-2">
            <Btn variant="outline" onClick={() => setCreateModal(false)}>Cancel</Btn>
            <Btn variant="primary" loading={actionLoading === 'create'} disabled={!newMerchant.name || !newMerchant.phone || !newMerchant.address || !newMerchant.lat || !newMerchant.lng} onClick={handleCreateMerchant}>
              <Plus size={15} /> Create Merchant
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Reject Withdrawal Modal ── */}
      <Modal open={!!rejectWithdrawalModal} onClose={() => { setRejectWithdrawalModal(null); setWithdrawalRejectReason('') }} title="Reject Withdrawal">
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-300">
              Rejecting this withdrawal will return <strong>₦{Number(rejectWithdrawalModal?.amount || 0).toLocaleString()}</strong> to the merchant's available balance. They'll be notified by email.
            </p>
          </div>
          <FormField label="Rejection Reason (required)">
            <Textarea
              rows={3}
              value={withdrawalRejectReason}
              onChange={(e) => setWithdrawalRejectReason(e.target.value)}
              placeholder="e.g. Unable to verify account details, please update your bank information..."
            />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => { setRejectWithdrawalModal(null); setWithdrawalRejectReason('') }}>Cancel</Btn>
            <Btn variant="danger" loading={!!wLoading} disabled={!withdrawalRejectReason.trim()} onClick={handleRejectWithdrawal}>
              Reject & Refund
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Tag Create/Edit Modal ── */}
      <Modal open={!!tagModal} onClose={() => setTagModal(null)} title={tagModal?.mode === 'edit' ? 'Edit Tag' : 'Create Tag'}>
        <div className="space-y-4">
          <FormField label="Tag Name">
            <Input value={tagForm.name} onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })} placeholder="e.g. Shawarma, Sneakers, Skincare" />
          </FormField>
          <FormField label="Category">
            <Input value={tagForm.category} onChange={(e) => setTagForm({ ...tagForm, category: e.target.value })} placeholder="e.g. cuisine, fashion, health" />
          </FormField>
          <FormField label="Color">
            <div className="flex gap-3 items-center">
              <input type="color" value={tagForm.color} onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })} className="h-10 w-12 rounded-lg border border-surface-muted dark:border-dark-surface-muted cursor-pointer" />
              <Input value={tagForm.color} onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })} className="flex-1" placeholder="#EA580C" />
            </div>
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end pt-1">
            <Btn variant="outline" onClick={() => setTagModal(null)}>Cancel</Btn>
            <Btn variant="primary" loading={tLoading === 'save'} disabled={!tagForm.name.trim()} onClick={handleSaveTag}>
              {tagModal?.mode === 'edit' ? 'Save Changes' : 'Create Tag'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
