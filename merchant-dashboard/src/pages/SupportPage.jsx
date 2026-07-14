import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  HelpCircle,
  Inbox,
  Plus,
  RefreshCw,
  ShieldAlert,
  BookOpen,
  X,
} from 'lucide-react'
import { showSuccessToast, showErrorToast } from '../utils/toast.js'
import CloudinaryImageUploader from '../components/CloudinaryImageUploader.jsx'
import { fetchMyTickets, createTicket } from '../store/slices/supportTicketsSlice'
import { fetchMyDisputes } from '../store/slices/disputesSlice'
import supportContent from '../content/support-content.json'

const TICKET_CATEGORIES = [
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'ORDER', label: 'Order' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'OTHER', label: 'Other' },
]

const TICKET_PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

const ticketStatusBadge = (status) => {
  switch (status) {
    case 'OPEN': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'PENDING_USER': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    case 'RESOLVED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'CLOSED': return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    default: return 'bg-surface-muted dark:bg-dark-surface-muted'
  }
}

const disputeStatusBadge = (status) => {
  switch (status) {
    case 'OPEN': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'UNDER_REVIEW': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'AWAITING_RESPONSE': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    case 'RESOLVED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'REJECTED': return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    default: return 'bg-surface-muted dark:bg-dark-surface-muted'
  }
}

const TABS = [
  { id: 'tickets', label: 'My Tickets', icon: Inbox },
  { id: 'disputes', label: 'Disputes', icon: ShieldAlert },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
]

function CreateTicketModal({ onClose, onCreated }) {
  const dispatch = useDispatch()
  const [form, setForm] = useState({
    category: 'OTHER',
    priority: 'MEDIUM',
    subject: '',
    description: '',
  })
  const [attachmentUrls, setAttachmentUrls] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.subject.trim() || !form.description.trim()) {
      showErrorToast('Subject and description are required')
      return
    }
    setSubmitting(true)
    try {
      const ticket = await dispatch(createTicket({ ...form, attachmentUrls })).unwrap()
      showSuccessToast('Ticket created')
      onCreated?.(ticket)
      onClose()
    } catch (err) {
      showErrorToast(err?.message || 'Failed to create ticket')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-surface-muted dark:border-dark-surface-muted">
          <h2 className="font-semibold text-text dark:text-dark-text">New support ticket</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted dark:text-dark-muted block mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted dark:text-dark-muted block mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm"
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted dark:text-dark-muted block mb-1">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              maxLength={200}
              placeholder="Short summary"
              className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted dark:text-dark-muted block mb-1">Describe the issue</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              maxLength={5000}
              placeholder="Explain what's going on in as much detail as possible."
              className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted dark:text-dark-muted block mb-1">Attach a screenshot (optional)</label>
            {attachmentUrls.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {attachmentUrls.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded border border-surface-muted overflow-hidden">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setAttachmentUrls(attachmentUrls.filter((u) => u !== url))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-xs"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {attachmentUrls.length < 5 && (
                  <div className="w-20 h-20">
                    <CloudinaryImageUploader
                      kind="ticket"
                      size="sm"
                      value=""
                      onChange={(url) => url && setAttachmentUrls([...attachmentUrls, url])}
                    />
                  </div>
                )}
              </div>
            ) : (
              <CloudinaryImageUploader
                kind="ticket"
                size="sm"
                value=""
                onChange={(url) => url && setAttachmentUrls([url])}
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-white disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SupportPage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { tickets, total: ticketsTotal, loading: ticketsLoading } = useSelector((s) => s.supportTickets)
  const { disputes, total: disputesTotal, loading: disputesLoading } = useSelector((s) => s.disputes)

  const [activeTab, setActiveTab] = useState('tickets')
  const [showCreate, setShowCreate] = useState(false)

  const loadTickets = () => dispatch(fetchMyTickets({}))
  const loadDisputes = () => dispatch(fetchMyDisputes({}))

  useEffect(() => {
    loadTickets()
    loadDisputes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Support</h1>
          <p className="text-sm text-muted dark:text-dark-muted">
            Raise issues with the platform team, follow up on disputes, and browse the merchant knowledge base.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (activeTab === 'tickets') loadTickets()
              if (activeTab === 'disputes') loadDisputes()
            }}
            className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg flex items-center justify-center hover:bg-surface-muted dark:hover:bg-dark-surface-muted"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {activeTab === 'tickets' && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex items-center gap-2 hover:opacity-90"
            >
              <Plus size={16} /> New ticket
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 sm:gap-3 border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-4 py-3 border-b-2 text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text'
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.id === 'tickets' && ticketsTotal > 0 && (
                <span className="ml-1 text-xs bg-surface-muted dark:bg-dark-surface-muted px-1.5 py-0.5 rounded">
                  {ticketsTotal}
                </span>
              )}
              {tab.id === 'disputes' && disputesTotal > 0 && (
                <span className="ml-1 text-xs bg-surface-muted dark:bg-dark-surface-muted px-1.5 py-0.5 rounded">
                  {disputesTotal}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'tickets' && (
        <div>
          {ticketsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted py-12 flex flex-col items-center gap-3 text-muted dark:text-dark-muted">
              <Inbox size={32} />
              <span>You haven't raised any tickets yet.</span>
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
              >
                Create your first ticket
              </button>
            </div>
          ) : (
            <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-surface-muted dark:bg-dark-surface-muted text-xs uppercase tracking-wide text-muted dark:text-dark-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
                  {tickets.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/dashboard/support/tickets/${t.id}`)}
                      className="cursor-pointer hover:bg-surface-muted/50 dark:hover:bg-dark-surface-muted/50 text-sm text-text dark:text-dark-text"
                    >
                      <td className="px-4 py-3 font-mono">#{t.number}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{t.subject}</td>
                      <td className="px-4 py-3 text-xs">{t.category}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${ticketStatusBadge(t.status)}`}>
                          {t.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted dark:text-dark-muted whitespace-nowrap">
                        {new Date(t.lastActivityAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'disputes' && (
        <div>
          {disputesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : disputes.length === 0 ? (
            <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted py-12 flex flex-col items-center gap-3 text-muted dark:text-dark-muted">
              <ShieldAlert size={32} />
              <span>No customer disputes against your orders. Keep it up.</span>
            </div>
          ) : (
            <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-surface-muted dark:bg-dark-surface-muted text-xs uppercase tracking-wide text-muted dark:text-dark-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
                  {disputes.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => navigate(`/dashboard/support/disputes/${d.id}`)}
                      className="cursor-pointer hover:bg-surface-muted/50 dark:hover:bg-dark-surface-muted/50 text-sm text-text dark:text-dark-text"
                    >
                      <td className="px-4 py-3 font-mono">#{d.number}</td>
                      <td className="px-4 py-3">
                        {d.request?.customer?.firstName} {d.request?.customer?.lastName}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">{d.reason}</td>
                      <td className="px-4 py-3 text-xs">{d.category.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${disputeStatusBadge(d.status)}`}>
                          {d.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted dark:text-dark-muted whitespace-nowrap">
                        {new Date(d.lastActivityAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {supportContent.faq.map((item) => (
            <div
              key={item.id}
              className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 space-y-2"
            >
              <div className="text-xs text-primary uppercase tracking-wide">{item.category}</div>
              <h3 className="font-semibold text-text dark:text-dark-text">{item.question}</h3>
              <p className="text-sm text-muted dark:text-dark-muted leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {supportContent.articles.map((article) => (
            <div
              key={article.id}
              className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4 space-y-2"
            >
              <div className="text-xs text-primary uppercase tracking-wide">{article.category}</div>
              <h3 className="font-semibold text-text dark:text-dark-text">{article.title}</h3>
              <p className="text-sm text-muted dark:text-dark-muted leading-relaxed">{article.summary}</p>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={(ticket) => navigate(`/dashboard/support/tickets/${ticket.id}`)}
        />
      )}
    </div>
  )
}
