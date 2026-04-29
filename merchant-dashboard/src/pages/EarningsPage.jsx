import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import { fetchWallet, requestWithdrawal } from '../store/slices/earningsSlice.js'
import { Wallet, ArrowUpRight, RefreshCw, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

export default function EarningsPage() {
  const { merchantId } = useParams()
  const dispatch = useDispatch()
  const { wallet, loading } = useSelector((state) => state.earnings)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  })

  useEffect(() => {
    dispatch(fetchWallet({ merchantId }))
  }, [dispatch, merchantId])

  const handleWithdrawal = async (e) => {
    e.preventDefault()
    try {
      await dispatch(requestWithdrawal({
        merchantId,
        amount: parseFloat(withdrawalForm.amount),
        bankAccount: {
          bankName: withdrawalForm.bankName,
          accountNumber: withdrawalForm.accountNumber,
          accountName: withdrawalForm.accountName,
        },
      })).unwrap()
      setShowWithdrawModal(false)
      setWithdrawalForm({ amount: '', bankName: '', accountNumber: '', accountName: '' })
      dispatch(fetchWallet({ merchantId }))
    } catch (err) {
      console.error('Failed to request withdrawal:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
          <p className="text-gray-600">View your wallet balance and transactions</p>
        </div>
        <button
          onClick={() => dispatch(fetchWallet({ merchantId }))}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : wallet ? (
        <>
          {/* Wallet Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="w-6 h-6" />
                <h2 className="text-lg font-semibold">Available Balance</h2>
              </div>
              <p className="text-4xl font-bold">₦{wallet.availableBalance?.toLocaleString() || '0'}</p>
              <p className="text-blue-100 mt-2 text-sm">Ready for withdrawal</p>
            </div>
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6" />
                <h2 className="text-lg font-semibold">Pending Balance</h2>
              </div>
              <p className="text-4xl font-bold">₦{wallet.pendingBalance?.toLocaleString() || '0'}</p>
              <p className="text-gray-300 mt-2 text-sm">Awaiting settlement</p>
            </div>
          </div>

          {/* Withdraw Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={!wallet.availableBalance || wallet.availableBalance === 0}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpRight className="w-5 h-5" />
              Request Withdrawal
            </button>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
            </div>
            {!wallet.transactions || wallet.transactions.length === 0 ? (
              <div className="p-6 text-center text-gray-600">No transactions yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(wallet.transactions || []).map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {transaction.type.replace(/_/g, ' ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          {transaction.type === 'WITHDRAWAL' ? '-' : '+'}₦{transaction.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            transaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {transaction.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Request Withdrawal</h2>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <AlertCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleWithdrawal} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={wallet?.availableBalance}
                  value={withdrawalForm.amount}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Available: ₦{wallet?.availableBalance?.toLocaleString() || '0'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  value={withdrawalForm.bankName}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, bankName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                <input
                  type="text"
                  required
                  minLength="10"
                  value={withdrawalForm.accountNumber}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, accountNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  value={withdrawalForm.accountName}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, accountName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowWithdrawModal(false)
                    setWithdrawalForm({ amount: '', bankName: '', accountNumber: '', accountName: '' })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Request Withdrawal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
