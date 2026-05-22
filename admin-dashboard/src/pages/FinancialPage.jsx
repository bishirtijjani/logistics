import { useState, useEffect } from 'react'
import { API_URL } from '../lib/api'
import { DollarSign, Check, X, Clock, RefreshCw } from 'lucide-react'

export default function FinancialPage() {
  const [activeTab, setActiveTab] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [withdrawals, setWithdrawals] = useState([])

  const fetchWithdrawals = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const endpoint = activeTab === 'pending' 
        ? `${API_URL}/admin/withdrawals/pending`
        : `${API_URL}/admin/withdrawals/history?status=${activeTab}`
      
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      
      if (data.success) {
        setWithdrawals(data.data.withdrawals || [])
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (withdrawalId) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_URL}/admin/withdrawals/${withdrawalId}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchWithdrawals()
    } catch (error) {
      console.error('Failed to approve withdrawal:', error)
    }
  }

  const handleReject = async (withdrawalId) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return
    
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_URL}/admin/withdrawals/${withdrawalId}/reject`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      })
      fetchWithdrawals()
    } catch (error) {
      console.error('Failed to reject withdrawal:', error)
    }
  }

  useEffect(() => {
    fetchWithdrawals()
  }, [activeTab])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Financial Operations</h1>
        <button onClick={fetchWithdrawals} className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg w-full sm:w-auto flex items-center justify-center">
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="border-b border-surface-muted dark:border-dark-surface-muted flex gap-2 sm:gap-4 overflow-x-auto">
        {['pending', 'approved', 'rejected'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 sm:px-4 py-3 border-b-2 capitalize text-sm whitespace-nowrap ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted">
              <tr>
                <th className="px-4 py-3 text-left">Merchant</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                {activeTab === 'pending' && <th className="px-4 py-3 text-left">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((withdrawal) => (
                <tr key={withdrawal.id} className="border-b">
                  <td className="px-4 py-3">{withdrawal.merchantWallet?.merchant?.name || 'N/A'}</td>
                  <td className="px-4 py-3">₦{withdrawal.amount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      withdrawal.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      withdrawal.status === 'COMPLETED' ? 'bg-success/10 text-success' :
                      'bg-error/10 text-error'
                    }`}>
                      {withdrawal.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{new Date(withdrawal.createdAt).toLocaleDateString()}</td>
                  {activeTab === 'pending' && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(withdrawal.id)} className="p-1 text-success hover:bg-success/10 rounded">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleReject(withdrawal.id)} className="p-1 text-error hover:bg-error/10 rounded">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {withdrawals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted dark:text-dark-muted">
                    No withdrawals found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
