import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchCustomerDetail,
  fetchCustomerRequests,
  fetchCustomerTransactions,
  fetchCustomerAddresses,
  suspendCustomer,
  unsuspendCustomer,
  updateCustomer,
  wipeCustomerKyc,
  fetchCustomerPin,
  setCustomerPin,
  clearCustomerPin,
  clearCustomerDetail,
} from '../store/slices/customersSlice'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  ShieldAlert,
  Shield,
  Wallet,
  Lock,
  Unlock,
  MapPin,
  Package,
  Receipt,
  CheckCircle2,
  XCircle,
  Pencil,
  Eraser,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react'
import Pagination from '../components/Pagination'

const STATUS_COLORS = {
  ACTIVE: 'bg-success/10 text-success',
  SUSPENDED: 'bg-error/10 text-error',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  DEACTIVATED: 'bg-surface-muted text-muted',
}

const KYC_COLORS = {
  NONE: 'bg-surface-muted text-muted',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  VERIFIED: 'bg-success/10 text-success',
  REJECTED: 'bg-error/10 text-error',
}

const REQUEST_STATUS_COLORS = {
  REQUESTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ACCEPTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  READY_FOR_PICKUP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  RIDER_ASSIGNED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  RIDER_EN_ROUTE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  PICKED_UP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  IN_TRANSIT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  DELIVERED: 'bg-success/10 text-success',
  SETTLED: 'bg-success/10 text-success',
  CANCELLED: 'bg-error/10 text-error',
}

const formatNGN = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(
    Number(n) || 0,
  )

const TABS = [
  { key: 'requests', label: 'Requests', icon: Package },
  { key: 'transactions', label: 'Transactions', icon: Receipt },
  { key: 'addresses', label: 'Addresses', icon: MapPin },
]

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const dispatch = useDispatch()
  const { detail, requests, transactions, addresses, pin } = useSelector((state) => state.customers)
  const [activeTab, setActiveTab] = useState('requests')
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showWipeKycModal, setShowWipeKycModal] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [wipeKycReason, setWipeKycReason] = useState('')
  const [wipeKycError, setWipeKycError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const customer = detail.data

  useEffect(() => {
    dispatch(fetchCustomerDetail(customerId))
    dispatch(fetchCustomerRequests({ customerId, page: 1, limit: 10 }))
    dispatch(fetchCustomerTransactions({ customerId, page: 1, limit: 10 }))
    dispatch(fetchCustomerAddresses(customerId))
    return () => dispatch(clearCustomerDetail())
  }, [dispatch, customerId])

  const handleSuspend = async () => {
    if (!suspendReason.trim()) return
    setActionLoading('suspend')
    await dispatch(suspendCustomer({ userId: customerId, reason: suspendReason }))
    setActionLoading(null)
    setShowSuspendModal(false)
    setSuspendReason('')
    dispatch(fetchCustomerDetail(customerId))
  }

  const handleUnsuspend = async () => {
    setActionLoading('unsuspend')
    await dispatch(unsuspendCustomer(customerId))
    setActionLoading(null)
    dispatch(fetchCustomerDetail(customerId))
  }

  const handleWipeKyc = async () => {
    if (!wipeKycReason.trim()) return
    setWipeKycError(null)
    setActionLoading('wipeKyc')
    const result = await dispatch(wipeCustomerKyc({ customerId, reason: wipeKycReason.trim() }))
    setActionLoading(null)
    if (result.meta.requestStatus === 'fulfilled') {
      setShowWipeKycModal(false)
      setWipeKycReason('')
      dispatch(fetchCustomerDetail(customerId))
    } else {
      setWipeKycError(result.error?.message || 'Failed to wipe KYC')
    }
  }

  const handleRevealPin = () => {
    dispatch(fetchCustomerPin(customerId))
  }

  const handleHidePin = () => {
    dispatch(clearCustomerPin())
  }

  const handleSetPin = async (newPin, reason) => {
    const result = await dispatch(setCustomerPin({ customerId, pin: newPin, reason: reason || undefined }))
    if (result.meta.requestStatus === 'fulfilled') {
      setShowPinModal(false)
      return { ok: true }
    }
    return { ok: false, error: result.error?.message || 'Failed to set PIN' }
  }

  const handleSaveEdit = async (changes) => {
    setActionLoading('edit')
    const result = await dispatch(updateCustomer({ customerId, changes }))
    setActionLoading(null)
    if (result.meta.requestStatus === 'fulfilled') {
      setShowEditModal(false)
      dispatch(fetchCustomerDetail(customerId))
      return { ok: true }
    }
    return { ok: false, error: result.error?.message || 'Update failed' }
  }

  if (detail.loading && !customer) {
    return <div className="p-12 text-center text-muted dark:text-dark-muted">Loading customer...</div>
  }

  if (detail.error) {
    return (
      <div className="p-12 text-center">
        <p className="text-error mb-4">{detail.error}</p>
        <Link to="/customers" className="text-primary hover:underline">
          Back to customers
        </Link>
      </div>
    )
  }

  if (!customer) return null

  return (
    <div>
      <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text mb-4">
        <ArrowLeft size={16} />
        Back to customers
      </Link>

      {/* Header */}
      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {customer.profilePicture ? (
                <img src={customer.profilePicture} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User size={28} className="text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text truncate">
                {customer.firstName} {customer.lastName}
              </h1>
              <p className="text-sm text-muted dark:text-dark-muted truncate">{customer.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[customer.status] || 'bg-surface-muted text-muted'}`}>
                  {customer.status}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${KYC_COLORS[customer.kycStatus] || 'bg-surface-muted text-muted'}`}>
                  KYC: {customer.kycStatus}
                </span>
                {customer.hasBvn && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    BVN bound
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2 text-sm"
            >
              <Pencil size={16} />
              Edit
            </button>
            {(customer.hasBvn || customer.kycStatus !== 'NONE') && (
              <button
                onClick={() => setShowWipeKycModal(true)}
                className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 flex items-center gap-2 text-sm"
                title="Clear KYC binding so customer can re-verify"
              >
                <Eraser size={16} />
                Wipe KYC
              </button>
            )}
            {customer.status === 'SUSPENDED' ? (
              <button
                onClick={handleUnsuspend}
                disabled={actionLoading === 'unsuspend'}
                className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success/80 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                <Shield size={16} />
                {actionLoading === 'unsuspend' ? 'Unsuspending...' : 'Unsuspend'}
              </button>
            ) : (
              <button
                onClick={() => setShowSuspendModal(true)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 text-sm"
              >
                <ShieldAlert size={16} />
                Suspend
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Wallet Balance" value={formatNGN(customer.wallet?.balance)} icon={Wallet} tone={customer.wallet?.isLocked ? 'warning' : 'default'} sub={customer.wallet?.isLocked ? 'Locked' : null} />
        <StatCard label="Total Orders" value={customer.counts?.requests ?? 0} icon={Package} />
        <StatCard label="Transactions" value={customer.counts?.transactions ?? 0} icon={Receipt} />
        <StatCard label="Saved Addresses" value={customer.counts?.addresses ?? 0} icon={MapPin} />
      </div>

      {/* Profile + Wallet detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <Card title="Profile">
          <InfoRow icon={Mail} label="Email" value={customer.email} />
          <InfoRow icon={Phone} label="Phone" value={customer.phone || '-'} />
          <InfoRow icon={Calendar} label="Joined" value={new Date(customer.createdAt).toLocaleString()} />
          <InfoRow icon={User} label="Date of Birth" value={customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString() : '-'} />
        </Card>
        <Card title="Wallet">
          {customer.wallet ? (
            <>
              <InfoRow icon={Wallet} label="Balance" value={formatNGN(customer.wallet.balance)} />
              <InfoRow icon={Lock} label="Status" value={customer.wallet.isLocked ? 'Locked' : 'Active'} />
              <InfoRow label="Virtual Account" value={customer.wallet.virtualAccountNumber || '-'} />
              <InfoRow label="Bank" value={customer.wallet.virtualAccountBank || '-'} />
              <InfoRow label="Account Name" value={customer.wallet.virtualAccountName || '-'} />
            </>
          ) : (
            <p className="text-sm text-muted dark:text-dark-muted">No wallet provisioned.</p>
          )}
        </Card>
      </div>

      {/* Security & PIN - TEMPORARY testing aid (remove once PIN testing is done). */}
      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-sm font-semibold text-text dark:text-dark-text flex items-center gap-2">
            <KeyRound size={16} className="text-primary" /> Security &amp; Transaction PIN
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            Testing only
          </span>
        </div>
        <p className="text-xs text-muted dark:text-dark-muted mb-4">
          Viewing and setting PINs is a temporary aid for debugging complaints. Every reveal and change is audit-logged.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex items-start gap-3 min-w-0">
            <Shield size={16} className="text-muted dark:text-dark-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted dark:text-dark-muted">PIN status</p>
              <p className="text-sm text-text dark:text-dark-text">
                {customer.hasPinSet ? 'Set' : 'Not set'}
                {customer.hasPinSet && (
                  <span className="text-muted dark:text-dark-muted">
                    {' · '}{customer.pinSetByUser ? 'chosen by customer' : 'default / not user-set'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Revealed value / reveal action */}
          <div className="flex-1 min-w-0">
            {pin?.data ? (
              pin.data.pin ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1.5 rounded-lg bg-surface-muted dark:bg-dark-surface-muted font-mono text-lg tracking-[0.3em] text-text dark:text-dark-text">
                    {pin.data.pin}
                  </span>
                  <button
                    onClick={() => navigator.clipboard?.writeText(pin.data.pin)}
                    className="p-2 rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted"
                    title="Copy PIN"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={handleHidePin}
                    className="p-2 rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted"
                    title="Hide"
                  >
                    <EyeOff size={15} />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No stored plaintext for this customer. Their PIN was set before this tool shipped, or changed in-app.
                  Use <span className="font-medium">Set / Reset PIN</span> to assign a known one.
                </p>
              )
            ) : (
              <p className="text-xs text-muted dark:text-dark-muted">
                {customer.hasPinSet ? 'Reveal shows the last-set PIN (if captured).' : 'No PIN set yet.'}
              </p>
            )}
            {pin?.error && <p className="text-sm text-error mt-1">{pin.error}</p>}
          </div>

          <div className="flex gap-2 shrink-0">
            {customer.hasPinSet && !pin?.data && (
              <button
                onClick={handleRevealPin}
                disabled={pin?.loading}
                className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-text dark:text-dark-text flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {pin?.loading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Eye size={16} />
                )}
                Reveal PIN
              </button>
            )}
            <button
              onClick={() => setShowPinModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2 text-sm"
            >
              <KeyRound size={16} />
              {customer.hasPinSet ? 'Reset PIN' : 'Set PIN'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'requests' && (
            <RequestsTab
              customerId={customerId}
              state={requests}
              onPageChange={(page) => dispatch(fetchCustomerRequests({ customerId, page, limit: requests.limit }))}
            />
          )}
          {activeTab === 'transactions' && (
            <TransactionsTab
              customerId={customerId}
              state={transactions}
              onPageChange={(page) => dispatch(fetchCustomerTransactions({ customerId, page, limit: transactions.limit }))}
            />
          )}
          {activeTab === 'addresses' && <AddressesTab state={addresses} />}
        </div>
      </div>

      {showEditModal && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
          saving={actionLoading === 'edit'}
        />
      )}

      {showPinModal && (
        <SetPinModal
          customer={customer}
          onClose={() => setShowPinModal(false)}
          onSave={handleSetPin}
          saving={pin?.saving}
        />
      )}

      {showWipeKycModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-2">Wipe KYC data</h3>
            <p className="text-sm text-muted dark:text-dark-muted mb-4">
              This clears the customer's stored BVN binding and resets KYC status to{' '}
              <span className="font-medium">NONE</span>, so they can verify again from scratch. The
              BVN verification log is retained for compliance.
            </p>
            <textarea
              value={wipeKycReason}
              onChange={(e) => setWipeKycReason(e.target.value)}
              placeholder="Reason (required)..."
              rows={3}
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-3 dark:bg-dark-surface-muted dark:text-dark-text"
            />
            {wipeKycError && <p className="text-sm text-error mb-2">{wipeKycError}</p>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowWipeKycModal(false)
                  setWipeKycReason('')
                  setWipeKycError(null)
                }}
                className="w-full sm:w-auto px-4 py-2 border border-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-text dark:text-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={handleWipeKyc}
                disabled={!wipeKycReason.trim() || actionLoading === 'wipeKyc'}
                className="w-full sm:w-auto px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'wipeKyc' ? 'Wiping...' : 'Wipe KYC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Suspend Customer</h3>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 dark:bg-dark-surface-muted dark:text-dark-text"
              rows={3}
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button onClick={() => { setShowSuspendModal(false); setSuspendReason('') }} className="w-full sm:w-auto px-4 py-2 border border-surface-muted rounded-lg hover:bg-surface-muted">
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={!suspendReason.trim() || actionLoading === 'suspend'}
                className="w-full sm:w-auto px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'suspend' ? 'Suspending...' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, tone = 'default', sub }) {
  const toneClass = tone === 'warning' ? 'text-orange-600' : 'text-primary'
  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-muted dark:text-dark-muted">{label}</span>
        <Icon size={16} className={toneClass} />
      </div>
      <p className="text-lg sm:text-2xl font-bold text-text dark:text-dark-text break-words">{value}</p>
      {sub && <p className="text-xs text-orange-600 mt-1">{sub}</p>}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-text dark:text-dark-text mb-4">{title}</h2>
      <dl className="space-y-3">{children}</dl>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon size={16} className="text-muted dark:text-dark-muted mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted dark:text-dark-muted">{label}</dt>
        <dd className="text-sm text-text dark:text-dark-text break-words">{value}</dd>
      </div>
    </div>
  )
}

function RequestsTab({ state, onPageChange }) {
  if (state.loading && !state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">Loading...</p>
  if (!state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">No requests yet.</p>
  return (
    <>
      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full">
          <thead className="bg-surface-muted dark:bg-dark-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Route</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
            {state.data.map((r) => (
              <tr key={r.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                <td className="px-4 py-3 text-sm text-text dark:text-dark-text whitespace-nowrap">{r.type}</td>
                <td className="px-4 py-3 text-sm text-muted dark:text-dark-muted">
                  <div className="max-w-xs truncate" title={`${r.pickupAddress} → ${r.dropoffAddress}`}>
                    {r.pickupAddress} → {r.dropoffAddress}
                  </div>
                  {r.merchant?.name && <div className="text-xs text-muted dark:text-dark-muted">via {r.merchant.name}</div>}
                </td>
                <td className="px-4 py-3 text-sm text-text dark:text-dark-text whitespace-nowrap">{formatNGN(r.total)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[r.status] || 'bg-surface-muted text-muted'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted dark:text-dark-muted whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.total > state.limit && (
        <Pagination
          currentPage={state.page}
          totalPages={Math.ceil(state.total / state.limit)}
          totalItems={state.total}
          pageSize={state.limit}
          onPageChange={onPageChange}
        />
      )}
    </>
  )
}

function TransactionsTab({ state, onPageChange }) {
  if (state.loading && !state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">Loading...</p>
  if (!state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">No transactions yet.</p>
  return (
    <>
      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full">
          <thead className="bg-surface-muted dark:bg-dark-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Direction</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted dark:text-dark-muted uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
            {state.data.map((t) => (
              <tr key={t.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                <td className="px-4 py-3 text-xs text-muted dark:text-dark-muted font-mono break-all max-w-[160px]">{t.reference}</td>
                <td className="px-4 py-3 text-sm text-text dark:text-dark-text whitespace-nowrap">{t.type}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.direction === 'CREDIT' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                    {t.direction}
                  </span>
                </td>
                <td className={`px-4 py-3 text-sm font-medium whitespace-nowrap text-right ${t.direction === 'CREDIT' ? 'text-success' : 'text-error'}`}>
                  {t.direction === 'CREDIT' ? '+' : '−'}{formatNGN(t.amount)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1 text-xs">
                    {t.status === 'COMPLETED' ? (
                      <CheckCircle2 size={14} className="text-success" />
                    ) : t.status === 'FAILED' ? (
                      <XCircle size={14} className="text-error" />
                    ) : null}
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted dark:text-dark-muted whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.total > state.limit && (
        <Pagination
          currentPage={state.page}
          totalPages={Math.ceil(state.total / state.limit)}
          totalItems={state.total}
          pageSize={state.limit}
          onPageChange={onPageChange}
        />
      )}
    </>
  )
}

const SENSITIVE_FIELDS = ['status', 'kycStatus', 'walletLocked', 'email', 'phone']

function EditCustomerModal({ customer, onClose, onSave, saving }) {
  const initial = {
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    email: customer.email || '',
    phone: customer.phone || '',
    dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : '',
    kycStatus: customer.kycStatus || 'NONE',
    status: customer.status || 'ACTIVE',
    walletLocked: !!customer.wallet?.isLocked,
  }
  const [form, setForm] = useState(initial)
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const diff = Object.keys(initial).reduce((acc, key) => {
    if (form[key] !== initial[key]) acc[key] = form[key]
    return acc
  }, {})
  const dirty = Object.keys(diff).length > 0
  const needsReason = Object.keys(diff).some((k) => SENSITIVE_FIELDS.includes(k))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!dirty) return
    if (needsReason && !reason.trim()) {
      setError('A reason is required for status, KYC, wallet, email, or phone changes.')
      return
    }
    const changes = { ...diff }
    if (changes.dateOfBirth === '') changes.dateOfBirth = null
    if (reason.trim()) changes.reason = reason.trim()
    const result = await onSave(changes)
    if (!result?.ok) setError(result?.error || 'Update failed')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Edit Customer</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First name">
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
            </Field>
            <Field label="Last name">
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setField('dateOfBirth', e.target.value)}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
            </Field>
            <Field label="Account status">
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DEACTIVATED">Deactivated</option>
                <option value="PENDING">Pending</option>
              </select>
            </Field>
            <Field label="KYC status">
              <select
                value={form.kycStatus}
                onChange={(e) => setField('kycStatus', e.target.value)}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              >
                <option value="NONE">None</option>
                <option value="PENDING">Pending</option>
                <option value="VERIFIED">Verified</option>
                <option value="FAILED">Failed</option>
              </select>
            </Field>
            {customer.wallet && (
              <Field label="Wallet">
                <label className="flex items-center gap-2 px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.walletLocked}
                    onChange={(e) => setField('walletLocked', e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  {form.walletLocked ? (
                    <span className="flex items-center gap-1 text-sm text-orange-600">
                      <Lock size={14} /> Locked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-text dark:text-dark-text">
                      <Unlock size={14} /> Unlocked
                    </span>
                  )}
                </label>
              </Field>
            )}
          </div>

          {needsReason && (
            <Field label={`Reason${needsReason ? ' (required)' : ''}`}>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this change being made?"
                rows={2}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
            </Field>
          )}

          {error && <p className="text-sm text-error">{error}</p>}

          {dirty && (
            <div className="text-xs text-muted dark:text-dark-muted">
              Changing: {Object.keys(diff).join(', ')}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 border border-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-text dark:text-dark-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted dark:text-dark-muted mb-1">{label}</span>
      {children}
    </label>
  )
}

// TEMPORARY testing aid: admin assigns a known 6-digit PIN to the customer.
function SetPinModal({ customer, onClose, onSave, saving }) {
  const [pinValue, setPinValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!/^\d{6}$/.test(pinValue)) {
      setError('PIN must be exactly 6 digits.')
      return
    }
    if (pinValue !== confirm) {
      setError('PINs do not match.')
      return
    }
    const result = await onSave(pinValue, reason.trim())
    if (!result?.ok) setError(result?.error || 'Failed to set PIN')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md">
        <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-1">
          {customer.hasPinSet ? 'Reset transaction PIN' : 'Set transaction PIN'}
        </h3>
        <p className="text-sm text-muted dark:text-dark-muted mb-4">
          This sets <span className="font-medium">{customer.firstName} {customer.lastName}</span>'s 6-digit PIN. They can use it
          immediately, and can change it themselves later. Action is audit-logged.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="New 6-digit PIN">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm font-mono tracking-[0.3em]"
            />
          </Field>
          <Field label="Confirm PIN">
            <input
              type="text"
              inputMode="numeric"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm font-mono tracking-[0.3em]"
            />
          </Field>
          <Field label="Reason (optional)">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. customer reported forgotten PIN"
              className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
            />
          </Field>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 border border-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-text dark:text-dark-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save PIN'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddressesTab({ state }) {
  if (state.loading && !state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">Loading...</p>
  if (!state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">No saved addresses.</p>
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {state.data.map((addr) => (
        <div key={addr.id} className="border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={16} className="text-primary shrink-0" />
              <span className="font-medium text-sm text-text dark:text-dark-text truncate">{addr.label}</span>
            </div>
            {addr.isDefault && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary shrink-0">Default</span>
            )}
          </div>
          <p className="text-sm text-muted dark:text-dark-muted break-words">{addr.address}</p>
          <p className="text-xs text-muted dark:text-dark-muted mt-2">
            {addr.lat?.toFixed?.(4)}, {addr.lng?.toFixed?.(4)}
          </p>
        </div>
      ))}
    </div>
  )
}
