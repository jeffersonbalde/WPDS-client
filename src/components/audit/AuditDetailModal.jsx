import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FiCalendar, FiFileText, FiShield, FiUser, FiX, FiZap } from 'react-icons/fi'
import { actionLabel } from '../../utils/auditLabels'
import './AuditDetailModal.css'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

const ANIM_MS = 220

const SKIP_KEYS = new Set([
  'password',
  'password_confirmation',
  'token',
  'remember_token',
  'avatar_path',
  'staff_profile',
  'class_section_ids',
  'student_profile_id',
  'school_term_id',
  'program_id',
  'user_id',
  'auditable_id',
  'auditable_type',
  'last_run_at',
  'last_deleted',
  'options',
])

const LABEL_MAP = {
  name: 'Name',
  email: 'Email',
  role: 'Role',
  login: 'Login',
  student_name: 'Student',
  student_no: 'Student no.',
  admission_number: 'Admission no.',
  status: 'Status',
  enabled: 'Auto-delete',
  retention_days: 'Keep for (days)',
  label: 'Keep for',
  period: 'Period',
  subject: 'Subject',
  subject_code: 'Subject code',
  system_name: 'School name',
  is_active: 'Active',
  year_level: 'Year level',
  section: 'Section',
  academic_level: 'Level',
  prelim: 'Prelim',
  midterm: 'Midterm',
  semi_final: 'Semi-final',
  final: 'Final',
  final_grade: 'Final grade',
  remarks: 'Remarks',
  deleted: 'Removed',
  days: 'Days',
}

function fmtWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
}

function roleLabel(role) {
  if (!role) return '—'
  const map = {
    student: 'Student',
    teacher: 'Teacher',
    registrar: 'Registrar',
    it: 'IT',
    admin: 'Admin',
    stakeholder: 'Stakeholder',
  }
  return map[role] || role
}

function prettyKey(key) {
  return LABEL_MAP[key] || String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function prettyValue(key, value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') {
    if (key === 'enabled' || key === 'is_active') return value ? 'On' : 'Off'
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'object') return null
  if (key === 'role') return roleLabel(String(value))
  if (key === 'period') return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  if (key === 'status') return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  if (key === 'academic_level') {
    const map = { college: 'College', shs: 'Senior High', jhs: 'Junior High' }
    return map[value] || String(value)
  }
  return String(value)
}

function buildDetailRows(entry) {
  const rows = []
  const seen = new Set()
  const sources = [
    entry?.old_values && typeof entry.old_values === 'object' ? entry.old_values : null,
    entry?.new_values && typeof entry.new_values === 'object' ? entry.new_values : null,
  ]

  const merged = {}
  for (const src of sources) {
    if (!src) continue
    Object.assign(merged, src)
  }

  // Prefer human label over raw day count when both exist.
  if (merged.label != null && merged.label !== '' && merged.retention_days != null) {
    delete merged.retention_days
  }
  if (merged.subject_code && merged.subject) {
    delete merged.subject
  }

  for (const [key, value] of Object.entries(merged)) {
    if (SKIP_KEYS.has(key) || seen.has(key)) continue
    const display = prettyValue(key, value)
    if (display == null) continue
    seen.add(key)
    rows.push({ key, label: prettyKey(key), value: display })
  }

  return rows.slice(0, 8)
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

  useBodyScrollLock()

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''
  const userName = entry?.user_name || entry?.user?.name || 'System / Guest'
  const action = actionLabel(entry?.action)
  const record = entry?.record_summary
    || (entry?.auditable_type
      ? `${entry.auditable_type.split('\\').pop()}${entry.auditable_id ? ` #${entry.auditable_id}` : ''}`
      : '—')
  const detailRows = useMemo(() => buildDetailRows(entry), [entry])

  return (
    <div
      className={`wp-audit-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-audit-modal__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-audit-modal__header">
          <div className="wp-audit-modal__hero">
            <span className="wp-audit-modal__icon" aria-hidden="true">
              <FiZap size={18} />
            </span>
            <div>
              <p className="wp-audit-modal__eyebrow">Activity detail</p>
              <h2 id={titleId} className="wp-audit-modal__title">{action}</h2>
            </div>
          </div>
          <button type="button" className="wp-audit-modal__close" onClick={requestClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="wp-audit-modal__body">
          <div className="wp-audit-modal__summary">
            <div className="wp-audit-modal__item">
              <span className="wp-audit-modal__item-icon" aria-hidden="true"><FiUser size={15} /></span>
              <div>
                <span className="wp-audit-modal__label">User</span>
                <strong>{userName}</strong>
                <em>{roleLabel(entry?.user?.role)}</em>
              </div>
            </div>
            <div className="wp-audit-modal__item">
              <span className="wp-audit-modal__item-icon" aria-hidden="true"><FiCalendar size={15} /></span>
              <div>
                <span className="wp-audit-modal__label">When</span>
                <strong>{fmtWhen(entry?.created_at)}</strong>
              </div>
            </div>
            <div className="wp-audit-modal__item wp-audit-modal__item--wide">
              <span className="wp-audit-modal__item-icon" aria-hidden="true"><FiFileText size={15} /></span>
              <div>
                <span className="wp-audit-modal__label">Record</span>
                <strong>{record}</strong>
              </div>
            </div>
          </div>

          {detailRows.length > 0 ? (
            <div className="wp-audit-modal__facts">
              <div className="wp-audit-modal__facts-head">
                <FiShield size={14} aria-hidden="true" />
                <span>Details</span>
              </div>
              <ul className="wp-audit-modal__facts-list">
                {detailRows.map((row) => (
                  <li key={row.key}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="wp-audit-modal__footer">
          <button type="button" className="wp-audit-modal__btn" onClick={requestClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
