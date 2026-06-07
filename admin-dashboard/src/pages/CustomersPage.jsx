import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { fetchAllCustomers, suspendCustomer, unsuspendCustomer } from '../store/slices/customersSlice'
import { useDebounce } from '../lib/useDebounce'
import { useFilters } from '../lib/useFilters'
import { exportToCSV } from '../lib/exportToCSV'
import { User, Phone, Mail, Search, Eye, Shield, ShieldAlert, Download } from 'lucide-react'
import Pagination from '../components/Pagination'
import ActionMenu from '../components/ActionMenu'

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
  FAILED: 'bg-error/10 text-error',
}

export default function CustomersPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { customers, total, page, loading } = useSelector((state) => state.customers)
  const { filters, updateFilter } = useFilters({ search: '', status: '', kycStatus: '' })
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [showBulkSuspendModal, setShowBulkSuspendModal] = useState(false)
  const [pageSize, setPageSize] = useState(20)
  const debouncedSearch = useDebounce(filters.search, 500)

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

  const handleFilterChange = (key, value) => {
    updateFilter(key, value)
  }

  const handlePageChange = (newPage) => {
    dispatch(fetchAllCustomers({ page: newPage, limit: pageSize, ...filters }))
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    dispatch(fetchAllCustomers({ page: 1, limit: newPageSize, ...filters }))
  }

  const handleSuspend = async () => {
    if (!suspendReason.trim()) return
    setActionLoading('suspend')
    await dispatch(suspendCustomer({ userId: selectedCustomer.id, reason: suspendReason }))
    setActionLoading(null)
    setShowSuspendModal(false)
    setSuspendReason('')
    setSelectedCustomer(null)
    dispatch(fetchAllCustomers({ page, limit: pageSize, ...filters }))
  }

  const handleUnsuspend = async (userId) => {
    setActionLoading(userId)
    await dispatch(unsuspendCustomer(userId))
    setActionLoading(null)
    dispatch(fetchAllCustomers({ page, limit: pageSize, ...filters }))
  }

  const openSuspendModal = (customer) => {
    setSelectedCustomer(customer)
    setShowSuspendModal(true)
  }

  const handleExportCSV = () => {
    const csvData = customers.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      status: c.status,
      kycStatus: c.kycStatus,
      createdAt: c.createdAt,
    }))
    exportToCSV(csvData, 'customers', ['id', 'firstName', 'lastName', 'email', 'phone', 'status', 'kycStatus', 'createdAt'])
  }

  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? customers.map((c) => c.id) : [])
  }

  const handleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleBulkSuspend = async () => {
    if (!suspendReason.trim()) return
    setActionLoading('bulkSuspend')
    await Promise.all(selectedIds.map((userId) => dispatch(suspendCustomer({ userId, reason: suspendReason }))))
    setActionLoading(null)
    setShowBulkSuspendModal(false)
    setSuspendReason('')
    setSelectedIds([])
    dispatch(fetchAllCustomers({ page, limit: pageSize, ...filters }))
  }

  const handleBulkUnsuspend = async () => {
    setActionLoading('bulkUnsuspend')
    await Promise.all(selectedIds.map((userId) => dispatch(unsuspendCustomer(userId))))
    setActionLoading(null)
    setSelectedIds([])
    dispatch(fetchAllCustomers({ page, limit: pageSize, ...filters }))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-6">Customers</h1>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3">
          <div className="relative lg:flex-1 lg:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
            <option value="PENDING">Pending</option>
          </select>
          <select
            value={filters.kycStatus}
            onChange={(e) => handleFilterChange('kycStatus', e.target.value)}
            className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
          >
            <option value="">All KYC</option>
            <option value="NONE">No KYC</option>
            <option value="PENDING">KYC Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="FAILED">Failed</option>
          </select>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            {selectedIds.length > 0 && (
              <>
                <button
                  onClick={() => setShowBulkSuspendModal(true)}
                  className="flex-1 sm:flex-none px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2 text-sm"
                >
                  <ShieldAlert size={16} />
                  <span className="hidden sm:inline">Bulk Suspend</span>
                  <span className="sm:hidden">Suspend</span>
                  ({selectedIds.length})
                </button>
                <button
                  onClick={handleBulkUnsuspend}
                  disabled={actionLoading === 'bulkUnsuspend'}
                  className="flex-1 sm:flex-none px-3 py-2 bg-success text-white rounded-lg hover:bg-success/80 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  <Shield size={16} />
                  <span className="hidden sm:inline">Bulk Unsuspend</span>
                  <span className="sm:hidden">Unsuspend</span>
                </button>
              </>
            )}
            <button
              onClick={handleExportCSV}
              disabled={customers.length === 0}
              className="flex-1 sm:flex-none px-3 py-2 bg-success text-white rounded-lg hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">Loading customers...</div>
        ) : !customers?.length ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">No customers found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
                <tr>
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === customers.length && customers.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-surface-muted text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">KYC</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(customer.id)}
                        onChange={() => handleSelectOne(customer.id)}
                        className="w-4 h-4 rounded border-surface-muted text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User size={20} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text dark:text-dark-text">{customer.firstName} {customer.lastName}</p>
                          <p className="text-sm text-muted dark:text-dark-muted">{customer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <Phone size={14} />
                          {customer.phone || '—'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail size={14} />
                          {customer.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[customer.status] || 'bg-surface-muted text-muted'}`}>
                        {customer.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${KYC_COLORS[customer.kycStatus] || 'bg-surface-muted text-muted'}`}>
                        {customer.kycStatus || 'NONE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">{new Date(customer.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex">
                        <ActionMenu
                          align="left"
                          actions={[
                            { label: 'View Details', icon: Eye, onClick: () => navigate(`/customers/${customer.id}`) },
                            {
                              label: 'Suspend',
                              icon: ShieldAlert,
                              danger: true,
                              hidden: customer.status === 'SUSPENDED',
                              onClick: () => openSuspendModal(customer),
                            },
                            {
                              label: 'Unsuspend',
                              icon: Shield,
                              disabled: actionLoading === customer.id,
                              hidden: customer.status !== 'SUSPENDED',
                              onClick: () => handleUnsuspend(customer.id),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Bulk Suspend Modal */}
      {showBulkSuspendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Bulk Suspend Customers</h3>
            <p className="text-sm text-muted dark:text-dark-muted mb-4">You are about to suspend {selectedIds.length} customer(s). Please provide a reason.</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 dark:bg-dark-surface-muted dark:text-dark-text"
              rows={3}
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button onClick={() => { setShowBulkSuspendModal(false); setSuspendReason(''); setSelectedIds([]) }} className="w-full sm:w-auto px-4 py-2 border border-surface-muted rounded-lg hover:bg-surface-muted">
                Cancel
              </button>
              <button
                onClick={handleBulkSuspend}
                disabled={actionLoading === 'bulkSuspend'}
                className="w-full sm:w-auto px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'bulkSuspend' ? 'Suspending...' : 'Suspend All'}
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
              <button onClick={() => { setShowSuspendModal(false); setSuspendReason(''); setSelectedCustomer(null) }} className="w-full sm:w-auto px-4 py-2 border border-surface-muted rounded-lg hover:bg-surface-muted">
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={!suspendReason.trim() || actionLoading === 'suspend'}
                className="w-full sm:w-auto px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading === 'suspend' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Suspending...
                  </>
                ) : (
                  'Suspend'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
