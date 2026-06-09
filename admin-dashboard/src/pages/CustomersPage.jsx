import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  fetchAllCustomers, fetchCustomerStats, suspendCustomer, unsuspendCustomer,
} from '../store/slices/customersSlice'
import { useDebounce } from '../lib/useDebounce'
import { useFilters } from '../lib/useFilters'
import { exportToCSV } from '../lib/exportToCSV'
import {
  User, Phone, Mail, Search, Eye, Shield, ShieldAlert, Download, Users,
  ShieldCheck, Ban, BadgeCheck, X, AlertTriangle, Calendar,
} from 'lucide-react'
import Pagination from '../components/Pagination'
import ActionMenu from '../components/ActionMenu'

// ── Design kit (mirrors RidersPage/MerchantsPage so the three pages match) ────

const STATUS_META = {
  ACTIVE:      { label: 'Active',      cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50', dot: 'bg-emerald-500' },
  SUSPENDED:   { label: 'Suspended',   cls: 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50', dot: 'bg-red-500' },
  PENDING:     { label: 'Pending',     cls: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50', dot: 'bg-amber-500' },
  DEACTIVATED: { label: 'Deactivated', cls: 'bg-surface-muted text-muted border border-surface-muted dark:bg-dark-surface-muted dark:text-dark-muted dark:border-dark-surface-muted', dot: 'bg-gray-400 dark:bg-dark-muted' },
}

const KYC_META = {
  NONE:     { label: 'No KYC',   cls: 'bg-surface-muted text-muted dark:bg-dark-surface-muted dark:text-dark-muted' },
  PENDING:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  VERIFIED: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  FAILED:   { label: 'Failed',   cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const fullName = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed customer'

const Spinner = ({ size = 16, cls = 'border-white' }) => (
  <span className={`inline-block border-2 ${cls} border-t-transparent rounded-full animate-spin`} style={{ width: size, height: size }} />
)

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.ACTIVE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

const KycBadge = ({ status }) => {
  const m = KYC_META[status] || KYC_META.NONE
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>
}

const Btn = ({ variant = 'primary', size = 'md', loading, children, className = '', ...props }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' }
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-700 shadow-sm hover:shadow',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
    outline: 'border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner size={14} cls={variant === 'outline' ? 'border-text dark:border-dark-text' : 'border-white'} /> : null}
      {children}
    </button>
  )
}

const Modal = ({ open, onClose, title, children, maxW = 'max-w-md' }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className={`relative bg-surface dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${maxW} max-h-[92vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-muted dark:border-dark-surface-muted">
          <h2 className="text-base sm:text-lg font-bold text-text dark:text-dark-text truncate pr-2">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted shrink-0">
            <X size={20} />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5">{children}</div>
      </div>
    </div>
  )
}

const Avatar = ({ size = 40 }) => (
  <div className="rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
    <User size={size * 0.5} className="text-primary" />
  </div>
)

function KpiCards({ stats }) {
  const cards = [
    { key: 'total', label: 'Total Customers', value: stats?.total ?? 0, icon: <Users size={18} className="text-primary" />, bg: 'bg-primary/5', sub: stats ? `${stats.kycPending ?? 0} awaiting KYC` : null },
    { key: 'active', label: 'Active', value: stats?.active ?? 0, icon: <ShieldCheck size={18} className="text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { key: 'suspended', label: 'Suspended', value: stats?.suspended ?? 0, icon: <Ban size={18} className="text-red-500" />, bg: 'bg-red-50 dark:bg-red-900/20' },
    { key: 'verified', label: 'KYC Verified', value: stats?.kycVerified ?? 0, icon: <BadgeCheck size={18} className="text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/20' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.key} className={`${c.bg} rounded-2xl p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 bg-surface dark:bg-dark-surface rounded-xl flex items-center justify-center shadow-sm shrink-0">{c.icon}</span>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text leading-none truncate">{c.value}</p>
            <p className="text-xs text-muted dark:text-dark-muted truncate mt-1">{c.label}</p>
            {c.sub && <p className="text-[11px] text-amber-600 dark:text-amber-400 truncate">{c.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CustomersPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { customers, total, page, loading, stats } = useSelector((state) => state.customers)
  const { filters, updateFilter } = useFilters({ search: '', status: '', kycStatus: '' })
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [showBulkSuspendModal, setShowBulkSuspendModal] = useState(false)
  const [pageSize, setPageSize] = useState(20)
  const debouncedSearch = useDebounce(filters.search, 500)

  useEffect(() => { dispatch(fetchCustomerStats()) }, [dispatch])

  useEffect(() => {
    dispatch(
      fetchAllCustomers({
        page: 1,
        limit: pageSize,
        search: debouncedSearch,
        status: filters.status || undefined,
        kycStatus: filters.kycStatus || undefined,
      }),
    )
  }, [dispatch, debouncedSearch, pageSize, filters.status, filters.kycStatus])

  const refresh = () => {
    dispatch(fetchAllCustomers({ page, limit: pageSize, ...filters }))
    dispatch(fetchCustomerStats())
  }

  const handlePageChange = (newPage) => dispatch(fetchAllCustomers({ page: newPage, limit: pageSize, ...filters }))
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    dispatch(fetchAllCustomers({ page: 1, limit: newPageSize, ...filters }))
  }

  const handleSuspend = async () => {
    if (!suspendReason.trim()) return
    setActionLoading('suspend')
    const r = await dispatch(suspendCustomer({ userId: selectedCustomer.id, reason: suspendReason }))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') {
      toast.success(`${fullName(selectedCustomer)} suspended`)
      setShowSuspendModal(false); setSuspendReason(''); setSelectedCustomer(null); refresh()
    } else toast.error(r.error?.message || 'Failed to suspend')
  }

  const handleUnsuspend = async (customer) => {
    setActionLoading(customer.id)
    const r = await dispatch(unsuspendCustomer(customer.id))
    setActionLoading(null)
    if (r.meta.requestStatus === 'fulfilled') { toast.success(`${fullName(customer)} reinstated`); refresh() }
    else toast.error(r.error?.message || 'Failed to unsuspend')
  }

  const handleExportCSV = () => {
    const csvData = customers.map((c) => ({
      id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email,
      phone: c.phone, status: c.status, kycStatus: c.kycStatus, createdAt: c.createdAt,
    }))
    exportToCSV(csvData, 'customers', ['id', 'firstName', 'lastName', 'email', 'phone', 'status', 'kycStatus', 'createdAt'])
  }

  const handleSelectAll = (checked) => setSelectedIds(checked ? customers.map((c) => c.id) : [])
  const handleSelectOne = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handleBulkSuspend = async () => {
    if (!suspendReason.trim()) return
    setActionLoading('bulkSuspend')
    await Promise.all(selectedIds.map((userId) => dispatch(suspendCustomer({ userId, reason: suspendReason }))))
    setActionLoading(null)
    toast.success(`${selectedIds.length} customer(s) suspended`)
    setShowBulkSuspendModal(false); setSuspendReason(''); setSelectedIds([]); refresh()
  }

  const handleBulkUnsuspend = async () => {
    setActionLoading('bulkUnsuspend')
    await Promise.all(selectedIds.map((userId) => dispatch(unsuspendCustomer(userId))))
    setActionLoading(null)
    toast.success(`${selectedIds.length} customer(s) reinstated`)
    setSelectedIds([]); refresh()
  }

  const rowActions = (customer) => [
    { label: 'View details', icon: Eye, onClick: () => navigate(`/customers/${customer.id}`) },
    { label: 'Suspend', icon: ShieldAlert, danger: true, hidden: customer.status === 'SUSPENDED', onClick: () => { setSelectedCustomer(customer); setShowSuspendModal(true) } },
    { label: 'Unsuspend', icon: Shield, disabled: actionLoading === customer.id, hidden: customer.status !== 'SUSPENDED', onClick: () => handleUnsuspend(customer) },
  ]

  return (
    <div className="min-h-screen bg-background dark:bg-dark-background">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Customers Management</h1>
        <p className="text-sm text-muted dark:text-dark-muted mt-1">Accounts, KYC, wallets and lifecycle for every customer</p>
      </div>

      <KpiCards stats={stats?.data} />

      <div className="bg-surface dark:bg-dark-surface rounded-2xl shadow-sm border border-surface-muted dark:border-dark-surface-muted overflow-hidden">
        {/* Search + filters */}
        <div className="p-4 border-b border-surface-muted dark:border-dark-surface-muted space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 sm:gap-3 lg:items-center">
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="px-3 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full lg:w-44"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
              <option value="PENDING">Pending</option>
            </select>
            <select
              value={filters.kycStatus}
              onChange={(e) => updateFilter('kycStatus', e.target.value)}
              className="px-3 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full lg:w-44"
            >
              <option value="">All KYC</option>
              <option value="NONE">No KYC</option>
              <option value="PENDING">KYC Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="FAILED">Failed</option>
            </select>
            <div className="flex flex-wrap gap-2 lg:ml-auto col-span-full">
              {selectedIds.length > 0 && (
                <>
                  <Btn variant="warning" size="sm" onClick={() => setShowBulkSuspendModal(true)}>
                    <ShieldAlert size={15} /> Suspend ({selectedIds.length})
                  </Btn>
                  <Btn variant="success" size="sm" loading={actionLoading === 'bulkUnsuspend'} onClick={handleBulkUnsuspend}>
                    <Shield size={15} /> Unsuspend
                  </Btn>
                </>
              )}
              <Btn variant="outline" size="sm" onClick={handleExportCSV} disabled={customers.length === 0}>
                <Download size={15} /> Export
              </Btn>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16"><Spinner size={32} cls="border-primary" /></div>
        ) : !customers?.length ? (
          <div className="text-center py-16 text-muted dark:text-dark-muted">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No customers found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-muted dark:bg-dark-surface-muted text-left">
                    <th className="px-5 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === customers.length && customers.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-surface-muted text-primary focus:ring-primary"
                      />
                    </th>
                    {['Customer', 'Contact', 'Status', 'KYC', 'Joined', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-t border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted/80 dark:hover:bg-dark-surface-muted/80 transition-colors group">
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => handleSelectOne(c.id)}
                          className="w-4 h-4 rounded border-surface-muted text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                          {c.profilePicture ? (
                            <img src={c.profilePicture} alt="" className="w-10 h-10 rounded-xl object-cover" />
                          ) : <Avatar />}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text dark:text-dark-text truncate group-hover:text-primary transition-colors">{fullName(c)}</p>
                            <p className="text-xs text-muted dark:text-dark-muted truncate">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted dark:text-dark-muted">{c.phone || '-'}</td>
                      <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                      <td className="px-5 py-4"><KycBadge status={c.kycStatus} /></td>
                      <td className="px-5 py-4 text-sm text-muted dark:text-dark-muted whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4"><div className="flex"><ActionMenu align="left" actions={rowActions(c)} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {customers.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <label className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => handleSelectOne(c.id)}
                        className="w-4 h-4 rounded border-surface-muted text-primary focus:ring-primary"
                      />
                    </label>
                    <div className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                      {c.profilePicture ? (
                        <img src={c.profilePicture} alt="" className="w-10 h-10 rounded-xl object-cover" />
                      ) : <Avatar />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text dark:text-dark-text truncate">{fullName(c)}</p>
                        <p className="text-xs text-muted dark:text-dark-muted truncate flex items-center gap-1"><Mail size={11} /> {c.email}</p>
                        <p className="text-xs text-muted dark:text-dark-muted truncate flex items-center gap-1"><Phone size={11} /> {c.phone || '-'}</p>
                      </div>
                    </div>
                    <div className="shrink-0"><ActionMenu align="left" actions={rowActions(c)} /></div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <StatusBadge status={c.status} />
                    <KycBadge status={c.kycStatus} />
                    <span className="text-xs text-muted dark:text-dark-muted flex items-center gap-1 ml-auto"><Calendar size={11} /> {new Date(c.createdAt).toLocaleDateString()}</span>
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
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Suspend */}
      <Modal open={showSuspendModal} onClose={() => { setShowSuspendModal(false); setSuspendReason(''); setSelectedCustomer(null) }} title={`Suspend - ${selectedCustomer ? fullName(selectedCustomer) : ''}`}>
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 flex gap-3">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">The customer's wallet is locked and they're signed out until reinstated.</p>
          </div>
          <textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Suspension reason (required)..."
            rows={4}
            className="w-full px-3.5 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => { setShowSuspendModal(false); setSuspendReason(''); setSelectedCustomer(null) }}>Cancel</Btn>
            <Btn variant="warning" loading={actionLoading === 'suspend'} disabled={!suspendReason.trim()} onClick={handleSuspend}><Ban size={15} /> Suspend</Btn>
          </div>
        </div>
      </Modal>

      {/* Bulk suspend */}
      <Modal open={showBulkSuspendModal} onClose={() => { setShowBulkSuspendModal(false); setSuspendReason('') }} title="Bulk suspend customers">
        <div className="space-y-4">
          <p className="text-sm text-muted dark:text-dark-muted">You're about to suspend {selectedIds.length} customer(s). Provide a reason.</p>
          <textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Suspension reason (required)..."
            rows={4}
            className="w-full px-3.5 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-xl text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Btn variant="outline" onClick={() => { setShowBulkSuspendModal(false); setSuspendReason('') }}>Cancel</Btn>
            <Btn variant="warning" loading={actionLoading === 'bulkSuspend'} disabled={!suspendReason.trim()} onClick={handleBulkSuspend}><ShieldAlert size={15} /> Suspend All</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
