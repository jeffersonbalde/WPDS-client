import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client'

const NotificationsContext = createContext(null)

const POLL_MS = 45000

export function NotificationsProvider({ enabled = true, children }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [tick, setTick] = useState(0)

  const refreshUnread = useCallback(async () => {
    if (!enabled) return
    try {
      const { data } = await api.get('/notifications/unread-count')
      setUnreadCount(Number(data?.count) || 0)
    } catch {
      /* leave the previous count in place */
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    refreshUnread()
    const id = window.setInterval(refreshUnread, POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, refreshUnread])

  const markOneRead = useCallback(async (id) => {
    try {
      const { data } = await api.post(`/notifications/${id}/read`)
      setUnreadCount(Number(data?.unread_count) || 0)
    } catch {
      refreshUnread()
    }
  }, [refreshUnread])

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/read-all')
      setUnreadCount(0)
      setTick((t) => t + 1)
    } catch {
      refreshUnread()
    }
  }, [refreshUnread])

  const value = useMemo(
    () => ({ unreadCount, tick, refreshUnread, markOneRead, markAllRead }),
    [unreadCount, tick, refreshUnread, markOneRead, markAllRead],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  return useContext(NotificationsContext) ?? {
    unreadCount: 0,
    tick: 0,
    refreshUnread: () => {},
    markOneRead: () => {},
    markAllRead: () => {},
  }
}
