import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAllUsers, suspendUser, unsuspendUser } from '../store/slices/usersSlice'
import { useDebounce } from '../lib/useDebounce'
import { useFilters } from '../lib/useFilters'
import { exportToCSV } from '../lib/exportToCSV'
import { User, Phone, Mail, Calendar, MoreVertical, Search, Eye, Shield, ShieldAlert, X as CloseIcon, Download, CheckSquare, Square } from 'lucide-react'
import Pagination from '../components/Pagination'

const ROLE_COLORS = {
  CUSTOMER: 'bg-primary/10 text-primary',
  MERCHANT: 'bg-success/10 text-success',
  RIDER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  ADMIN: 'bg-error/10 text-error',
}

const STATUS_COLORS = {
  ACTIVE: 'bg-success/10 text-success',
  SUSPENDED: 'bg-error/10 text-error',
}

export default function UsersPage() {
  const dispatch = useDispatch()
  const { users, total, page, loading } = useSelector((state) => state.users)
  const { filters, updateFilter, resetFilters } = useFilters({ role: '', search: '' })
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [showBulkSuspendModal, setShowBulkSuspendModal] = useState(false)
  const [pageSize, setPageSize] = useState(20)
  const debouncedSearch = useDebounce(filters.search, 500)

  useEffect(() => {
    dispatch(fetchAllUsers({ page: 1, limit: pageSize, role: filters.role, search: debouncedSearch }))
  }, [dispatch, filters.role, debouncedSearch, pageSize])

  const handleFilterChange = (key, value) => {
    updateFilter(key, value)
  }

  const handlePageChange = (newPage) => {
    dispatch(fetchAllUsers({ page: newPage, limit: pageSize, ...filters }))
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    dispatch(fetchAllUsers({ page: 1, limit: newPageSize, ...filters }))
  }

  const handleViewDetails = (user) => {
    setSelectedUser(user)
    setShowDetailsModal(true)
  }

  const handleSuspend = async () => {
    if (!suspendReason.trim()) return
    setActionLoading('suspend')
    await dispatch(suspendUser({ userId: selectedUser.id, reason: suspendReason }))
    setActionLoading(null)
    setShowSuspendModal(false)
    setSuspendReason('')
    setSelectedUser(null)
    dispatch(fetchAllUsers({ page, limit: 20, ...filters }))
  }

  const handleUnsuspend = async (userId) => {
    setActionLoading(userId)
    await dispatch(unsuspendUser(userId))
    setActionLoading(null)
    dispatch(fetchAllUsers({ page, limit: 20, ...filters }))
  }

  const openSuspendModal = (user) => {
    setSelectedUser(user)
    setShowSuspendModal(true)
  }

  const handleExportCSV = () => {
    const csvData = users.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    }))
    exportToCSV(csvData, 'users', ['id', 'firstName', 'lastName', 'email', 'phone', 'role', 'status', 'createdAt'])
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedUsers(users.map(u => u.id))
    } else {
      setSelectedUsers([])
    }
  }

  const handleSelectUser = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId))
    } else {
      setSelectedUsers([...selectedUsers, userId])
    }
  }

  const handleBulkSuspend = async () => {
    if (!suspendReason.trim()) return
    setActionLoading('bulkSuspend')
    for (const userId of selectedUsers) {
      await dispatch(suspendUser({ userId, reason: suspendReason }))
    }
    setActionLoading(null)
    setShowBulkSuspendModal(false)
    setSuspendReason('')
    setSelectedUsers([])
    dispatch(fetchAllUsers({ page, limit: 20, ...filters }))
  }

  const handleBulkUnsuspend = async () => {
    setActionLoading('bulkUnsuspend')
    for (const userId of selectedUsers) {
      await dispatch(unsuspendUser(userId))
    }
    setActionLoading(null)
    setSelectedUsers([])
    dispatch(fetchAllUsers({ page, limit: 20, ...filters }))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-6">Users Management</h1>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:gap-3 lg:flex lg:gap-3 lg:flex-1">
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
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted dark:bg-dark-surface-muted dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm w-full lg:w-auto"
            >
              <option value="">All Roles</option>
              <option value="CUSTOMER">Customer</option>
              <option value="MERCHANT">Merchant</option>
              <option value="RIDER">Rider</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            {selectedUsers.length > 0 && (
              <>
                <button
                  onClick={() => setShowBulkSuspendModal(true)}
                  className="flex-1 sm:flex-none px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2 text-sm"
                >
                  <ShieldAlert size={16} />
                  <span className="hidden sm:inline">Bulk Suspend</span>
                  <span className="sm:hidden">Suspend</span>
                  ({selectedUsers.length})
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
              disabled={users.length === 0}
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
          <div className="p-12 text-center text-muted dark:text-dark-muted">Loading users...</div>
        ) : !users?.length ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
              <tr>
                <th className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === users.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-surface-muted text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      className="w-4 h-4 rounded border-surface-muted text-primary focus:ring-primary"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User size={20} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text dark:text-dark-text">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-muted dark:text-dark-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Phone size={14} />
                        {user.phone}
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail size={14} />
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[user.status] || 'bg-surface-muted text-muted'}`}>
                      {user.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => handleViewDetails(user)} className="p-2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text" title="View Details">
                        <Eye size={18} />
                      </button>
                      {user.status !== 'SUSPENDED' && (
                        <button onClick={() => openSuspendModal(user)} className="p-2 text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text" title="Suspend">
                          <ShieldAlert size={18} />
                        </button>
                      )}
                      {user.status === 'SUSPENDED' && (
                        <button 
                          onClick={() => handleUnsuspend(user.id)} 
                          disabled={actionLoading === user.id}
                          className="p-2 text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed" 
                          title="Unsuspend"
                        >
                          {actionLoading === user.id ? (
                            <div className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Shield size={18} />
                          )}
                        </button>
                      )}
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

      {/* Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-surface-muted dark:border-dark-surface-muted flex justify-between items-center sticky top-0 bg-surface dark:bg-dark-surface z-10">
              <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text">User Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text">
                <CloseIcon size={24} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={28} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold text-text dark:text-dark-text truncate">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h3>
                  <p className="text-sm text-muted dark:text-dark-muted truncate">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Phone</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone size={16} />
                    {selectedUser.phone}
                  </p>
                </div>
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Role</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[selectedUser.role]}`}>
                    {selectedUser.role}
                  </span>
                </div>
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedUser.status] || 'bg-success/10 text-success'}`}>
                    {selectedUser.status || 'ACTIVE'}
                  </span>
                </div>
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Joined</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar size={16} />
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-surface-muted dark:border-dark-surface-muted">
              <button onClick={() => setShowDetailsModal(false)} className="w-full sm:w-auto px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Suspend Modal */}
      {showBulkSuspendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Bulk Suspend Users</h3>
            <p className="text-sm text-muted dark:text-dark-muted mb-4">You are about to suspend {selectedUsers.length} user(s). Please provide a reason.</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 dark:bg-dark-surface-muted dark:text-dark-text"
              rows={3}
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button onClick={() => { setShowBulkSuspendModal(false); setSuspendReason(''); setSelectedUsers([]) }} className="w-full sm:w-auto px-4 py-2 border border-surface-muted rounded-lg hover:bg-surface-muted">
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
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Suspend User</h3>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 dark:bg-dark-surface-muted dark:text-dark-text"
              rows={3}
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button onClick={() => { setShowSuspendModal(false); setSuspendReason(''); setSelectedUser(null) }} className="w-full sm:w-auto px-4 py-2 border border-surface-muted rounded-lg hover:bg-surface-muted">
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
