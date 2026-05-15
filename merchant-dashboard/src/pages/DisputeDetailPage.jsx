import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import SupportThread from '../components/SupportThread'
import { showErrorToast } from '../utils/toast'
import {
  fetchDisputeDetail,
  postDisputeMessage,
  clearSelectedDispute,
} from '../store/slices/disputesSlice'

const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`

const statusBadge = (status) => {
  switch (status) {
    case 'OPEN': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'UNDER_REVIEW': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'AWAITING_RESPONSE': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    case 'RESOLVED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'REJECTED': return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    default: return 'bg-surface-muted dark:bg-dark-surface-muted'
  }
}

export default function DisputeDetailPage() {
  const { disputeId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { selected, selectedLoading } = useSelector((s) => s.disputes)
  const currentUser = useSelector((s) => s.auth.user)

  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (disputeId) dispatch(fetchDisputeDetail(disputeId))
    return () => dispatch(clearSelectedDispute())
  }, [dispatch, disputeId])

  const handleSubmit = async ({ body }) => {
    setPosting(true)
    try {
      await dispatch(postDisputeMessage({ disputeId, body })).unwrap()
    } catch (err) {
      showErrorToast(err?.message || 'Failed to send')
    } finally {
      setPosting(false)
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
    return <div className="text-center py-12 text-muted dark:text-dark-muted">Dispute not found.</div>
  }

  const isClosed = ['RESOLVED', 'REJECTED'].includes(selected.status)

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
      >
        <ArrowLeft size={16} /> Back to support
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted dark:text-dark-muted">Dispute #{selected.number}</div>
              <h1 className="text-lg sm:text-xl font-semibold text-text dark:text-dark-text break-words">
                {selected.reason}
              </h1>
              <div className="text-sm text-muted dark:text-dark-muted mt-1">
                Filed {new Date(selected.createdAt).toLocaleString()} · {selected.category.replace(/_/g, ' ').toLowerCase()}
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
                  <img src={url} alt={`evidence ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}

          {selected.resolution && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg p-3 text-sm text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="font-semibold flex items-center gap-2">
                <CheckCircle2 size={14} /> Admin decision: {selected.resolution.replace(/_/g, ' ')}
              </div>
              {selected.resolutionNotes && <div>{selected.resolutionNotes}</div>}
              {selected.refundAmount && (
                <div className="text-xs">
                  {naira(selected.refundAmount)} was refunded to the customer.
                </div>
              )}
            </div>
          )}

          <hr className="border-surface-muted dark:border-dark-surface-muted" />

          <SupportThread
            messages={selected.messages || []}
            currentUserId={currentUser?.id}
            canPost={!isClosed}
            posting={posting}
            onSubmit={handleSubmit}
            placeholder="Explain your side of this complaint..."
          />
        </div>

        <aside className="space-y-4">
          <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-text dark:text-dark-text">Order</h2>
            <div className="text-sm space-y-1 text-text dark:text-dark-text">
              <div>
                Total: <span className="font-medium">{naira(selected.request?.customerPaid)}</span>
              </div>
              <div className="text-xs text-muted dark:text-dark-muted">
                Status: {selected.request?.status || '—'}
              </div>
              {selected.request?.deliveredAt && (
                <div className="text-xs text-muted dark:text-dark-muted">
                  Delivered: {new Date(selected.request.deliveredAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-text dark:text-dark-text">Customer</h2>
            <div className="text-sm text-text dark:text-dark-text">
              {selected.request?.customer?.firstName} {selected.request?.customer?.lastName}
            </div>
            <div className="text-xs text-muted dark:text-dark-muted">
              {selected.request?.customer?.email}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200">
            Disputes are decided by the platform admin team. Add any context that supports your side and the admin will reach out with a resolution.
          </div>
        </aside>
      </div>
    </div>
  )
}
