import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Bell,
  BellOff,
  Package,
  Wallet,
  MessageCircle,
  Megaphone,
  CheckCheck,
  RefreshCw,
} from 'lucide-react'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../store/slices/notificationsSlice.js'

const ICON_BY_TYPE = {
  ORDER: Package,
  REQUEST_STATUS: Package,
  REQUEST_MESSAGE: MessageCircle,
  SUPPORT: MessageCircle,
  WALLET: Wallet,
  REFUND: Wallet,
  PROMOTION: Megaphone,
}

// The backend writes `data.route` for the mobile apps' navigators (e.g.
// `/orders/:id`), which don't correspond to real routes here - the merchant
// dashboard only has a handful of top-level pages plus ticket/dispute detail
// routes. Map by type + whatever id fields are present instead of trusting
// the mobile-shaped route string.
function routeForNotification(n) {
  const data = n.data || {}
  if (data.disputeId) return `/dashboard/support/disputes/${data.disputeId}`
  if (data.ticketId) return `/dashboard/support/tickets/${data.ticketId}`
  switch (n.type) {
    case 'ORDER':
    case 'REQUEST_STATUS':
    case 'REQUEST_MESSAGE':
      return '/dashboard/orders'
    case 'SUPPORT':
      return '/dashboard/support'
    case 'WALLET':
    case 'REFUND':
      return '/dashboard/earnings'
    case 'PROMOTION':
      return '/dashboard/marketing'
    default:
      return null
  }
}

function formatRelative(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { list, loading, page, total, unreadCount } = useSelector((s) => s.notifications)

  useEffect(() => {
    dispatch(fetchNotifications({ page: 1, limit: 20 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = () => dispatch(fetchNotifications({ page: 1, limit: 20 }))
  const handleLoadMore = () => dispatch(fetchNotifications({ page: page + 1, limit: 20 }))
  const handleMarkAll = () => {
    if (unreadCount > 0) dispatch(markAllNotificationsRead())
  }

  const handleRowClick = (n) => {
    if (!n.readAt) dispatch(markNotificationRead(n.id))
    const route = routeForNotification(n)
    if (route) navigate(route)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Notifications</h1>
          <p className="text-sm text-muted dark:text-dark-muted">
            New orders, order chat, disputes, and support replies land here.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg flex items-center justify-center hover:bg-surface-muted dark:hover:bg-dark-surface-muted"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCheck size={16} /> Mark all read
          </button>
        </div>
      </div>

      {loading && list.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted py-12 flex flex-col items-center gap-3 text-muted dark:text-dark-muted">
          <BellOff size={32} />
          <span>No notifications yet.</span>
        </div>
      ) : (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted divide-y divide-surface-muted dark:divide-dark-surface-muted overflow-hidden">
          {list.map((n) => {
            const Icon = ICON_BY_TYPE[n.type] || Bell
            const unread = !n.readAt
            return (
              <button
                key={n.id}
                onClick={() => handleRowClick(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/50 dark:hover:bg-dark-surface-muted/50 ${
                  unread ? 'bg-primary/5 dark:bg-primary/10' : ''
                }`}
              >
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                    unread
                      ? 'bg-primary/15 text-primary'
                      : 'bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted'
                  }`}
                >
                  <Icon size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text dark:text-dark-text truncate">
                      {n.title}
                    </span>
                    <span className="ml-auto flex-shrink-0 text-xs text-muted dark:text-dark-muted">
                      {formatRelative(n.createdAt)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-sm text-muted dark:text-dark-muted line-clamp-2">{n.body}</p>
                  )}
                </div>
                {unread && (
                  <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {list.length > 0 && list.length < total && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-4 py-2 text-sm border border-surface-muted dark:border-dark-surface-muted rounded-lg text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
