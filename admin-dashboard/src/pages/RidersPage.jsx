import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAllRiders, fetchRiderEarnings, fetchRiderDeliveryHistory, clearSelectedRider } from '../store/slices/ridersSlice'
import { Bike, User, Phone, Mail, DollarSign, Star, Clock, MoreVertical, Check, X, Eye, Package, X as CloseIcon } from 'lucide-react'

const STATUS_COLORS = {
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  REJECTED: 'bg-gray-100 text-gray-800',
}

const AVAILABILITY_COLORS = {
  ONLINE: 'bg-green-100 text-green-800',
  OFFLINE: 'bg-gray-100 text-gray-800',
  ON_DELIVERY: 'bg-blue-100 text-blue-800',
}

export default function RidersPage() {
  const dispatch = useDispatch()
  const { riders, total, page, riderEarnings, riderDeliveries, loading } = useSelector((state) => state.riders)
  const [filters, setFilters] = useState({
    status: '',
    availability: '',
  })
  const [selectedRider, setSelectedRider] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    dispatch(fetchAllRiders({ page: 1, limit: 20 }))
  }, [dispatch])

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleApplyFilters = () => {
    dispatch(fetchAllRiders({ page: 1, limit: 20, ...filters }))
  }

  const handlePageChange = (newPage) => {
    dispatch(fetchAllRiders({ page: newPage, limit: 20, ...filters }))
  }

  const handleViewDetails = async (rider) => {
    setSelectedRider(rider)
    await dispatch(fetchRiderEarnings({ riderId: rider.id }))
    await dispatch(fetchRiderDeliveryHistory({ riderId: rider.id, page: 1, limit: 20 }))
    setShowDetailsModal(true)
    setActiveTab('details')
  }

  const handleCloseModal = () => {
    setShowDetailsModal(false)
    setSelectedRider(null)
    dispatch(clearSelectedRider())
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Riders Management</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex gap-4">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={filters.availability}
            onChange={(e) => handleFilterChange('availability', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">All Availability</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="ON_DELIVERY">On Delivery</option>
          </select>
          <button
            onClick={handleApplyFilters}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading riders...</div>
        ) : riders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No riders found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rider</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Availability</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deliveries</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {riders.map((rider) => (
                <tr key={rider.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <Bike size={20} className="text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {rider.user?.firstName} {rider.user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{rider.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Phone size={14} />
                        {rider.user?.phone}
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail size={14} />
                        {rider.user?.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div>
                      <p className="font-medium">{rider.vehicleType}</p>
                      <p className="text-xs text-gray-500">{rider.plateNumber}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[rider.status] || 'bg-gray-100 text-gray-800'}`}>
                      {rider.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${AVAILABILITY_COLORS[rider.availability] || 'bg-gray-100 text-gray-800'}`}>
                      {rider.availability.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Star size={16} className="text-yellow-500 fill-yellow-500" />
                      {rider.averageRating?.toFixed(1) || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {rider.totalDeliveries || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(rider)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
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
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} riders
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

      {showDetailsModal && selectedRider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <Bike size={24} className="text-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedRider.user?.firstName} {selectedRider.user?.lastName}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedRider.user?.email}</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <CloseIcon size={24} />
              </button>
            </div>

            <div className="border-b border-gray-200">
              <div className="flex gap-4 px-6">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === 'details'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('earnings')}
                  className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === 'earnings'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Earnings
                </button>
                <button
                  onClick={() => setActiveTab('deliveries')}
                  className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === 'deliveries'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Delivery History
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Phone</p>
                      <p className="font-medium flex items-center gap-2">
                        <Phone size={16} />
                        {selectedRider.user?.phone}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Status</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedRider.status]}`}>
                        {selectedRider.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Vehicle Type</p>
                      <p className="font-medium">{selectedRider.vehicleType}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Plate Number</p>
                      <p className="font-medium">{selectedRider.plateNumber}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Rating</p>
                      <p className="font-medium flex items-center gap-2">
                        <Star size={16} className="text-yellow-500 fill-yellow-500" />
                        {selectedRider.averageRating?.toFixed(1) || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Total Deliveries</p>
                      <p className="font-medium">{selectedRider.totalDeliveries || 0}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Availability</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${AVAILABILITY_COLORS[selectedRider.availability]}`}>
                        {selectedRider.availability.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'earnings' && riderEarnings && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Today</p>
                      <p className="text-xl font-bold text-green-700">
                        ₦{riderEarnings.today?.earnings?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-gray-500">{riderEarnings.today?.deliveries || 0} deliveries</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">This Week</p>
                      <p className="text-xl font-bold text-blue-700">
                        ₦{riderEarnings.thisWeek?.earnings?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-gray-500">{riderEarnings.thisWeek?.deliveries || 0} deliveries</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">This Month</p>
                      <p className="text-xl font-bold text-purple-700">
                        ₦{riderEarnings.thisMonth?.earnings?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-gray-500">{riderEarnings.thisMonth?.deliveries || 0} deliveries</p>
                    </div>
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">All Time</p>
                      <p className="text-xl font-bold text-gray-700">
                        ₦{riderEarnings.allTime?.earnings?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-gray-500">{riderEarnings.allTime?.deliveries || 0} deliveries</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Wallet Balance</p>
                    <p className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <DollarSign size={24} />
                      ₦{riderEarnings.walletBalance?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'deliveries' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery History</h3>
                  {riderDeliveries && riderDeliveries.length > 0 ? (
                    <div className="space-y-3">
                      {riderDeliveries.map((delivery) => (
                        <div key={delivery.id} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Package size={16} className="text-gray-400" />
                              <span className="font-medium text-gray-900">#{delivery.id.slice(-8)}</span>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[delivery.status] || 'bg-gray-100 text-gray-800'}`}>
                              {delivery.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-gray-500">From</p>
                              <p className="text-gray-900">{delivery.pickupAddress}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">To</p>
                              <p className="text-gray-900">{delivery.dropoffAddress}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Amount</p>
                              <p className="text-gray-900">₦{delivery.earnings?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Date</p>
                              <p className="text-gray-900">{new Date(delivery.completedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No delivery history found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
