import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAllUsers, suspendUser, unsuspendUser } from '../store/slices/usersSlice'
import { useDebounce } from '../lib/useDebounce'
import { useFilters } from '../lib/useFilters'
import { exportToCSV } from '../lib/exportToCSV'
import { User, Phone, Mail, Calendar, MoreVertical, Search, Eye, Shield, ShieldAlert, X as CloseIcon, Download, CheckSquare, Square } from 'lucide-react'
import Pagination from '../components/Pagination'

const ROLE_COLORS = {
  CUSTOMER: 'bg-blue-100 text-blue-800',
  MERCHANT: 'bg-green-100 text-green-800',
  RIDER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
}

const STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Users Management</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex gap-4 justify-between items-center">
          <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <select
            value={filters.role}
            onChange={(e) => handleFilterChange('role', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">All Roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="MERCHANT">Merchant</option>
            <option value="RIDER">Rider</option>
            <option value="ADMIN">Admin</option>
          </select>
          </div>
          {selectedUsers.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkSuspendModal(true)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
              >
                <ShieldAlert size={18} />
                Bulk Suspend ({selectedUsers.length})
              </button>
              <button
                onClick={handleBulkUnsuspend}
                disabled={actionLoading === 'bulkUnsuspend'}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Shield size={18} />
                Bulk Unsuspend
              </button>
            </div>
          )}
          <button
            onClick={handleExportCSV}
            disabled={users.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">Loading users...</div>
        ) : !users?.length ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === users.length && users.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <User size={20} className="text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
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
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[user.status] || 'bg-gray-100 text-gray-800'}`}>
                      {user.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => handleViewDetails(user)} className="p-2 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-200" title="View Details">
                        <Eye size={18} />
                      </button>
                      {user.status !== 'SUSPENDED' && (
                        <button onClick={() => openSuspendModal(user)} className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-200" title="Suspend">
                          <ShieldAlert size={18} />
                        </button>
                      )}
                      {user.status === 'SUSPENDED' && (
                        <button 
                          onClick={() => handleUnsuspend(user.id)} 
                          disabled={actionLoading === user.id}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                          title="Unsuspend"
                        >
                          {actionLoading === user.id ? (
                            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">User Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-200">
                <CloseIcon size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <User size={32} className="text-primary-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Phone</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone size={16} />
                    {selectedUser.phone}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Role</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[selectedUser.role]}`}>
                    {selectedUser.role}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedUser.status] || 'bg-green-100 text-green-800'}`}>
                    {selectedUser.status || 'ACTIVE'}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Joined</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar size={16} />
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowDetailsModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Suspend Modal */}
      {showBulkSuspendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bulk Suspend Users</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">You are about to suspend {selectedUsers.length} user(s). Please provide a reason.</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4 dark:bg-gray-700 dark:text-white"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowBulkSuspendModal(false); setSuspendReason(''); setSelectedUsers([]) }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button 
                onClick={handleBulkSuspend}
                disabled={actionLoading === 'bulkSuspend'}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'bulkSuspend' ? 'Suspending...' : 'Suspend All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Suspend User</h3>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4 dark:bg-gray-700 dark:text-white"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowSuspendModal(false); setSuspendReason(''); setSelectedUser(null) }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button 
                onClick={handleSuspend} 
                disabled={!suspendReason.trim() || actionLoading === 'suspend'} 
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
