import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import { NotifIcon, notifTone } from '../components/notifications/notifMeta'
import { useNotifications } from '../context/NotificationsContext'
import { apiErrorMessage } from '../utils/apiError'
import { timeAgo } from '../utils/timeAgo'
import './StudentsManagePage.css'
import './NotificationsPage.css'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { markOneRead, markAllRead, refreshUnread, tick } = useNotifications()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [unreadCount, setUnreadCount] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: 15 }
      if (filter === 'unread') params.filter = 'unread'
      const { data } = await api.get('/notifications', { params })
      setRows(Array.isArray(data?.data) ? data.data : [])
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total ?? 0,
        from: data.from || 0,
        to: data.to || 0,
      })
      setUnreadCount(Number(data.unread_count) || 0)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load notifications.'))
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    load()
  }, [load, tick])

  function changeFilter(next) {
    setFilter(next)
    setPage(1)
  }

  async function openItem(n) {
    if (!n.read_at) {
      await markOneRead(n.id)
      setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read_at: new Date().toISOString() } : r)))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    if (n.action_url) navigate(n.action_url)
  }

  async function handleMarkAll() {
    if (busy || unreadCount === 0) return
    setBusy(true)
    try {
      await markAllRead()
      await load()
      refreshUnread()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wp-flat wp-notifpage">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Notifications</h1>
          <p className="wp-flat__sub">
            Updates on grade submissions and change requests.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--primary"
            onClick={handleMarkAll}
            disabled={busy || unreadCount === 0}
          >
            <FiCheck size={16} />
            Mark all read
          </button>
        </div>
      </div>

      <div className="wp-notifpage__tabs">
        <button
          type="button"
          className={`wp-notifpage__tab${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => changeFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`wp-notifpage__tab${filter === 'unread' ? ' is-active' : ''}`}
          onClick={() => changeFilter('unread')}
        >
          Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      </div>

      <div className="wp-flat__panel">
        <div className="wp-notifpage__list">
          {loading ? (
            <p className="wp-notifpage__empty">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="wp-notifpage__empty">
              {filter === 'unread' ? 'No unread notifications.' : 'You have no notifications yet.'}
            </p>
          ) : (
            rows.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`wp-notifpage__item${n.read_at ? '' : ' is-unread'}`}
                onClick={() => openItem(n)}
              >
                <span className={`wp-notifpage__icon wp-notifpage__icon--${notifTone(n.type)}`}>
                  <NotifIcon type={n.type} size={18} />
                </span>
                <span className="wp-notifpage__body">
                  <span className="wp-notifpage__row1">
                    <span className="wp-notifpage__item-title">{n.title}</span>
                    <span className="wp-notifpage__item-time">{timeAgo(n.created_at)}</span>
                  </span>
                  <span className="wp-notifpage__item-text">{n.body}</span>
                  {n.action_url ? <span className="wp-notifpage__cta">Open →</span> : null}
                </span>
                {n.read_at ? null : <span className="wp-notifpage__dot" aria-hidden />}
              </button>
            ))
          )}
        </div>

        <div className="wp-flat__footer">
          <span className="wp-flat__footer-meta">
            {meta.total > 0
              ? `Showing ${meta.from}–${meta.to} of ${meta.total} notification${meta.total === 1 ? '' : 's'}`
              : '0 notifications'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={loading} onPageChange={setPage} />
        </div>
      </div>
    </div>
  )
}
