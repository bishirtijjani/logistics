import { useState, useEffect } from 'react'
import { Check, RefreshCw } from 'lucide-react'

export default function DisputesPage() {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('OPEN')

  const fetchDisputes = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/disputes?status=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) setDisputes(data.data.disputes || [])
    } catch (error) {
      console.error('Failed to fetch disputes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (disputeId) => {
    const resolution = prompt('Enter resolution:')
    const notes = prompt('Enter notes (optional):')
    
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resolution, notes })
      })
      fetchDisputes()
    } catch (error) {
      console.error('Failed to resolve dispute:', error)
    }
  }

  useEffect(() => { fetchDisputes() }, [activeTab])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text dark:text-dark-text">Dispute Resolution</h1>
        <button onClick={fetchDisputes} className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg">
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="border-b border-surface-muted dark:border-dark-surface-muted">
        {['open', 'in_progress', 'resolved'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 border-b-2 ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
          >
            {tab.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted">
          <table className="w-full">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Merchant</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                {activeTab === 'open' && <th className="px-4 py-3 text-left">Actions</th>}
                {activeTab === 'OPEN' && <th className="px-4 py-3 text-left">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="border-b">
                  <td className="px-4 py-3">{dispute.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{dispute.request?.customer?.email || 'N/A'}</td>
                  <td className="px-4 py-3">{dispute.request?.merchant?.name || 'N/A'}</td>
                  <td className="px-4 py-3">{dispute.status}</td>
                  <td className="px-4 py-3">{new Date(dispute.createdAt).toLocaleDateString()}</td>
                  {activeTab === 'OPEN' && (
                    <td className="px-4 py-3">
                      <button onClick={() => handleResolve(dispute.id)} className="p-1 text-success hover:bg-success/10 rounded">
                        <Check className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {disputes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted dark:text-dark-muted">No disputes found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
