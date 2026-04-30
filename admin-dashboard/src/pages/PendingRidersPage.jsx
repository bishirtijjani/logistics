import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchPendingRiders, reviewRider } from '../store/slices/pendingRidersSlice'
import { User, Phone, Check, X, FileText, Calendar } from 'lucide-react'

export default function PendingRidersPage() {
  const dispatch = useDispatch()
  const { riders, total, page, loading } = useSelector((state) => state.pendingRiders)
  const [selectedRider, setSelectedRider] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    dispatch(fetchPendingRiders({ page: 1, limit: 20 }))
  }, [dispatch])

  const handlePageChange = (newPage) => {
    dispatch(fetchPendingRiders({ page: newPage, limit: 20 }))
  }

  const handleViewDetails = (rider) => {
    setSelectedRider(rider)
    setShowDetailsModal(true)
  }

  const handleApprove = async (riderId) => {
    setActionLoading(riderId)
    await dispatch(reviewRider({ riderId, decision: 'approve' }))
    setActionLoading(null)
    setShowDetailsModal(false)
  }

  const handleReject = async (riderId) => {
    setActionLoading(riderId)
    await dispatch(reviewRider({ riderId, decision: 'reject' }))
    setActionLoading(null)
    setShowDetailsModal(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pending Rider Reviews</h1>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading pending riders...</div>
        ) : riders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No pending riders to review</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rider ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {riders.map((rider) => (
                <tr key={rider.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewDetails(rider)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{rider.id.slice(-8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      {rider.user?.firstName} {rider.user?.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Phone size={16} />
                      {rider.user?.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending Approval
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      {new Date(rider.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(rider.id) }}
                        disabled={actionLoading === rider.id}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Approve"
                      >
                        {actionLoading === rider.id ? (
                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check size={18} />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReject(rider.id) }}
                        disabled={actionLoading === rider.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Reject"
                      >
                        {actionLoading === rider.id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <X size={18} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 20 && (
        <div className="flex justify-between items-center mt-6">
          <p className="text-sm text-gray-600">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} pending riders
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page * 20 >= total}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Rider Details Modal */}
      {showDetailsModal && selectedRider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Rider Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Rider ID</p>
                  <p className="font-medium text-gray-900">#{selectedRider.id.slice(-8)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending Approval
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="font-medium text-gray-900">{selectedRider.user?.firstName} {selectedRider.user?.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{selectedRider.user?.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vehicle Type</p>
                  <p className="font-medium text-gray-900">{selectedRider.vehicleType || 'Motorcycle'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">License Plate</p>
                  <p className="font-medium text-gray-900">{selectedRider.licensePlate || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Registered</p>
                  <p className="font-medium text-gray-900">{new Date(selectedRider.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedRider.kycStatus && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText size={18} />
                    KYC Status
                  </h3>
                  <p className="text-gray-600">{selectedRider.kycStatus}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => handleApprove(selectedRider.id)}
                disabled={actionLoading === selectedRider.id}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === selectedRider.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Approve Rider
                  </>
                )}
              </button>
              <button
                onClick={() => handleReject(selectedRider.id)}
                disabled={actionLoading === selectedRider.id}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === selectedRider.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <X size={18} />
                    Reject Rider
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
