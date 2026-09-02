import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { apiErrorMessage } from '../../utils/apiError'
import { majorLabel } from '../../utils/program'
import { wpConfirm } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import './AdmissionStatusModal.css'

const ANIM_MS = 220

const STATUS_OPTIONS = [
  { value: 'enrolled', label: 'Enrolled', hint: 'Student is actively enrolled for this term.' },
  { value: 'withdrawn', label: 'Withdrawn', hint: 'Student withdrew or cancelled enrollment for this term.' },
  { value: 'completed', label: 'Completed', hint: 'Student finished this term.' },
]

function statusLabel(value) {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label || value || '—'
}

function lineValue(primary, secondary) {
  const left = String(primary || '').trim()
  const right = String(secondary || '').trim()
  if (left && right) return `${left} · ${right}`
  return left || right || '—'
}

function confirmForStatus(next, studentName) {
  const name = studentName || 'this student'
  if (next === 'withdrawn') {
    return {
      title: 'Mark as withdrawn?',
      text: `${name} will no longer be counted as actively enrolled for this term.`,
      confirmText: 'Mark withdrawn',
      danger: true,
    }
  }
  if (next === 'completed') {
    return {
      title: 'Mark as completed?',
      text: `Mark ${name}'s admission as completed for this term?`,
      confirmText: 'Mark completed',
      danger: false,
    }
  }
  return {
    title: 'Mark as enrolled?',
    text: `Set ${name}'s admission back to enrolled for this term?`,
    confirmText: 'Mark enrolled',
    danger: false,
  }
}

export default function AdmissionStatusModal({ admission, onClose, onSaved }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [status, setStatus] = useState(admission?.status || 'enrolled')
  const [saving, setSaving] = useState(false)

  const studentName = admission?.student_profile
    ? `${admission.student_profile.last_name}, ${admission.student_profile.first_name}`
    : '—'

  const headerContext = lineValue(
    lineValue(studentName, admission?.student_profile?.student_no),
    admission?.admission_number,
  )

  const detailFields = useMemo(() => {
    const program = admission?.program
    const term = admission?.school_term
    return [
      { label: 'Term', value: lineValue(term?.name, term?.school_year) },
      {
        label: 'Program',
        value: lineValue(program?.code, program?.name),
        span: 2,
      },
      { label: 'Major', value: majorLabel(admission?.program_major) },
      { label: 'Year level', value: admission?.year_level ?? '—' },
      { label: 'Section', value: admission?.section || '—' },
      { label: 'Current status', value: statusLabel(admission?.status) },
    ]
  }, [admission])

  const beginLeave = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnim('leave')
  }, [])

  const requestClose = useCallback(() => {
    if (saving || closingRef.current) return
    beginLeave()
  }, [saving, beginLeave])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnim('open'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (anim !== 'leave') return undefined
    const timer = window.setTimeout(() => {
      if (savedRef.current) onSaved?.()
      else onClose?.()
    }, ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [anim, onClose, onSaved])

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

  async function submit(e) {
    e.preventDefault()
    if (!admission?.id || saving) return
    if (status === admission.status) {
      requestClose()
      return
    }

    const confirm = confirmForStatus(status, studentName !== '—' ? studentName : null)
    const ok = await wpConfirm({
      icon: 'question',
      title: confirm.title,
      text: confirm.text,
      confirmText: confirm.confirmText,
      danger: confirm.danger,
      focusCancel: false,
    })
    if (!ok || closingRef.current) return

    setSaving(true)
    try {
      await api.patch(`/admissions/${admission.id}/status`, { status })
      toast.success('Admission status updated.')
      savedRef.current = true
      beginLeave()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update admission status.'))
    } finally {
      setSaving(false)
    }
  }

  const selectedHint = STATUS_OPTIONS.find((o) => o.value === status)?.hint
  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-adm-status-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <div className="wp-adm-status-modal__head">
            <h2 id={titleId} className="wp-srm__title">Update admission status</h2>
            <p className="wp-adm-status-modal__context">{headerContext}</p>
          </div>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} disabled={saving} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-adm-status-modal__form" onSubmit={submit}>
          <div className="wp-srm__body">
            <section className="wp-adm-status-modal__panel" aria-label="Admission details">
              <h3 className="wp-adm-status-modal__panel-title">Admission details</h3>
              <div className="wp-adm-status-modal__fields">
                {detailFields.map((field) => (
                  <div
                    key={field.label}
                    className={`wp-adm-status-modal__field${field.span === 2 ? ' wp-adm-status-modal__field--span-2' : ''}`}
                  >
                    <span className="wp-adm-status-modal__field-label">{field.label}</span>
                    <div className="wp-adm-status-modal__readonly">{field.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="wp-adm-status-modal__panel" aria-label="Change status">
              <h3 className="wp-adm-status-modal__panel-title">Change status</h3>
              <label className="wp-adm-status-modal__field wp-adm-status-modal__field--span-2">
                <span className="wp-adm-status-modal__field-label">New status</span>
                <select
                  className="wp-adm-status-modal__select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={saving}
                  aria-label="Admission status"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {selectedHint ? <span className="wp-adm-status-modal__hint">{selectedHint}</span> : null}
              </label>
            </section>
          </div>

          <footer className="wp-srm__footer wp-adm-status-modal__foot">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="wp-srm__btn wp-srm__btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save status'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
