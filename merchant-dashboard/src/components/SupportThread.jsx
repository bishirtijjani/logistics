import { useState } from 'react'
import { Send, Lock } from 'lucide-react'

const initials = (u) => `${u?.firstName?.[0] || ''}${u?.lastName?.[0] || ''}`.toUpperCase() || '?'

const roleLabel = (role) => {
  if (role === 'ADMIN') return 'Support'
  if (role === 'MERCHANT') return 'You'
  if (role === 'RIDER') return 'Rider'
  return 'Customer'
}

const roleBadgeClass = (role) => {
  if (role === 'ADMIN') return 'bg-primary/10 text-primary'
  if (role === 'MERCHANT') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (role === 'RIDER') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
}

function MessageBubble({ message, currentUserId }) {
  const isMine = message.fromUserId === currentUserId
  const isInternal = message.isInternal
  const role = message.fromUser?.role
  return (
    <div className={`flex gap-2 sm:gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-surface-muted dark:bg-dark-surface-muted flex items-center justify-center text-xs font-semibold text-text dark:text-dark-text shrink-0">
        {initials(message.fromUser)}
      </div>
      <div className={`max-w-[80%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="flex items-center gap-2 text-xs text-muted dark:text-dark-muted mb-1">
          <span className="font-medium text-text dark:text-dark-text">
            {message.fromUser?.firstName} {message.fromUser?.lastName}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${roleBadgeClass(role)}`}>
            {roleLabel(role)}
          </span>
          {isInternal && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-[10px] uppercase tracking-wide">
              <Lock size={10} /> Internal
            </span>
          )}
        </div>
        <div
          className={`px-3 py-2 rounded-2xl text-sm break-words ${
            isMine
              ? 'bg-primary text-white'
              : 'bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text'
          }`}
        >
          {message.body}
        </div>
        {message.attachmentUrls?.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {message.attachmentUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block w-16 h-16 rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface"
              >
                <img src={url} alt={`attachment ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
        <span className="text-[10px] text-muted dark:text-dark-muted mt-1">
          {new Date(message.createdAt).toLocaleString()}
        </span>
      </div>
    </div>
  )
}

export default function SupportThread({
  messages = [],
  currentUserId,
  canPost = true,
  posting = false,
  onSubmit,
  placeholder = 'Type your reply...',
}) {
  const [body, setBody] = useState('')

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!body.trim() || posting) return
    await onSubmit({ body: body.trim() })
    setBody('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="text-sm text-muted dark:text-dark-muted py-8 text-center">No messages yet.</div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} currentUserId={currentUserId} />)
        )}
      </div>

      {canPost && (
        <form
          onSubmit={submit}
          className="border-t border-surface-muted dark:border-dark-surface-muted pt-3 flex flex-col gap-2"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            >
              <Send size={14} /> {posting ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
