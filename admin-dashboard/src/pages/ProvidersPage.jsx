import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAllProviders, approveProvider, rejectProvider, suspendProvider, unsuspendProvider, updateProviderCommission } from '../store/slices/providersSlice'
import { Store, Check, X, Shield, ShieldAlert, MoreVertical, Mail, Phone, DollarSign, MapPin, Eye, Edit, X as CloseIcon } from 'lucide-react'

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  REJECTED: 'bg-gray-100 text-gray-800',
}

export default function ProvidersPage() {
  const dispatch = useDispatch()
  const { providers, total, page, loading } = useSelector((state) => state.providers)
  const [filters, setFilters] = useState({ type: '', status: '' })
  const [rejectionReason, setRejectionReason] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [commissionRate, setCommissionRate] = useState('')
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showCommissionModal, setShowCommissionModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    dispatch(fetchAllProviders({ page: 1, limit: 20, ...filters }))
  }, [dispatch, filters])

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleApprove = async (providerId) => {
    await dispatch(approveProvider(providerId))
    dispatch(fetchAllProviders({ page: 1, limit: 20, ...filters }))
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) return
    await dispatch(rejectProvider({ providerId: selectedProvider.id, reason: rejectionReason }))
    setShowRejectModal(false)
    setRejectionReason('')
    setSelectedProvider(null)
    dispatch(fetchAllProviders({ page: 1, limit: 20, ...filters }))
  }

  const handleSuspend = async () => {
    if (!suspensionReason.trim()) return
    await dispatch(suspendProvider({ providerId: selectedProvider.id, reason: suspensionReason }))
    setShowSuspendModal(false)
    setSuspensionReason('')
    setSelectedProvider(null)
    dispatch(fetchAllProviders({ page: 1, limit: 20, ...filters }))
  }

  const handleUnsuspend = async (providerId) => {
    await dispatch(unsuspendProvider(providerId))
    dispatch(fetchAllProviders({ page: 1, limit: 20, ...filters }))
  }

  const handleUpdateCommission = async () => {
    if (!commissionRate || isNaN(commissionRate)) return
    await dispatch(updateProviderCommission({ providerId: selectedProvider.id, commissionRate: parseFloat(commissionRate) }))
    setShowCommissionModal(false)
    setCommissionRate('')
    setSelectedProvider(null)
    dispatch(fetchAllProviders({ page: 1, limit: 20, ...filters }))
  }

  const openRejectModal = (provider) => {
    setSelectedProvider(provider)
    setShowRejectModal(true)
  }

  const openSuspendModal = (provider) => {
    setSelectedProvider(provider)
    setShowSuspendModal(true)
  }

  const openCommissionModal = (provider) => {
    setSelectedProvider(provider)
    setCommissionRate(provider.commissionRate?.toString() || '')
    setShowCommissionModal(true)
  }

  const openDetailsModal = (provider) => {
    setSelectedProvider(provider)
    setShowDetailsModal(true)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Providers Management</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex gap-4 flex-wrap">
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">All Types</option>
            <option value="FOOD">Food</option>
            <option value="GROCERY">Grocery</option>
            <option value="PHARMACY">Pharmacy</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading providers...</div>
        ) : providers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No providers found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {providers.map((provider) => (
                <tr key={provider.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <Store size={20} className="text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                        <p className="text-xs text-gray-500">{provider.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{provider.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[provider.status]}`}>
                      {provider.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} />
                      ₦{provider.wallet?.availableBalance?.toLocaleString() || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{provider.commissionRate}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => openDetailsModal(provider)} className="p-2 text-gray-400 hover:text-gray-600" title="View Details">
                        <Eye size={18} />
                      </button>
                      {provider.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleApprove(provider.id)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Approve">
                            <Check size={18} />
                          </button>
                          <button onClick={() => openRejectModal(provider)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Reject">
                            <X size={18} />
                          </button>
                        </>
                      )}
                      {provider.status === 'ACTIVE' && (
                        <>
                          <button onClick={() => openCommissionModal(provider)} className="p-2 text-gray-400 hover:text-gray-600" title="Edit Commission">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => openSuspendModal(provider)} className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200" title="Suspend">
                            <ShieldAlert size={18} />
                          </button>
                        </>
                      )}
                      {provider.status === 'SUSPENDED' && (
                        <button onClick={() => handleUnsuspend(provider.id)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Unsuspend">
                          <Shield size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Provider Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                <CloseIcon size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Provider Name</p>
                  <p className="font-medium text-gray-900">{selectedProvider.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium text-gray-900">{selectedProvider.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedProvider.status]}`}>
                    {selectedProvider.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Commission Rate</p>
                  <p className="font-medium text-gray-900">{selectedProvider.commissionRate}%</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-400" />
                    <span className="text-gray-600">{selectedProvider.user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-gray-400" />
                    <span className="text-gray-600">{selectedProvider.user?.phone}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Location</h3>
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-gray-400 mt-1" />
                  <p className="text-gray-600">{selectedProvider.address}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Wallet Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Available Balance</p>
                    <p className="font-medium text-gray-900">₦{selectedProvider.wallet?.availableBalance?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pending Balance</p>
                    <p className="font-medium text-gray-900">₦{selectedProvider.wallet?.pendingBalance?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button onClick={() => setShowDetailsModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Provider</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowRejectModal(false); setRejectionReason(''); setSelectedProvider(null) }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleReject} disabled={!rejectionReason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Suspend Provider</h3>
            <textarea
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowSuspendModal(false); setSuspensionReason(''); setSelectedProvider(null) }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSuspend} disabled={!suspensionReason.trim()} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commission Modal */}
      {showCommissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Commission Rate</h3>
            <input
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              placeholder="Enter commission rate (0-100)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4"
              min="0"
              max="100"
              step="0.1"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCommissionModal(false); setCommissionRate(''); setSelectedProvider(null) }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleUpdateCommission} disabled={!commissionRate || isNaN(commissionRate)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
