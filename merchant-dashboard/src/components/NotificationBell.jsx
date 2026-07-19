import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Bell } from 'lucide-react'

export default function NotificationBell() {
  const navigate = useNavigate()
  const unreadCount = useSelector((s) => s.notifications.unreadCount)

  return (
    <button
      onClick={() => navigate('/dashboard/notifications')}
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      className="relative p-2 rounded-lg bg-surface-muted hover:bg-surface-muted/80 dark:bg-dark-surface-muted dark:hover:bg-dark-surface-muted/80 transition-colors"
      title="Notifications"
    >
      <Bell className="w-5 h-5 text-muted dark:text-dark-muted" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface dark:border-dark-surface">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
