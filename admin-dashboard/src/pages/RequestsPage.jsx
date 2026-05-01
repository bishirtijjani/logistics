import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAllRequests, reassignRider, forceCancelRequest, adminUpdateStatus } from '../store/slices/requestsSlice'
import { exportToCSV } from '../lib/exportToCSV'
import { Search, Filter, MoreVertical, User, Store, Bike, Clock, DollarSign, CheckCircle, XCircle, X, MapPin, Phone, Mail, Download } from 'lucide-react'
import Pagination from '../components/Pagination'

const STATUS_COLORS = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  RIDER_ASSIGNED: 'bg-purple-100 text-purple-800',
  PICKED_UP: 'bg-indigo-100 text-indigo-800',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default function RequestsPage() {
  const dispatch = useDispatch()
  const { requests, total, page, loading } = useSelector((state) => state.requests)
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    startDate: '',
    endDate: '',
  })
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [newRiderId, setNewRiderId] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    dispatch(fetchAllRequests({ page: 1, limit: 20 }))
  }, [dispatch])

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleSearch = () => {
    dispatch(fetchAllRequests({ page: 1, limit: 20, ...filters }))
  }

  const handlePageChange = (newPage) => {
    dispatch(fetchAllRequests({ page: newPage, limit: pageSize, ...filters }))
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    dispatch(fetchAllRequests({ page: 1, limit: newPageSize, ...filters }))
  }

  const handleViewDetails = (request) => {
    setSelectedRequest(request)
    setShowDetailsModal(true)
  }

  const handleReassignRider = async () => {
    if (!newRiderId) return
    setActionLoading('reassign')
    await dispatch(reassignRider({ requestId: selectedRequest.id, newRiderId }))
    setActionLoading(null)
    setShowReassignModal(false)
    setNewRiderId('')
    dispatch(fetchAllRequests({ page, limit: 20, ...filters }))
  }

  const handleForceCancel = async () => {
    if (!cancelReason.trim()) return
    setActionLoading('cancel')
    await dispatch(forceCancelRequest({ requestId: selectedRequest.id, reason: cancelReason }))
    setActionLoading(null)
    setShowCancelModal(false)
    setCancelReason('')
    setShowDetailsModal(false)
    dispatch(fetchAllRequests({ page, limit: 20, ...filters }))
  }

  const handleStatusUpdate = async (status) => {
    await dispatch(adminUpdateStatus({ requestId: selectedRequest.id, status, reason: 'Admin update' }))
    dispatch(fetchAllRequests({ page, limit: 20, ...filters }))
  }

  const handleExportCSV = () => {
    const csvData = requests.map(r => ({
      id: r.id,
      type: r.type,
      status: r.status,
      total: r.total,
      customerEmail: r.customer?.email,
      merchantName: r.merchant?.name,
      riderName: r.rider?.user?.firstName ? `${r.rider.user.firstName} ${r.rider.user.lastName}` : '',
      createdAt: r.createdAt,
    }))
    exportToCSV(csvData, 'requests', ['id', 'type', 'status', 'total', 'customerEmail', 'merchantName', 'riderName', 'createdAt'])
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Requests</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex gap-4 mb-4 flex-wrap justify-between items-center">
          <div className="flex gap-4 flex-wrap">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="PROCESSING">Processing</option>
            <option value="READY_FOR_PICKUP">Ready for Pickup</option>
            <option value="RIDER_ASSIGNED">Rider Assigned</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">All Types</option>
            <option value="FOOD">Food</option>
            <option value="GROCERY">Grocery</option>
            <option value="PHARMACY">Pharmacy</option>
            <option value="PACKAGE">Package</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Filter size={18} />
            Apply Filters
          </button>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={requests.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">No requests found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Request ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Merchant</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rider</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50 dark:bg-gray-700 cursor-pointer" onClick={() => handleViewDetails(request)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    #{request.id.slice(-8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      {request.customer?.firstName} {request.customer?.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {request.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[request.status] || 'bg-gray-100 text-gray-800'}`}>
                      {request.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {request.merchant ? (
                      <div className="flex items-center gap-2">
                        <Store size={16} />
                        {request.merchant.name}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {request.rider ? (
                      <div className="flex items-center gap-2">
                        <Bike size={16} />
                        {request.rider.user?.firstName} {request.rider.user?.lastName}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} />
                      ₦{request.total?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-gray-400 hover:text-gray-600 dark:text-gray-300" onClick={(e) => { e.stopPropagation(); handleViewDetails(request) }}>
                      <MoreVertical size={20} />
                    </button>
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

      {/* Request Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Request Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-300">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Request ID</p>
                  <p className="font-medium text-gray-900 dark:text-white">#{selectedRequest.id.slice(-8)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedRequest.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedRequest.status]}`}>
                    {selectedRequest.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
                  <p className="font-medium text-gray-900 dark:text-white">₦{selectedRequest.total?.toLocaleString()}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Customer Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">{selectedRequest.customer?.firstName} {selectedRequest.customer?.lastName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">{selectedRequest.customer?.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">{selectedRequest.customer?.email}</span>
                  </div>
                </div>
              </div>

              {selectedRequest.merchant && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Merchant Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Store size={16} className="text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-300">{selectedRequest.merchant.name}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Type: {selectedRequest.merchant.type}</p>
                  </div>
                </div>
              )}

              {selectedRequest.rider && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Rider Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bike size={16} className="text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-300">{selectedRequest.rider.user?.firstName} {selectedRequest.rider.user?.lastName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-300">{selectedRequest.rider.user?.phone}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Location Details</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Pickup</p>
                      <p className="text-gray-600 dark:text-gray-300">{selectedRequest.pickupAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Dropoff</p>
                      <p className="text-gray-600 dark:text-gray-300">{selectedRequest.dropoffAddress}</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRequest.items && selectedRequest.items.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Order Items</h3>
                  <div className="space-y-2">
                    {selectedRequest.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{item.name} x {item.quantity}</span>
                        <span className="text-gray-900 dark:text-white">₦{(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Financial Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Subtotal</span>
                    <span className="text-gray-900 dark:text-white">₦{selectedRequest.subtotal?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Delivery Fee</span>
                    <span className="text-gray-900 dark:text-white">₦{selectedRequest.deliveryFee?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Platform Fee</span>
                    <span className="text-gray-900 dark:text-white">₦{selectedRequest.platformFee?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-gray-900 dark:text-white">₦{selectedRequest.total?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              {selectedRequest.status !== 'CANCELLED' && selectedRequest.status !== 'DELIVERED' && selectedRequest.status !== 'SETTLED' && (
                <>
                  <button
                    onClick={() => { setShowReassignModal(true) }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Reassign Rider
                  </button>
                  <button
                    onClick={() => { setShowCancelModal(true) }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Force Cancel
                  </button>
                </>
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cancel Request</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Please provide a reason for cancelling this request:</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4"
              rows="3"
              placeholder="Enter cancellation reason..."
            />
            <div className="flex gap-3">
              <button
                onClick={handleForceCancel}
                disabled={!cancelReason.trim() || actionLoading === 'cancel'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading === 'cancel' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancel'
                )}
              </button>
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason('') }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Rider Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Reassign Rider</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Enter the new rider ID:</p>
            <input
              type="text"
              value={newRiderId}
              onChange={(e) => setNewRiderId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none mb-4"
              placeholder="Enter rider ID..."
            />
            <div className="flex gap-3">
              <button
                onClick={handleReassignRider}
                disabled={!newRiderId.trim() || actionLoading === 'reassign'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading === 'reassign' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Reassigning...
                  </>
                ) : (
                  'Confirm Reassign'
                )}
              </button>
              <button
                onClick={() => { setShowReassignModal(false); setNewRiderId('') }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
