import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAllMerchants, approveMerchant, rejectMerchant, suspendMerchant, unsuspendMerchant, updateMerchantCommission, createMerchant, deleteMerchant } from '../store/slices/merchantsSlice'
import { exportToCSV } from '../lib/exportToCSV'
import { Store, Check, X, Shield, ShieldAlert, MoreVertical, Mail, Phone, DollarSign, MapPin, Eye, Edit, X as CloseIcon, Download } from 'lucide-react'
import Pagination from '../components/Pagination'

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-success/10 text-success',
  SUSPENDED: 'bg-error/10 text-error',
  REJECTED: 'bg-surface-muted text-muted',
}

export default function MerchantsPage() {
  const dispatch = useDispatch()
  const { merchants, total, page, loading } = useSelector((state) => state.merchants)
  const [filters, setFilters] = useState({ type: '', status: '' })
  const [rejectionReason, setRejectionReason] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [commissionRate, setCommissionRate] = useState('')
  const [selectedMerchant, setSelectedMerchant] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showCommissionModal, setShowCommissionModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [pageSize, setPageSize] = useState(20)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [merchantToDelete, setMerchantToDelete] = useState(null)
  const [newMerchant, setNewMerchant] = useState({
    name: '',
    type: 'FOOD',
    email: '',
    phone: '',
    address: '',
    lat: 0,
    lng: 0,
  })

  useEffect(() => {
    dispatch(fetchAllMerchants({ page: 1, limit: pageSize, ...filters }))
  }, [dispatch, filters, pageSize])

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleApprove = async (merchantId) => {
    setActionLoading(merchantId)
    await dispatch(approveMerchant(merchantId))
    setActionLoading(null)
    dispatch(fetchAllMerchants({ page: 1, limit: 20, ...filters }))
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) return
    setActionLoading('reject')
    await dispatch(rejectMerchant({ merchantId: selectedMerchant.id, reason: rejectionReason }))
    setActionLoading(null)
    setShowRejectModal(false)
    setRejectionReason('')
    setSelectedMerchant(null)
    dispatch(fetchAllMerchants({ page: 1, limit: 20, ...filters }))
  }

  const handleSuspend = async () => {
    if (!suspensionReason.trim()) return
    setActionLoading('suspend')
    await dispatch(suspendMerchant({ merchantId: selectedMerchant.id, reason: suspensionReason }))
    setActionLoading(null)
    setShowSuspendModal(false)
    setSuspensionReason('')
    setSelectedMerchant(null)
    dispatch(fetchAllMerchants({ page: 1, limit: 20, ...filters }))
  }

  const handleUnsuspend = async (merchantId) => {
    setActionLoading(merchantId)
    await dispatch(unsuspendMerchant(merchantId))
    setActionLoading(null)
    dispatch(fetchAllMerchants({ page: 1, limit: 20, ...filters }))
  }

  const handleUpdateCommission = async () => {
    if (!commissionRate || isNaN(commissionRate)) return
    setActionLoading('commission')
    await dispatch(updateMerchantCommission({ merchantId: selectedMerchant.id, commissionRate: parseFloat(commissionRate) }))
    setActionLoading(null)
    setShowCommissionModal(false)
    setCommissionRate('')
    setSelectedMerchant(null)
    dispatch(fetchAllMerchants({ page: 1, limit: 20, ...filters }))
  }

  const openRejectModal = (merchant) => {
    setSelectedMerchant(merchant)
    setShowRejectModal(true)
  }

  const openSuspendModal = (merchant) => {
    setSelectedMerchant(merchant)
    setShowSuspendModal(true)
  }

  const openCommissionModal = (merchant) => {
    setSelectedMerchant(merchant)
    setCommissionRate(merchant.commissionRate?.toString() || '')
    setShowCommissionModal(true)
  }

  const openDetailsModal = (merchant) => {
    setSelectedMerchant(merchant)
    setShowDetailsModal(true)
  }

  const handleExportCSV = () => {
    const csvData = merchants.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      type: m.type,
      status: m.status,
      commissionRate: m.commissionRate,
      createdAt: m.createdAt,
    }))
    exportToCSV(csvData, 'merchants', ['id', 'name', 'email', 'phone', 'type', 'status', 'commissionRate', 'createdAt'])
  }

  const handleCreateMerchant = async () => {
    if (!newMerchant.name || !newMerchant.email || !newMerchant.phone) return
    setActionLoading('create')
    await dispatch(createMerchant(newMerchant))
    setActionLoading(null)
    setShowCreateModal(false)
    setNewMerchant({
      name: '',
      type: 'FOOD',
      email: '',
      phone: '',
      address: '',
      lat: 0,
      lng: 0,
    })
    dispatch(fetchAllMerchants({ page, limit: pageSize, ...filters }))
  }

  const openDeleteModal = (merchant) => {
    setMerchantToDelete(merchant)
    setShowDeleteModal(true)
  }

  const handleDeleteMerchant = async () => {
    setActionLoading('delete')
    await dispatch(deleteMerchant(merchantToDelete.id))
    setActionLoading(null)
    setShowDeleteModal(false)
    setMerchantToDelete(null)
    dispatch(fetchAllMerchants({ page, limit: pageSize, ...filters }))
  }

  const handlePageChange = (newPage) => {
    dispatch(fetchAllMerchants({ page: newPage, limit: pageSize, ...filters }))
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    dispatch(fetchAllMerchants({ page: 1, limit: newPageSize, ...filters }))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-6">Merchants Management</h1>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6 mb-6">
        <div className="flex gap-4 flex-wrap justify-between items-center">
          <div className="flex gap-4 flex-wrap">
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            <option value="">All Types</option>
            <option value="FOOD">Food</option>
            <option value="GROCERY">Grocery</option>
            <option value="PHARMACY">Pharmacy</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <Store size={18} />
              Add Merchant
            </button>
            <button
              onClick={handleExportCSV}
              disabled={merchants.length === 0}
              className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download size={18} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">Loading merchants...</div>
        ) : merchants.length === 0 ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">No merchants found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Merchant</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Wallet</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Commission</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {merchants.map((merchant) => (
                <tr key={merchant.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Store size={20} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text dark:text-dark-text">{merchant.name}</p>
                        <p className="text-xs text-muted dark:text-dark-muted">{merchant.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">{merchant.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[merchant.status]}`}>
                      {merchant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} />
                      ₦{merchant.wallet?.availableBalance?.toLocaleString() || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">{merchant.commissionRate}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => openDetailsModal(merchant)} className="p-2 text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text" title="View Details">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => openDeleteModal(merchant)} className="p-2 text-error hover:text-error-700" title="Delete Merchant">
                        <X size={18} />
                      </button>
                      {merchant.status === 'PENDING' && (
                        <>
                          <button 
                            onClick={() => handleApprove(merchant.id)} 
                            disabled={actionLoading === merchant.id}
                            className="p-2 bg-success/10 text-success rounded-lg hover:bg-success/20 disabled:opacity-50 disabled:cursor-not-allowed" 
                            title="Approve"
                          >
                            {actionLoading === merchant.id ? (
                              <div className="w-4 h-4 border-2 border-success border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check size={18} />
                            )}
                          </button>
                          <button onClick={() => openRejectModal(merchant)} className="p-2 bg-error/10 text-error rounded-lg hover:bg-error/20" title="Reject">
                            <X size={18} />
                          </button>
                        </>
                      )}
                      {merchant.status === 'ACTIVE' && (
                        <>
                          <button onClick={() => openCommissionModal(merchant)} className="p-2 text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text" title="Edit Commission">
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => openSuspendModal(merchant)} 
                            disabled={actionLoading === 'suspend'}
                            className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                            title="Suspend"
                          >
                            {actionLoading === 'suspend' ? (
                              <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <ShieldAlert size={18} />
                            )}
                          </button>
                        </>
                      )}
                      {merchant.status === 'SUSPENDED' && (
                        <button 
                          onClick={() => handleUnsuspend(merchant.id)} 
                          disabled={actionLoading === merchant.id}
                          className="p-2 bg-success/10 text-success rounded-lg hover:bg-success/20 disabled:opacity-50 disabled:cursor-not-allowed" 
                          title="Unsuspend"
                        >
                          {actionLoading === merchant.id ? (
                            <div className="w-4 h-4 border-2 border-success border-t-transparent rounded-full animate-spin" />
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

      {/* Details Modal */}
      {showDetailsModal && selectedMerchant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted flex justify-between items-center">
              <h2 className="text-xl font-bold text-text dark:text-dark-text">Merchant Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text">
                <CloseIcon size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Merchant Name</p>
                  <p className="font-medium text-text dark:text-dark-text">{selectedMerchant.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Type</p>
                  <p className="font-medium text-text dark:text-dark-text">{selectedMerchant.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedMerchant.status]}`}>
                    {selectedMerchant.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Commission Rate</p>
                  <p className="font-medium text-text dark:text-dark-text">{selectedMerchant.commissionRate}%</p>
                </div>
              </div>

              <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <h3 className="font-semibold text-text dark:text-dark-text mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-muted" />
                    <span className="text-muted dark:text-dark-muted">{selectedMerchant.user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-muted" />
                    <span className="text-muted dark:text-dark-muted">{selectedMerchant.user?.phone}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <h3 className="font-semibold text-text dark:text-dark-text mb-3">Location</h3>
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-muted mt-1" />
                  <p className="text-muted dark:text-dark-muted">{selectedMerchant.address}</p>
                </div>
              </div>

              <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <h3 className="font-semibold text-text dark:text-dark-text mb-3">Wallet Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted dark:text-dark-muted">Available Balance</p>
                    <p className="font-medium text-text dark:text-dark-text">₦{selectedMerchant.wallet?.availableBalance?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted dark:text-dark-muted">Pending Balance</p>
                    <p className="font-medium text-text dark:text-dark-text">₦{selectedMerchant.wallet?.pendingBalance?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-surface-muted dark:border-dark-surface-muted">
              <button onClick={() => setShowDetailsModal(false)} className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Reject Merchant</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowRejectModal(false); setRejectionReason(''); setSelectedMerchant(null) }} className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                Cancel
              </button>
              <button 
                onClick={handleReject} 
                disabled={!rejectionReason.trim() || actionLoading === 'reject'}
                className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading === 'reject' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Suspend Merchant</h3>
            <textarea
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowSuspendModal(false); setSuspensionReason(''); setSelectedMerchant(null) }} className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                Cancel
              </button>
              <button 
                onClick={handleSuspend} 
                disabled={!suspensionReason.trim() || actionLoading === 'suspend'}
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

      {/* Commission Modal */}
      {showCommissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Update Commission Rate</h3>
            <input
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              placeholder="Enter commission rate (0-100)"
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
              min="0"
              max="100"
              step="0.1"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCommissionModal(false); setCommissionRate(''); setSelectedMerchant(null) }} className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                Cancel
              </button>
              <button 
                onClick={handleUpdateCommission} 
                disabled={!commissionRate || isNaN(commissionRate) || actionLoading === 'commission'}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading === 'commission' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Merchant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Create New Merchant</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">Merchant Name</label>
                <input
                  type="text"
                  value={newMerchant.name}
                  onChange={(e) => setNewMerchant({ ...newMerchant, name: e.target.value })}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Enter merchant name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">Type</label>
                <select
                  value={newMerchant.type}
                  onChange={(e) => setNewMerchant({ ...newMerchant, type: e.target.value })}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  <option value="FOOD">Food</option>
                  <option value="GROCERY">Grocery</option>
                  <option value="PHARMACY">Pharmacy</option>
                  <option value="PACKAGE">Package</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">Email</label>
                <input
                  type="email"
                  value={newMerchant.email}
                  onChange={(e) => setNewMerchant({ ...newMerchant, email: e.target.value })}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">Phone</label>
                <input
                  type="text"
                  value={newMerchant.phone}
                  onChange={(e) => setNewMerchant({ ...newMerchant, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">Address</label>
                <textarea
                  value={newMerchant.address}
                  onChange={(e) => setNewMerchant({ ...newMerchant, address: e.target.value })}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Enter address"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => { setShowCreateModal(false); setNewMerchant({ name: '', type: 'FOOD', email: '', phone: '', address: '', lat: 0, lng: 0 }) }} className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                Cancel
              </button>
              <button 
                onClick={handleCreateMerchant}
                disabled={actionLoading === 'create'}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading === 'create' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Merchant'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Merchant Modal */}
      {showDeleteModal && merchantToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">Delete Merchant</h3>
            <p className="text-muted dark:text-dark-muted mb-2">
              Are you sure you want to delete <span className="font-semibold">{merchantToDelete.name}</span>?
            </p>
            <p className="text-sm text-muted dark:text-dark-muted mb-6">
              This action cannot be undone. The merchant will be soft-deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDeleteModal(false); setMerchantToDelete(null) }} className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                Cancel
              </button>
              <button 
                onClick={handleDeleteMerchant}
                disabled={actionLoading === 'delete'}
                className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading === 'delete' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
