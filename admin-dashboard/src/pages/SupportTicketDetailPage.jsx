import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeft, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import SupportThread from '../components/SupportThread'
import {
  fetchTicketDetail,
  postTicketMessage,
  updateTicketStatus,
  assignTicket,
  clearSelectedTicket,
} from '../store/slices/supportTicketsSlice'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED']

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

export default function SupportTicketDetailPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { selected, selectedLoading } = useSelector((s) => s.supportTickets)
  const currentUser = useSelector((s) => s.auth.user)

  const [posting, setPosting] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [nextStatus, setNextStatus] = useState('')
  const [statusNotes, setStatusNotes] = useState('')

  useEffect(() => {
    if (ticketId) dispatch(fetchTicketDetail(ticketId))
    return () => dispatch(clearSelectedTicket())
  }, [dispatch, ticketId])

  useEffect(() => {
    if (selected) {
      setNextStatus(selected.status)
      setStatusNotes(selected.resolution || '')
    }
  }, [selected])

  const handleSubmit = async ({ body, isInternal }) => {
    setPosting(true)
    try {
      await dispatch(postTicketMessage({ ticketId, body, isInternal })).unwrap()
      toast.success(isInternal ? 'Internal note added' : 'Reply sent')
    } catch (err) {
      toast.error(err?.message || 'Failed to send')
    } finally {
      setPosting(false)
    }
  }

  const handleStatusSave = async () => {
    if (!nextStatus || nextStatus === selected?.status) return
    setStatusBusy(true)
    try {
      await dispatch(updateTicketStatus({ ticketId, status: nextStatus, notes: statusNotes })).unwrap()
      toast.success('Status updated')
    } catch (err) {
      toast.error(err?.message || 'Failed to update status')
    } finally {
      setStatusBusy(false)
    }
  }

  const handleAssignToMe = async () => {
    setStatusBusy(true)
    try {
      await dispatch(assignTicket({ ticketId, assignedToId: currentUser?.id })).unwrap()
      toast.success('Assigned to you')
    } catch (err) {
      toast.error(err?.message || 'Failed to assign')
    } finally {
      setStatusBusy(false)
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
    return (
      <div className="text-center py-12 text-muted dark:text-dark-muted">
        Ticket not found.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted dark:text-dark-muted">#{selected.number}</div>
              <h1 className="text-lg sm:text-xl font-semibold text-text dark:text-dark-text break-words">
                {selected.subject}
              </h1>
              <div className="text-sm text-muted dark:text-dark-muted mt-1">
                Opened {new Date(selected.createdAt).toLocaleString()} ·{' '}
                <span className="capitalize">{selected.category.toLowerCase()}</span>
              </div>
            </div>
            <span className={`px-2 py-1 rounded text-xs ${statusBadge(selected.status)} whitespace-nowrap`}>
              {selected.status.replace(/_/g, ' ')}
            </span>
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

          <hr className="border-surface-muted dark:border-dark-surface-muted" />

          <SupportThread
            messages={selected.messages || []}
            currentUserId={currentUser?.id}
            canPost={selected.status !== 'CLOSED'}
            canMarkInternal
            posting={posting}
            onSubmit={handleSubmit}
          />
        </div>

        <aside className="space-y-4">
          <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-text dark:text-dark-text">Customer</h2>
            <div className="text-sm space-y-1">
              <div className="font-medium text-text dark:text-dark-text">
                {selected.user?.firstName} {selected.user?.lastName}
              </div>
              <div className="text-muted dark:text-dark-muted">{selected.user?.email}</div>
              <div className="text-muted dark:text-dark-muted">{selected.user?.phone || '-'}</div>
              <div className="text-xs text-muted dark:text-dark-muted mt-2">Role: {selected.user?.role}</div>
            </div>
          </div>

          <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-text dark:text-dark-text">Assignment</h2>
            <div className="text-sm text-text dark:text-dark-text">
              {selected.assignedTo
                ? `${selected.assignedTo.firstName} ${selected.assignedTo.lastName}`
                : <span className="text-muted dark:text-dark-muted">Unassigned</span>}
            </div>
            <button
              onClick={handleAssignToMe}
              disabled={statusBusy}
              className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-surface-muted dark:hover:bg-dark-surface-muted disabled:opacity-50"
            >
              <UserCheck size={14} /> Assign to me
            </button>
          </div>

          <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-text dark:text-dark-text">Status</h2>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <textarea
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              rows={3}
              placeholder="Resolution notes (visible to user on RESOLVED/CLOSED)"
              className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm resize-none"
            />
            <button
              onClick={handleStatusSave}
              disabled={statusBusy || nextStatus === selected.status}
              className="w-full px-3 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
            >
              {statusBusy ? 'Saving...' : 'Save status'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
