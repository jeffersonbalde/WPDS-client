import { useNotifications } from '../../context/NotificationsContext'

export default function NotifNavBadge() {
  const { unreadCount } = useNotifications()
  if (!unreadCount) return null

  return (
    <span className="wp-dash__nav-badge" aria-label={`${unreadCount} unread`}>
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )
}
