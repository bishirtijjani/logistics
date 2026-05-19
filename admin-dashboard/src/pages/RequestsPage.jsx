import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAllRequests, reassignRider, forceCancelRequest, adminUpdateStatus } from '../store/slices/requestsSlice'
import { fetchCategories } from '../store/slices/categoriesSlice'
import { exportToCSV } from '../lib/exportToCSV'
import { Search, Filter, MoreVertical, User, Store, Bike, Clock, DollarSign, CheckCircle, XCircle, X, MapPin, Phone, Mail, Download } from 'lucide-react'
import Pagination from '../components/Pagination'

const STATUS_COLORS = {
  REQUESTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ACCEPTED: 'bg-primary/10 text-primary',
  RIDER_ASSIGNED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  PICKED_UP: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  DELIVERED: 'bg-success/10 text-success',
  CANCELLED: 'bg-error/10 text-error',
}

export default function RequestsPage() {
  const dispatch = useDispatch()
  const { requests, total, page, loading } = useSelector((state) => state.requests)
  const { list: categories } = useSelector((s) => s.categories)
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    categorySlug: '',
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
    if (categories.length === 0) dispatch(fetchCategories({ limit: 200 }))
  }, [dispatch, categories.length])

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
      <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-6">Requests</h1>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center lg:justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2 sm:gap-3 flex-1">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm w-full lg:w-auto"
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
              className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm w-full lg:w-auto"
            >
              <option value="">All Types</option>
              <option value="MERCHANT_ORDER">Merchant Order</option>
              <option value="PACKAGE">Package</option>
            </select>
            <select
              value={filters.categorySlug}
              onChange={(e) => handleFilterChange('categorySlug', e.target.value)}
              disabled={filters.type === 'PACKAGE'}
              className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none disabled:opacity-50 text-sm w-full lg:w-auto"
            >
              <option value="">All Categories</option>
              {categories.filter((c) => c.isActive).map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm w-full lg:w-auto"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm w-full lg:w-auto"
            />
            <button
              onClick={handleSearch}
              className="col-span-2 sm:col-span-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 text-sm w-full lg:w-auto"
            >
              <Filter size={16} />
              Apply
            </button>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={requests.length === 0}
            className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm w-full lg:w-auto"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">No requests found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Request ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Merchant</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Rider</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted cursor-pointer" onClick={() => handleViewDetails(request)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                    #{request.id.slice(-8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      {request.customer?.firstName} {request.customer?.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    {request.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[request.status] || 'bg-surface-muted text-muted'}`}>
                      {request.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    {request.merchant ? (
                      <div className="flex items-center gap-2">
                        <Store size={16} />
                        {request.merchant.name}
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    {request.rider ? (
                      <div className="flex items-center gap-2">
                        <Bike size={16} />
                        {request.rider.user?.firstName} {request.rider.user?.lastName}
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} />
                      ₦{request.total?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text" onClick={(e) => { e.stopPropagation(); handleViewDetails(request) }}>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-surface-muted dark:border-dark-surface-muted flex justify-between items-center sticky top-0 bg-surface dark:bg-dark-surface z-10">
              <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text">Request Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Request ID</p>
                  <p className="font-medium text-text dark:text-dark-text">#{selectedRequest.id.slice(-8)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Type</p>
                  <p className="font-medium text-text dark:text-dark-text">{selectedRequest.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedRequest.status]}`}>
                    {selectedRequest.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted dark:text-dark-muted">Total Amount</p>
                  <p className="font-medium text-text dark:text-dark-text">₦{selectedRequest.total?.toLocaleString()}</p>
                </div>
              </div>

              <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <h3 className="font-semibold text-text dark:text-dark-text mb-3">Customer Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-muted" />
                    <span className="text-muted dark:text-dark-muted">{selectedRequest.customer?.firstName} {selectedRequest.customer?.lastName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-muted" />
                    <span className="text-muted dark:text-dark-muted">{selectedRequest.customer?.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-muted" />
                    <span className="text-muted dark:text-dark-muted">{selectedRequest.customer?.email}</span>
                  </div>
                </div>
              </div>

              {selectedRequest.merchant && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Merchant Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Store size={16} className="text-muted" />
                      <span className="text-muted dark:text-dark-muted">{selectedRequest.merchant.name}</span>
                    </div>
                    <p className="text-sm text-muted dark:text-dark-muted">Type: {selectedRequest.merchant.type}</p>
                  </div>
                </div>
              )}

              {selectedRequest.rider && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Rider Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bike size={16} className="text-muted" />
                      <span className="text-muted dark:text-dark-muted">{selectedRequest.rider.user?.firstName} {selectedRequest.rider.user?.lastName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-muted" />
                      <span className="text-muted dark:text-dark-muted">{selectedRequest.rider.user?.phone}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <h3 className="font-semibold text-text dark:text-dark-text mb-3">Location Details</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-muted mt-1" />
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">Pickup</p>
                      <p className="text-muted dark:text-dark-muted">{selectedRequest.pickupAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-muted mt-1" />
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">Dropoff</p>
                      <p className="text-muted dark:text-dark-muted">{selectedRequest.dropoffAddress}</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRequest.items && selectedRequest.items.length > 0 && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Order Items</h3>
                  <div className="space-y-2">
                    {selectedRequest.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-muted dark:text-dark-muted">{item.name} x {item.quantity}</span>
                        <span className="text-text dark:text-dark-text">₦{(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 5 — POD card. Visible once the rider has captured at
                  least one POD artefact (photo / signature). Investigators
                  click through to the Cloudinary asset for the full-res view. */}
              {(selectedRequest.podPhotoUrl || selectedRequest.podSignatureUrl) ? (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-3">Proof of Delivery</h3>
                  {selectedRequest.podCapturedAt ? (
                    <p className="text-xs text-muted dark:text-dark-muted mb-3">
                      Captured {new Date(selectedRequest.podCapturedAt).toLocaleString()}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    {selectedRequest.podPhotoUrl ? (
                      <a
                        href={selectedRequest.podPhotoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-32 rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted"
                        title="Open doorstep photo"
                      >
                        <img src={selectedRequest.podPhotoUrl} alt="Doorstep" className="w-full aspect-[4/3] object-cover" loading="lazy" />
                        <span className="block px-2 py-1 text-xs text-muted dark:text-dark-muted">Photo</span>
                      </a>
                    ) : null}
                    {selectedRequest.podSignatureUrl ? (
                      <a
                        href={selectedRequest.podSignatureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-32 rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted"
                        title="Open signature"
                      >
                        <div className="w-full aspect-[4/3] bg-white flex items-center justify-center">
                          <img src={selectedRequest.podSignatureUrl} alt="Signature" className="max-w-full max-h-full object-contain" loading="lazy" />
                        </div>
                        <span className="block px-2 py-1 text-xs text-muted dark:text-dark-muted">Signature</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <h3 className="font-semibold text-text dark:text-dark-text mb-3">Financial Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Subtotal</span>
                    <span className="text-text dark:text-dark-text">₦{selectedRequest.subtotal?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Delivery Fee</span>
                    <span className="text-text dark:text-dark-text">₦{selectedRequest.deliveryFee?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Platform Fee</span>
                    <span className="text-text dark:text-dark-text">₦{selectedRequest.platformFee?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-surface-muted dark:border-dark-surface-muted pt-2">
                    <span className="text-text dark:text-dark-text">Total</span>
                    <span className="text-text dark:text-dark-text">₦{selectedRequest.total?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-surface-muted dark:border-dark-surface-muted flex flex-col sm:flex-row gap-2 sm:gap-3">
              {selectedRequest.status !== 'CANCELLED' && selectedRequest.status !== 'DELIVERED' && selectedRequest.status !== 'SETTLED' && (
                <>
                  <button
                    onClick={() => { setShowReassignModal(true) }}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors w-full sm:w-auto"
                  >
                    Reassign Rider
                  </button>
                  <button
                    onClick={() => { setShowCancelModal(true) }}
                    className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error-700 transition-colors w-full sm:w-auto"
                  >
                    Force Cancel
                  </button>
                </>
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted transition-colors w-full sm:w-auto sm:ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text mb-4">Cancel Request</h2>
            <p className="text-muted dark:text-dark-muted mb-4">Please provide a reason for cancelling this request:</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 dark:bg-dark-surface-muted dark:text-dark-text"
              rows="3"
              placeholder="Enter cancellation reason..."
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleForceCancel}
                disabled={!cancelReason.trim() || actionLoading === 'cancel'}
                className="w-full sm:w-auto px-4 py-2 bg-error text-white rounded-lg hover:bg-error-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                className="w-full sm:w-auto px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Rider Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text mb-4">Reassign Rider</h2>
            <p className="text-muted dark:text-dark-muted mb-4">Enter the new rider ID:</p>
            <input
              type="text"
              value={newRiderId}
              onChange={(e) => setNewRiderId(e.target.value)}
              className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 dark:bg-dark-surface-muted dark:text-dark-text"
              placeholder="Enter rider ID..."
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleReassignRider}
                disabled={!newRiderId.trim() || actionLoading === 'reassign'}
                className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                className="w-full sm:w-auto px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted transition-colors"
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
