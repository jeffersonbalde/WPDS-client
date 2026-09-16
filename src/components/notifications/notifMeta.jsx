import { FiAlertCircle, FiBell, FiCheckCircle, FiClock } from 'react-icons/fi'

export function notifTone(type) {
  const t = String(type || '')
  if (t.endsWith('.released') || t.endsWith('.approved')) return 'success'
  if (t.endsWith('.returned') || t.endsWith('.rejected')) return 'danger'
  if (t.endsWith('.pending')) return 'warn'
  return 'default'
}

export function NotifIcon({ type, size = 16 }) {
  const tone = notifTone(type)
  if (tone === 'success') return <FiCheckCircle size={size} />
  if (tone === 'danger') return <FiAlertCircle size={size} />
  if (tone === 'warn') return <FiClock size={size} />
  return <FiBell size={size} />
}
