import { useState, useEffect } from 'react'
import { RefreshCw, MessageCircle } from 'lucide-react'

export default function SupportPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('OPEN')

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/support/tickets?status=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) setTickets(data.data.tickets || [])
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (ticketId, newStatus) => {
    const notes = prompt('Enter notes (optional):')
    
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus, notes })
      })
      fetchTickets()
    } catch (error) {
      console.error('Failed to update ticket:', error)
    }
  }

  useEffect(() => { fetchTickets() }, [activeTab])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Support Management</h1>
        <button onClick={fetchTickets} className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg w-full sm:w-auto flex items-center justify-center">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 sm:gap-4 border-b overflow-x-auto">
        {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 sm:px-4 py-3 border-b-2 capitalize text-sm whitespace-nowrap ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
          >
            {tab.replace('_', ' ')}
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
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b">
                  <td className="px-4 py-3">{ticket.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{ticket.user?.email || 'N/A'}</td>
                  <td className="px-4 py-3">{ticket.subject || 'N/A'}</td>
                  <td className="px-4 py-3">{ticket.status}</td>
                  <td className="px-4 py-3">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      onChange={(e) => handleStatusUpdate(ticket.id, e.target.value)}
                      value={ticket.status}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted dark:text-dark-muted">No tickets found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
