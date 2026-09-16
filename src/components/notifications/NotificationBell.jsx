import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiBell } from 'react-icons/fi'
import api from '../../api/client'
import { useNotifications } from '../../context/NotificationsContext'
import { timeAgo } from '../../utils/timeAgo'
import { NotifIcon, notifTone } from './notifMeta'
import './NotificationBell.css'

export default function NotificationBell() {
  const { unreadCount, tick, markOneRead, markAllRead, refreshUnread } = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  const loadRecent = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/notifications', { params: { per_page: 8 } })
      setItems(Array.isArray(data?.data) ? data.data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadRecent()
  }, [open, tick, loadRecent])

  useEffect(() => {
    function onDoc(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  async function openItem(n) {
    setOpen(false)
    if (!n.read_at) await markOneRead(n.id)
    if (n.action_url) navigate(n.action_url)
  }

  function toggle() {
    setOpen((v) => {
      const next = !v
      if (next) refreshUnread()
      return next
    })
  }

  return (
    <div className="wp-notif" ref={ref}>
      <button
        type="button"
        className={`wp-notif__btn${open ? ' is-open' : ''}`}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={toggle}
      >
        <FiBell size={19} />
        {unreadCount > 0 ? (
          <span className="wp-notif__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="wp-notif__panel" role="menu">
          <div className="wp-notif__panel-head">
            <span className="wp-notif__panel-title">Notifications</span>
            <button
              type="button"
              className="wp-notif__link"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          <div className="wp-notif__list">
            {loading ? (
              <p className="wp-notif__empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="wp-notif__empty">You have no notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`wp-notif__item${n.read_at ? '' : ' is-unread'}`}
                  onClick={() => openItem(n)}
                >
                  <span className={`wp-notif__item-icon wp-notif__item-icon--${notifTone(n.type)}`}>
                    <NotifIcon type={n.type} />
                  </span>
                  <span className="wp-notif__item-body">
                    <span className="wp-notif__item-title">{n.title}</span>
                    <span className="wp-notif__item-text">{n.body}</span>
                    <span className="wp-notif__item-time">{timeAgo(n.created_at)}</span>
                  </span>
                  {n.read_at ? null : <span className="wp-notif__dot" aria-hidden />}
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="wp-notif__see-all"
            onClick={() => {
              setOpen(false)
              navigate('/notifications')
            }}
          >
            See all notifications
          </button>
        </div>
      ) : null}
    </div>
  )
}
