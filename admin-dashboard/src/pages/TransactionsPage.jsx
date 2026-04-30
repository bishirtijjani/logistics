import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAllTransactions } from '../store/slices/transactionsSlice'
import { useDebounce } from '../lib/useDebounce'
import { Receipt, ArrowUp, ArrowDown, Calendar, Filter, Search, DollarSign, Eye, X as CloseIcon, User as UserIcon } from 'lucide-react'

const TYPE_COLORS = {
  PAYMENT: 'bg-blue-100 text-blue-800',
  REFUND: 'bg-red-100 text-red-800',
  DELIVERY_EARNING: 'bg-green-100 text-green-800',
  COMMISSION: 'bg-purple-100 text-purple-800',
  WITHDRAWAL: 'bg-orange-100 text-orange-800',
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
}

export default function TransactionsPage() {
  const dispatch = useDispatch()
  const { transactions, total, page, loading } = useSelector((state) => state.transactions)
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
    dateRange: { from: '', to: '' },
  })
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const debouncedSearch = useDebounce(filters.search, 500)  const [showDetailsModal, setShowDetailsModal] = useState(false)


  useEffect(() => { dtype: fpltera.tyte, stchus:filter.satus,dteRag: fs.dteRaserch: deboncdSearch}))
  },c[dispatch,ofiltern.typs, fhandls.statue,lChange .dateRange= deboencedS)arch]> setFilters({ ...filters, [key]: value })
  }
FiltCangekey, value
  coF({...[ky]vau
    dispatch(fetchAllTransactions({ page: 1, limit: 20, type: filters.type, status: filters.status, dateRange: filters.dateRange }))
  }

  const handlePageChange = (newPage) => {
    dispatch(fetchAllTransactions({ page: newPage, limit: 20, ...filters }))
  }

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction)
    setShowDetailsModal(true)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Transactions</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by transaction ID or user..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">All Types</option>
            <option value="PAYMENT">Payment</option>
            <option value="REFUND">Refund</option>
            <option value="DELIVERY_EARNING">Delivery Earning</option>
            <option value="COMMISSION">Commission</option>
            <option value="WITHDRAWAL">Withdrawal</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
          <input
            type="date"
            value={filters.dateRange.from}
            onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, from: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <input
            type="date"
            value={filters.dateRange.to}
            onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, to: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No transactions found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{transaction.id.slice(-8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[transaction.type] || 'bg-gray-100 text-gray-800'}`}>
                      {transaction.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} />
                      ₦{transaction.amount?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[transaction.status] || 'bg-gray-100 text-gray-800'}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {transaction.user?.firstName} {transaction.user?.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleViewDetails(transaction)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
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
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} transactions
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

      {/* Details Modal */}
      {showDetailsModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <Receipt size={20} className="text-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Transaction Details</h2>
                  <p className="text-sm text-gray-500">#{selectedTransaction.id}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                <CloseIcon size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Type</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[selectedTransaction.type]}`}>
                    {selectedTransaction.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedTransaction.status]}`}>
                    {selectedTransaction.status}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Amount</p>
                  <p className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <DollarSign size={24} />
                    ₦{selectedTransaction.amount?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Date</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar size={16} />
                    {new Date(selectedTransaction.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedTransaction.user && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">User</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <UserIcon size={20} className="text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {selectedTransaction.user.firstName} {selectedTransaction.user.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{selectedTransaction.user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedTransaction.description && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Description</p>
                  <p className="text-gray-900">{selectedTransaction.description}</p>
                </div>
              )}

              {selectedTransaction.metadata && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Additional Details</p>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(selectedTransaction.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200">
              <button onClick={() => setShowDetailsModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
