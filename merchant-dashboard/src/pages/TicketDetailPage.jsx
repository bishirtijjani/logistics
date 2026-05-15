import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeft, X } from 'lucide-react'
import SupportThread from '../components/SupportThread'
import { showSuccessToast, showErrorToast } from '../utils/toast'
import {
  fetchTicketDetail,
  postTicketMessage,
  closeTicket,
  clearSelectedTicket,
} from '../store/slices/supportTicketsSlice'

const statusBadge = (status) => {
  switch (status) {
    case 'OPEN': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'PENDING_USER': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    case 'RESOLVED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'CLOSED': return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    default: return 'bg-surface-muted dark:bg-dark-surface-muted'
  }
}

export default function TicketDetailPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { selected, selectedLoading } = useSelector((s) => s.supportTickets)
  const currentUser = useSelector((s) => s.auth.user)

  const [posting, setPosting] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (ticketId) dispatch(fetchTicketDetail(ticketId))
    return () => dispatch(clearSelectedTicket())
  }, [dispatch, ticketId])

  const handleSubmit = async ({ body }) => {
    setPosting(true)
    try {
      await dispatch(postTicketMessage({ ticketId, body })).unwrap()
    } catch (err) {
      showErrorToast(err?.message || 'Failed to send')
    } finally {
      setPosting(false)
    }
  }

  const handleClose = async () => {
    setClosing(true)
    try {
      await dispatch(closeTicket(ticketId)).unwrap()
      showSuccessToast('Ticket closed')
    } catch (err) {
      showErrorToast(err?.message || 'Failed to close ticket')
    } finally {
      setClosing(false)
    }
  }

  if (selectedLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!selected) {
    return <div className="text-center py-12 text-muted dark:text-dark-muted">Ticket not found.</div>
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
      >
        <ArrowLeft size={16} /> Back to support
      </button>

      <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted dark:text-dark-muted">Ticket #{selected.number}</div>
            <h1 className="text-lg sm:text-xl font-semibold text-text dark:text-dark-text break-words">
              {selected.subject}
            </h1>
            <div className="text-sm text-muted dark:text-dark-muted mt-1">
              Opened {new Date(selected.createdAt).toLocaleString()} · {selected.category.toLowerCase()}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-2 py-1 rounded text-xs ${statusBadge(selected.status)} whitespace-nowrap`}>
              {selected.status.replace(/_/g, ' ')}
            </span>
            {!['CLOSED', 'RESOLVED'].includes(selected.status) && (
              <button
                onClick={handleClose}
                disabled={closing}
                className="text-xs text-error hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <X size={12} /> {closing ? 'Closing...' : 'Close ticket'}
              </button>
            )}
          </div>
        </div>

        <div className="bg-surface-muted/50 dark:bg-dark-surface-muted/40 rounded-lg p-3 text-sm text-text dark:text-dark-text whitespace-pre-wrap">
          {selected.description}
        </div>

        {selected.attachmentUrls?.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {selected.attachmentUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block w-20 h-20 rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted"
              >
                <img src={url} alt={`attachment ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}

        {selected.resolution && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg p-3 text-sm text-emerald-900 dark:text-emerald-200">
            <div className="font-semibold mb-1">Resolution</div>
            <div className="whitespace-pre-wrap">{selected.resolution}</div>
          </div>
        )}

        <hr className="border-surface-muted dark:border-dark-surface-muted" />

        <SupportThread
          messages={selected.messages || []}
          currentUserId={currentUser?.id}
          canPost={selected.status !== 'CLOSED'}
          posting={posting}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
