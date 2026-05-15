import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import Pagination from '../components/Pagination'
import { fetchTickets } from '../store/slices/supportTicketsSlice'

const STATUS_TABS = ['OPEN', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED']

const statusBadge = (status) => {
  switch (status) {
    case 'OPEN':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'PENDING_USER':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    case 'RESOLVED':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'CLOSED':
      return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    default:
      return 'bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text'
  }
}

const priorityBadge = (priority) => {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-600 text-white'
    case 'HIGH':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    case 'MEDIUM':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'LOW':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-surface-muted dark:bg-dark-surface-muted'
  }
}

export default function SupportPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { tickets, total, page, limit, loading, error } = useSelector((s) => s.supportTickets)

  const [activeTab, setActiveTab] = useState('OPEN')
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  const load = () => {
    dispatch(fetchTickets({ status: activeTab, page: currentPage, limit: pageSize }))
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, pageSize])

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Support Tickets</h1>
          <p className="text-sm text-muted dark:text-dark-muted">
            Triage and respond to user-submitted issues.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg w-full sm:w-auto flex items-center justify-center gap-2 hover:bg-surface-muted dark:hover:bg-dark-surface-muted"
        >
          <RefreshCw className="w-4 h-4" /> <span className="text-sm">Refresh</span>
        </button>
      </div>

      <div className="flex gap-1 sm:gap-3 border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 sm:px-4 py-3 border-b-2 capitalize text-sm whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text'
            }`}
          >
            {tab.replace(/_/g, ' ').toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted py-12 flex flex-col items-center gap-3 text-muted dark:text-dark-muted">
          <Inbox size={32} />
          <span>No tickets in this status.</span>
        </div>
      ) : (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted text-xs uppercase tracking-wide text-muted dark:text-dark-muted">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => navigate(`/support/${ticket.id}`)}
                  className="cursor-pointer hover:bg-surface-muted/50 dark:hover:bg-dark-surface-muted/50 text-sm text-text dark:text-dark-text"
                >
                  <td className="px-4 py-3 font-mono">#{ticket.number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {ticket.user?.firstName} {ticket.user?.lastName}
                    </div>
                    <div className="text-xs text-muted dark:text-dark-muted">{ticket.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{ticket.subject}</td>
                  <td className="px-4 py-3 text-xs">{ticket.category}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${priorityBadge(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${statusBadge(ticket.status)}`}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted dark:text-dark-muted whitespace-nowrap">
                    {new Date(ticket.lastActivityAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tickets.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(n) => {
            setPageSize(n)
            setCurrentPage(1)
          }}
        />
      )}
    </div>
  )
}
