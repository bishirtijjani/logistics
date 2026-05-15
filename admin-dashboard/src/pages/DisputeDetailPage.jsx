import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeft, Banknote, CheckCircle2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import SupportThread from '../components/SupportThread'
import {
  fetchDisputeDetail,
  postDisputeMessage,
  resolveDispute,
  clearSelectedDispute,
} from '../store/slices/disputesSlice'

const RESOLUTIONS = [
  { value: 'FULL_REFUND', label: 'Full refund' },
  { value: 'PARTIAL_REFUND', label: 'Partial refund' },
  { value: 'RESOLVED_NO_REFUND', label: 'Resolved (no refund)' },
  { value: 'REJECTED', label: 'Reject dispute' },
]

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

const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`

export default function DisputeDetailPage() {
  const { disputeId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { selected, selectedLoading } = useSelector((s) => s.disputes)
  const currentUser = useSelector((s) => s.auth.user)

  const [posting, setPosting] = useState(false)
  const [resolveBusy, setResolveBusy] = useState(false)
  const [resolution, setResolution] = useState('FULL_REFUND')
  const [refundAmount, setRefundAmount] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')

  useEffect(() => {
    if (disputeId) dispatch(fetchDisputeDetail(disputeId))
    return () => dispatch(clearSelectedDispute())
  }, [dispatch, disputeId])

  const handleSubmit = async ({ body, isInternal }) => {
    setPosting(true)
    try {
      await dispatch(postDisputeMessage({ disputeId, body, isInternal })).unwrap()
      toast.success(isInternal ? 'Internal note added' : 'Reply sent')
    } catch (err) {
      toast.error(err?.message || 'Failed to send')
    } finally {
      setPosting(false)
    }
  }

  const handleResolve = async () => {
    if (!resolution) return
    const customerPaid = Number(selected?.request?.customerPaid || 0)
    let amount
    if (resolution === 'PARTIAL_REFUND') {
      amount = Number(refundAmount)
      if (!(amount > 0) || amount > customerPaid) {
        toast.error(`Refund must be between 0 and ${naira(customerPaid)}`)
        return
      }
    }
    setResolveBusy(true)
    try {
      await dispatch(
        resolveDispute({ disputeId, resolution, resolutionNotes, refundAmount: amount }),
      ).unwrap()
      toast.success('Dispute resolved')
    } catch (err) {
      toast.error(err?.message || 'Failed to resolve')
    } finally {
      setResolveBusy(false)
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
        Dispute not found.
      </div>
    )
  }

  const isClosed = ['RESOLVED', 'REJECTED'].includes(selected.status)
  const customerPaid = Number(selected.request?.customerPaid || 0)

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
                <CheckCircle2 size={14} /> {selected.resolution.replace(/_/g, ' ')}
              </div>
              {selected.resolutionNotes && <div>{selected.resolutionNotes}</div>}
              {selected.refundAmount && (
                <div className="text-xs">
                  Refunded {naira(selected.refundAmount)}
                  {selected.refundTransaction?.reference && (
                    <> · ref <code className="text-xs">{selected.refundTransaction.reference}</code></>
                  )}
                </div>
              )}
              {selected.resolvedAt && (
                <div className="text-xs opacity-70">on {new Date(selected.resolvedAt).toLocaleString()}</div>
              )}
            </div>
          )}

          <hr className="border-surface-muted dark:border-dark-surface-muted" />

          <SupportThread
            messages={selected.messages || []}
            currentUserId={currentUser?.id}
            canPost={!isClosed}
            canMarkInternal
            posting={posting}
            onSubmit={handleSubmit}
            placeholder="Reply to customer, merchant, or leave an internal note..."
          />
        </div>

        <aside className="space-y-4">
          <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-text dark:text-dark-text">Order</h2>
            <div className="text-sm space-y-1 text-text dark:text-dark-text">
              <div>
                Total: <span className="font-medium">{naira(customerPaid)}</span>
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
            <h2 className="font-semibold text-text dark:text-dark-text">Parties</h2>
            <div className="text-sm space-y-2">
              <div>
                <div className="text-xs text-muted dark:text-dark-muted">Customer</div>
                <div className="text-text dark:text-dark-text">
                  {selected.request?.customer?.firstName} {selected.request?.customer?.lastName}
                </div>
                <div className="text-xs text-muted dark:text-dark-muted">{selected.request?.customer?.email}</div>
              </div>
              {selected.request?.merchant && (
                <div>
                  <div className="text-xs text-muted dark:text-dark-muted">Merchant</div>
                  <div className="text-text dark:text-dark-text">{selected.request.merchant.name}</div>
                </div>
              )}
              {selected.request?.rider?.user && (
                <div>
                  <div className="text-xs text-muted dark:text-dark-muted">Rider</div>
                  <div className="text-text dark:text-dark-text">
                    {selected.request.rider.user.firstName} {selected.request.rider.user.lastName}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isClosed && (
            <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-text dark:text-dark-text flex items-center gap-2">
                <ShieldAlert size={16} /> Resolve dispute
              </h2>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {resolution === 'PARTIAL_REFUND' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted dark:text-dark-muted">
                    Refund amount (max {naira(customerPaid)})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={customerPaid}
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm"
                  />
                </div>
              )}
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
                placeholder="Resolution notes (shown to customer)"
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm resize-none"
              />
              <button
                onClick={handleResolve}
                disabled={resolveBusy}
                className="w-full px-3 py-2 bg-primary text-white rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90"
              >
                <Banknote size={14} />
                {resolveBusy ? 'Resolving...' : 'Resolve'}
              </button>
              <p className="text-[11px] text-muted dark:text-dark-muted">
                Refund (if any) credits the customer's wallet atomically and writes a REFUND transaction. This cannot be undone.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
