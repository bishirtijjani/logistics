import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchPendingRiders, reviewRider } from '../store/slices/pendingRidersSlice'
import { Bike, UserCheck, Check, X, Search, Eye, Phone, Mail, Calendar, Shield, ShieldAlert, User, Clock, FileText } from 'lucide-react'
import Pagination from '../components/Pagination'

export default function PendingRidersPage() {
  const dispatch = useDispatch()
  const { riders, total, page, loading } = useSelector((state) => state.pendingRiders)
  const [selectedRider, setSelectedRider] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    dispatch(fetchPendingRiders({ page: 1, limit: 20 }))
  }, [dispatch])

  const handlePageChange = (newPage) => {
    dispatch(fetchPendingRiders({ page: newPage, limit: pageSize }))
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    dispatch(fetchPendingRiders({ page: 1, limit: newPageSize }))
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
    <div>
      <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-6">Pending Rider Reviews</h1>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">Loading pending riders...</div>
        ) : riders.length === 0 ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">No pending riders found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Rider ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
                {riders.map((rider) => (
                  <tr key={rider.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted cursor-pointer" onClick={() => handleViewDetails(rider)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                      #{rider.id.slice(-8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      <div className="flex items-center gap-2">
                        <User size={16} />
                        {rider.user?.firstName} {rider.user?.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      <div className="flex items-center gap-2">
                        <Phone size={16} />
                        {rider.user?.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      <div className="flex items-center gap-2">
                        <Clock size={16} />
                        {rider.user?.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending Approval
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(rider.id) }}
                          disabled={actionLoading === rider.id}
                          className="p-2 text-success hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Approve"
                        >
                          {actionLoading === rider.id ? (
                            <div className="w-4 h-4 border-2 border-success border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check size={18} />
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReject(rider.id) }}
                          disabled={actionLoading === rider.id}
                          className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Reject"
                        >
                          {actionLoading === rider.id ? (
                            <div className="w-4 h-4 border-2 border-error border-t-transparent rounded-full animate-spin" />
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

      {/* Rider Details Modal */}
      {showDetailsModal && selectedRider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-surface-muted dark:border-dark-surface-muted flex justify-between items-center sticky top-0 bg-surface dark:bg-dark-surface z-10">
              <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text">Rider Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Rider ID</p>
                  <p className="font-medium text-text dark:text-dark-text">#{selectedRider.id.slice(-8)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Status</p>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {selectedRider.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Full Name</p>
                  <p className="font-medium text-text dark:text-dark-text">{selectedRider.user?.firstName} {selectedRider.user?.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Phone</p>
                  <p className="font-medium text-text dark:text-dark-text">{selectedRider.user?.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Vehicle Type</p>
                  <p className="font-medium text-text dark:text-dark-text">{selectedRider.vehicleType || 'Motorcycle'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">License Plate</p>
                  <p className="font-medium text-text dark:text-dark-text">{selectedRider.licensePlate || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Registered</p>
                  <p className="font-medium text-text dark:text-dark-text">{new Date(selectedRider.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedRider.kycStatus && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3 flex items-center gap-2">
                    <FileText size={18} />
                    KYC Status
                  </h3>
                  <p className="text-muted dark:text-dark-muted">{selectedRider.kycStatus}</p>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-6 border-t border-surface-muted dark:border-dark-surface-muted flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => handleApprove(selectedRider.id)}
                disabled={actionLoading === selectedRider.id}
                className="w-full sm:flex-1 px-4 py-2 bg-success text-white rounded-lg hover:bg-success/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full sm:flex-1 px-4 py-2 bg-error text-white rounded-lg hover:bg-error-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full sm:w-auto px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted transition-colors"
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
