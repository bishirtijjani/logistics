import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAllTransactions } from '../store/slices/transactionsSlice'
import { useDebounce } from '../lib/useDebounce'
import { exportToCSV } from '../lib/exportToCSV'
import { Receipt, ArrowUp, ArrowDown, Calendar, Filter, Search, DollarSign, Eye, X as CloseIcon, User as UserIcon, Download } from 'lucide-react'

const TYPE_COLORS = {
  PAYMENT: 'bg-primary/10 text-primary',
  REFUND: 'bg-error/10 text-error',
  DELIVERY_EARNING: 'bg-success/10 text-success',
  COMMISSION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  WITHDRAWAL: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  COMPLETED: 'bg-success/10 text-success',
  FAILED: 'bg-error/10 text-error',
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
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const debouncedSearch = useDebounce(filters.search, 500)

  useEffect(() => {
    dispatch(fetchAllTransactions({ page: 1, limit: 20, type: filters.type, status: filters.status, dateRange: filters.dateRange, search: debouncedSearch }))
  }, [dispatch, filters.type, filters.status, filters.dateRange, debouncedSearch])

  const handlePageChange = (newPage) => {
    dispatch(fetchAllTransactions({ page: newPage, limit: 20, ...filters }))
  }

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction)
    setShowDetailsModal(true)
  }

  const handleFilterChange = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const handleExportCSV = () => {
    const csvData = transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      status: t.status,
      userEmail: t.user?.email,
      userName: `${t.user?.firstName} ${t.user?.lastName}`,
      createdAt: t.createdAt,
      reference: t.reference,
    }))
    exportToCSV(csvData, 'transactions', ['id', 'type', 'amount', 'status', 'userEmail', 'userName', 'createdAt', 'reference'])
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-6">Transactions</h1>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3">
          <div className="flex flex-col sm:flex-row lg:flex-1 gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search by transaction ID or user..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
            </div>
            <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
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
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
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
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
              <input
                type="date"
                value={filters.dateRange.to}
                onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, to: e.target.value })}
                className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={transactions.length === 0}
            className="px-3 py-2 bg-success text-white rounded-lg hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm w-full lg:w-auto"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">No transactions found</div>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Transaction ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                    #{transaction.id.slice(-8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[transaction.type] || 'bg-surface-muted text-muted'}`}>
                      {transaction.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} />
                      ₦{transaction.amount?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[transaction.status] || 'bg-surface-muted text-muted'}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    {transaction.user?.firstName} {transaction.user?.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleViewDetails(transaction)}
                      className="p-2 text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text"
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-6">
          <p className="text-sm text-muted dark:text-dark-muted text-center sm:text-left">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} transactions
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="flex-1 sm:flex-none px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page * 20 >= total}
              className="flex-1 sm:flex-none px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:bg-dark-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-surface-muted dark:border-dark-surface-muted flex justify-between items-center sticky top-0 bg-surface dark:bg-dark-surface z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Receipt size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text">Transaction Details</h2>
                  <p className="text-xs sm:text-sm text-muted dark:text-dark-muted truncate">#{selectedTransaction.id}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text shrink-0">
                <CloseIcon size={24} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Type</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[selectedTransaction.type]}`}>
                    {selectedTransaction.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedTransaction.status]}`}>
                    {selectedTransaction.status}
                  </span>
                </div>
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Amount</p>
                  <p className="text-2xl font-bold text-text dark:text-dark-text flex items-center gap-2">
                    <DollarSign size={24} />
                    ₦{selectedTransaction.amount?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Date</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar size={16} />
                    {new Date(selectedTransaction.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedTransaction.user && (
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">User</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-text dark:text-dark-text">
                        {selectedTransaction.user.firstName} {selectedTransaction.user.lastName}
                      </p>
                      <p className="text-sm text-muted dark:text-dark-muted">{selectedTransaction.user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedTransaction.description && (
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Description</p>
                  <p className="text-text dark:text-dark-text">{selectedTransaction.description}</p>
                </div>
              )}

              {selectedTransaction.metadata && (
                <div className="bg-surface-muted dark:bg-dark-surface-muted p-4 rounded-lg">
                  <p className="text-sm text-muted dark:text-dark-muted mb-1">Additional Details</p>
                  <pre className="text-xs text-text dark:text-dark-text whitespace-pre-wrap">
                    {JSON.stringify(selectedTransaction.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-6 border-t border-surface-muted dark:border-dark-surface-muted">
              <button onClick={() => setShowDetailsModal(false)} className="w-full sm:w-auto px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
