import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchCustomerDetail,
  fetchCustomerRequests,
  fetchCustomerTransactions,
  fetchCustomerTransactionReceipt,
  fetchCustomerUtilityPayments,
  fetchCustomerUtilityPaymentDetail,
  fetchCustomerAddresses,
  suspendCustomer,
  unsuspendCustomer,
  updateCustomer,
  wipeCustomerKyc,
  resetCustomerPin,
  clearCustomerDetail,
  clearTransactionReceipt,
  clearUtilityPaymentDetail,
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
  Zap,
  ChevronRight,
  X,
} from 'lucide-react'
import Pagination from '../components/Pagination'
import api from '../lib/api'
import { toast } from 'sonner'

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

// One unified Transactions tab mirrors what the user sees in-app: their wallet
// ledger already carries VTU/utility purchases as UTILITY_PAYMENT rows, so there
// is no separate "bills" history to split out.
const TABS = [
  { key: 'requests', label: 'Requests', icon: Package },
  { key: 'transactions', label: 'Transactions', icon: Receipt },
  { key: 'addresses', label: 'Addresses', icon: MapPin },
]

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const dispatch = useDispatch()
  const { detail, requests, transactions, transactionReceipt, utilityPayments, utilityPaymentDetail, addresses, pinReset } = useSelector((state) => state.customers)
  const [activeTab, setActiveTab] = useState('requests')
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showWipeKycModal, setShowWipeKycModal] = useState(false)
  const [showPinResetModal, setShowPinResetModal] = useState(false)
  const [pinResetReason, setPinResetReason] = useState('')
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

  const handleResetPin = async () => {
    const result = await dispatch(resetCustomerPin({ customerId, reason: pinResetReason.trim() || undefined }))
    if (result.meta.requestStatus === 'fulfilled') {
      setShowPinResetModal(false)
      setPinResetReason('')
      toast.success("Customer's PIN was reset - they'll set a new one on their next transaction.")
      dispatch(fetchCustomerDetail(customerId))
    } else {
      toast.error(result.error?.message || 'Failed to reset PIN')
    }
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

      {/* Security & Transaction PIN */}
      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <h2 className="text-sm font-semibold text-text dark:text-dark-text flex items-center gap-2 mb-1">
          <KeyRound size={16} className="text-primary" /> Security &amp; Transaction PIN
        </h2>
        <p className="text-xs text-muted dark:text-dark-muted mb-4">
          If a customer is locked out of their PIN, reset it here. This clears their PIN so they
          set a fresh one on their next transaction. Admins never see or choose the PIN. Audit-logged.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex items-start gap-3 min-w-0 flex-1">
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

          <button
            onClick={() => setShowPinResetModal(true)}
            disabled={!customer.hasPinSet}
            className="px-4 py-2 border border-error/40 text-error rounded-lg hover:bg-error/10 flex items-center gap-2 text-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            title={customer.hasPinSet ? 'Clear this PIN' : 'No PIN to reset'}
          >
            <KeyRound size={16} />
            Reset PIN
          </button>
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
              state={transactions}
              onPageChange={(page) => dispatch(fetchCustomerTransactions({ customerId, page, limit: transactions.limit }))}
              onRowClick={(t) => dispatch(fetchCustomerTransactionReceipt({ customerId, transactionId: t.id }))}
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

      {showPinResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-2">Reset transaction PIN</h3>
            <p className="text-sm text-muted dark:text-dark-muted mb-4">
              This clears <span className="font-medium">{customer.firstName} {customer.lastName}</span>'s
              transaction PIN. They'll be prompted to set a new one on their next transaction. You won't
              see or choose it. This is audit-logged.
            </p>
            <textarea
              value={pinResetReason}
              onChange={(e) => setPinResetReason(e.target.value)}
              placeholder="Reason (optional)..."
              rows={2}
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-3 dark:bg-dark-surface-muted dark:text-dark-text"
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button
                onClick={() => { setShowPinResetModal(false); setPinResetReason('') }}
                disabled={pinReset.loading}
                className="w-full sm:w-auto px-4 py-2 border border-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-text dark:text-dark-text disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPin}
                disabled={pinReset.loading}
                className="w-full sm:w-auto px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pinReset.loading ? 'Resetting...' : 'Reset PIN'}
              </button>
            </div>
          </div>
        </div>
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

      {transactionReceipt.data && (
        <TransactionReceiptModal
          tx={transactionReceipt.data}
          loading={transactionReceipt.loading}
          onClose={() => dispatch(clearTransactionReceipt())}
          onRefunded={() => {
            dispatch(fetchCustomerTransactions({ customerId, page: transactions.page, limit: transactions.limit }))
            dispatch(fetchCustomerDetail(customerId))
          }}
        />
      )}

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

function TransactionsTab({ state, onPageChange, onRowClick }) {
  if (state.loading && !state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">Loading...</p>
  if (!state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">No transactions yet.</p>
  return (
    <>
      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full">
          <thead className="bg-surface-muted dark:bg-dark-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Direction</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted dark:text-dark-muted uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
            {state.data.map((t) => (
              <tr
                key={t.id}
                onClick={() => onRowClick(t)}
                className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted cursor-pointer"
              >
                <td className="px-4 py-3 text-sm text-text dark:text-dark-text whitespace-nowrap">{t.type?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-sm text-muted dark:text-dark-muted max-w-[200px] truncate">{t.description || '-'}</td>
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
                <td className="px-4 py-3 text-muted dark:text-dark-muted">
                  <ChevronRight size={16} />
                </td>
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

const UTILITY_TYPE_LABELS = { AIRTIME: 'Airtime', DATA: 'Data', CABLE: 'Cable TV', ELECTRICITY: 'Electricity' }
const UTILITY_STATUS_COLORS = {
  COMPLETED: 'bg-success/10 text-success',
  PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  FAILED: 'bg-error/10 text-error',
  REFUNDED: 'bg-surface-muted text-muted',
}

function UtilityPaymentsTab({ state, onPageChange, onRowClick }) {
  if (state.loading && !state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">Loading...</p>
  if (!state.data.length) return <p className="text-sm text-muted dark:text-dark-muted py-8 text-center">No bill payments yet.</p>
  return (
    <>
      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full">
          <thead className="bg-surface-muted dark:bg-dark-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Service</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Biller</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Recipient</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted dark:text-dark-muted uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
            {state.data.map((p) => (
              <tr
                key={p.id}
                onClick={() => onRowClick(p)}
                className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted cursor-pointer"
              >
                <td className="px-4 py-3 text-sm text-text dark:text-dark-text whitespace-nowrap">
                  {UTILITY_TYPE_LABELS[p.type] || p.type}
                </td>
                <td className="px-4 py-3 text-sm text-muted dark:text-dark-muted whitespace-nowrap">{p.biller || '-'}</td>
                <td className="px-4 py-3 text-sm text-muted dark:text-dark-muted whitespace-nowrap">
                  {p.phoneNumber || p.meterNumber || '-'}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-right whitespace-nowrap text-error">
                  -{formatNGN(p.amount)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${UTILITY_STATUS_COLORS[p.status] || 'bg-surface-muted text-muted'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted dark:text-dark-muted whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-muted dark:text-dark-muted">
                  <ChevronRight size={16} />
                </td>
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

// Mirrors the backend REFUND_BLOCKED_TYPES so the button only shows for
// transactions the server will actually accept (clean UX). The server still
// enforces the rules authoritatively.
const REFUND_BLOCKED_TYPES = new Set([
  'WALLET_FUNDING', 'P2P_TRANSFER_RECEIVED', 'DELIVERY_EARNING', 'AIRTIME_TO_CASH',
  'REFUND', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'PLATFORM_EARNING', 'RIDER_EARNING',
  'MERCHANT_EARNING', 'WITHDRAWAL', 'P2P_TRANSFER_SENT', 'DELIVERY_PAYMENT', 'ESCROW_HOLD',
])

export function TransactionReceiptModal({ tx, loading, onClose, onRefunded }) {
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState('')
  const [refunding, setRefunding] = useState(false)

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!tx) return null

  const refundable = tx.direction === 'DEBIT' && tx.status !== 'REFUNDED' && !REFUND_BLOCKED_TYPES.has(tx.type)

  const handleRefund = async () => {
    if (!reason.trim() || refunding) return
    setRefunding(true)
    try {
      const res = await api.post(`/admin/transactions/${tx.id}/refund`, { reason: reason.trim() })
      toast.success(res.data?.message || 'Refund processed')
      onRefunded?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed')
    } finally {
      setRefunding(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-surface-muted dark:border-dark-surface-muted">
          <h3 className="font-semibold text-text dark:text-dark-text">Transaction Receipt</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-center py-4">
            {tx.status === 'COMPLETED' ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 size={40} className="text-success" />
                <span className="text-sm font-medium text-success">Successful</span>
              </div>
            ) : tx.status === 'FAILED' ? (
              <div className="flex flex-col items-center gap-2">
                <XCircle size={40} className="text-error" />
                <span className="text-sm font-medium text-error">Failed</span>
              </div>
            ) : tx.status === 'REFUNDED' ? (
              <div className="flex flex-col items-center gap-2">
                <Eraser size={40} className="text-muted dark:text-dark-muted" />
                <span className="text-sm font-medium text-muted dark:text-dark-muted">Refunded</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Receipt size={20} className="text-yellow-600" />
                </div>
                <span className="text-sm font-medium text-yellow-600">{tx.status}</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${tx.direction === 'CREDIT' ? 'text-success' : 'text-error'}`}>
              {tx.direction === 'CREDIT' ? '+' : '-'}{formatNGN(tx.amount)}
            </p>
            <p className="text-sm text-muted dark:text-dark-muted mt-1">{tx.description || tx.type?.replace(/_/g, ' ')}</p>
          </div>
          <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-4 space-y-3">
            <ReceiptRow label="Type" value={tx.type?.replace(/_/g, ' ')} />
            <ReceiptRow label="Direction" value={tx.direction} />
            <ReceiptRow label="Reference" value={tx.reference} mono />
            {tx.providerRef && <ReceiptRow label="Provider Ref" value={tx.providerRef} mono />}
            {tx.provider && <ReceiptRow label="Provider" value={tx.provider} />}
            <ReceiptRow label="Balance Before" value={formatNGN(tx.balanceBefore)} />
            <ReceiptRow label="Balance After" value={formatNGN(tx.balanceAfter)} />
            <ReceiptRow label="Date" value={new Date(tx.createdAt).toLocaleString()} />
          </div>

          {/* Admin refund */}
          {refundable && !showReason && (
            <button
              onClick={() => setShowReason(true)}
              className="w-full px-4 py-2.5 rounded-lg border border-error/40 text-error hover:bg-error/10 text-sm font-medium transition-colors"
            >
              Refund this transaction
            </button>
          )}
          {refundable && showReason && (
            <div className="border border-surface-muted dark:border-dark-surface-muted rounded-xl p-3 space-y-2">
              <p className="text-xs text-muted dark:text-dark-muted">
                {tx.type === 'UTILITY_PAYMENT'
                  ? 'For VTU, the provider is re-checked first - a delivered purchase is completed, not refunded.'
                  : `Credits ${formatNGN(tx.amount)} back to the customer's wallet. This is audit-logged.`}
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for refund (required)..."
                rows={2}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowReason(false); setReason('') }}
                  disabled={refunding}
                  className="flex-1 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefund}
                  disabled={!reason.trim() || refunding}
                  className="flex-1 px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refunding ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function UtilityPaymentDetailModal({ payment, loading, onClose }) {
  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!payment) return null
  const recipient = payment.phoneNumber || payment.meterNumber
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-surface-muted dark:border-dark-surface-muted">
          <h3 className="font-semibold text-text dark:text-dark-text">
            {UTILITY_TYPE_LABELS[payment.type] || payment.type} Receipt
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-center py-4">
            {payment.status === 'COMPLETED' ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 size={40} className="text-success" />
                <span className="text-sm font-medium text-success">Delivered</span>
              </div>
            ) : payment.status === 'FAILED' || payment.status === 'REFUNDED' ? (
              <div className="flex flex-col items-center gap-2">
                <XCircle size={40} className="text-error" />
                <span className="text-sm font-medium text-error">{payment.status === 'REFUNDED' ? 'Failed (Refunded)' : 'Failed'}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Zap size={20} className="text-yellow-600" />
                </div>
                <span className="text-sm font-medium text-yellow-600">{payment.status}</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-error">-{formatNGN(payment.amount)}</p>
            <p className="text-sm text-muted dark:text-dark-muted mt-1">{payment.biller} {UTILITY_TYPE_LABELS[payment.type]}</p>
          </div>
          <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-4 space-y-3">
            <ReceiptRow label="Service" value={UTILITY_TYPE_LABELS[payment.type] || payment.type} />
            <ReceiptRow label="Network / Biller" value={payment.biller} />
            {recipient && <ReceiptRow label={payment.meterNumber ? 'Meter Number' : 'Phone Number'} value={recipient} />}
            {payment.beneficiaryName && <ReceiptRow label="Beneficiary" value={payment.beneficiaryName} />}
            {payment.plan && <ReceiptRow label="Plan" value={payment.plan} />}
            {payment.token && (
              <div className="pt-1">
                <p className="text-xs text-muted dark:text-dark-muted mb-1">Token</p>
                <p className="font-mono text-sm bg-surface dark:bg-dark-surface px-3 py-2 rounded-lg text-text dark:text-dark-text tracking-wider break-all">
                  {payment.token}
                </p>
              </div>
            )}
            <ReceiptRow label="Reference" value={payment.transactionId || payment.providerRequestId} mono />
            {payment.providerRef && <ReceiptRow label="Provider Ref" value={payment.providerRef} mono />}
            <ReceiptRow label="Date" value={new Date(payment.createdAt).toLocaleString()} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ReceiptRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted dark:text-dark-muted shrink-0">{label}</span>
      <span className={`text-xs text-right text-text dark:text-dark-text break-all ${mono ? 'font-mono' : ''}`}>{value ?? '-'}</span>
    </div>
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
