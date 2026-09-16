import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import '../students/StudentRecordModal.css'
import './AuditDetailModal.css'

const ANIM_MS = 220

function fmtJson(value) {
  if (value === null || value === undefined) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function AuditDetailModal({ entry, onClose }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const [anim, setAnim] = useState('enter')

  const beginLeave = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnim('leave')
  }, [])

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    beginLeave()
  }, [beginLeave])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnim('open'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (anim !== 'leave') return undefined
    const timer = window.setTimeout(() => onClose?.(), ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [anim, onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [requestClose])

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-audit-detail${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <div>
            <h2 id={titleId} className="wp-srm__title">Activity detail</h2>
            <p className="wp-audit-detail__context">{entry?.action}</p>
          </div>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="wp-srm__body">
          <div className="wp-audit-detail__meta">
            <div><span>User</span>{entry?.user?.name || 'System'}</div>
            <div><span>Role</span>{entry?.user?.role || '—'}</div>
            <div><span>Action</span>{entry?.action || '—'}</div>
            <div><span>Record</span>{entry?.auditable_type ? `${entry.auditable_type.split('\\').pop()} #${entry.auditable_id}` : '—'}</div>
            <div><span>IP address</span>{entry?.ip_address || '—'}</div>
            <div><span>When</span>{entry?.created_at ? new Date(entry.created_at).toLocaleString() : '—'}</div>
          </div>

          <div className="wp-audit-detail__values">
            <div>
              <h3>Before</h3>
              <pre>{fmtJson(entry?.old_values)}</pre>
            </div>
            <div>
              <h3>After</h3>
              <pre>{fmtJson(entry?.new_values)}</pre>
            </div>
          </div>
        </div>

        <footer className="wp-srm__footer">
          <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
