import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { apiErrorMessage } from '../../utils/apiError'
import { wpConfirm, wpConfirmDiscard } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import './SubjectFormModal.css'

const ANIM_MS = 220

function levelValue(level) {
  if (level && typeof level === 'object' && level.value) return String(level.value)
  return String(level || '')
}

function emptyForm() {
  return {
    code: '',
    title: '',
    units: '3',
    academic_level: 'college',
  }
}

function formFromSubject(subject) {
  if (!subject) return emptyForm()
  return {
    code: subject.code || '',
    title: subject.title || '',
    units: subject.units != null ? String(subject.units) : '3',
    academic_level: levelValue(subject.academic_level) === 'shs' ? 'shs' : 'college',
  }
}

function snapshot(form) {
  return JSON.stringify({
    code: String(form.code || '').trim().toUpperCase(),
    title: String(form.title || '').trim(),
    units: String(form.units ?? ''),
    academic_level: form.academic_level,
  })
}

export default function SubjectFormModal({ subject, onClose, onSaved }) {
  const titleId = useId()
  const firstFieldRef = useRef(null)
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const editing = Boolean(subject?.id)
  const [anim, setAnim] = useState('enter')
  const [form, setForm] = useState(() => formFromSubject(subject))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const savedSnap = useRef(snapshot(formFromSubject(subject))).current
  const dirty = snapshot(form) !== savedSnap

  const beginLeave = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnim('leave')
  }, [])

  const requestClose = useCallback(async () => {
    if (saving || closingRef.current) return
    if (dirty) {
      const ok = await wpConfirmDiscard('You have unsaved changes. Close this form and lose your progress?')
      if (!ok || closingRef.current) return
    }
    beginLeave()
  }, [saving, dirty, beginLeave])

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
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [])

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

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (saving) return

    const next = {}
    if (!String(form.code || '').trim()) next.code = 'Subject code is required.'
    if (!String(form.title || '').trim()) next.title = 'Subject title is required.'
    const units = Number(form.units)
    if (Number.isNaN(units) || units < 0) next.units = 'Units must be 0 or greater.'
    setErrors(next)
    if (Object.keys(next).length) return

    const code = String(form.code).trim().toUpperCase()
    const title = String(form.title).trim()
    const confirmed = await wpConfirm({
      icon: 'question',
      title: editing ? 'Save subject changes?' : 'Add this subject?',
      text: editing
        ? `Save changes to ${code} — ${title}?`
        : `Add ${code} — ${title} to the subject catalog?`,
      confirmText: editing ? 'Save changes' : 'Add Subject',
      focusCancel: false,
    })
    if (!confirmed || closingRef.current) return

    setSaving(true)
    const payload = {
      code,
      title,
      units,
      academic_level: form.academic_level,
    }
    if (!editing) payload.is_active = true

    try {
      if (editing) {
        await api.put(`/subjects/${subject.id}`, payload)
        toast.success('Subject updated.')
      } else {
        await api.post('/subjects', payload)
        toast.success('Subject added.')
      }
      savedRef.current = true
      beginLeave()
    } catch (err) {
      const data = err?.response?.data
      if (data?.errors && typeof data.errors === 'object') {
        const mapped = {}
        Object.entries(data.errors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setErrors(mapped)
      }
      toast.error(apiErrorMessage(err, editing ? 'Failed to update subject.' : 'Failed to add subject.'))
    } finally {
      setSaving(false)
    }
  }

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-subj-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <h2 id={titleId} className="wp-srm__title">
            {editing ? 'Edit Subject' : 'Add Subject'}
          </h2>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close" disabled={saving}>
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-subj-modal__form" onSubmit={submit} noValidate>
          <div className="wp-srm__body">
            <div className="wp-subj-modal__grid">
              <label className="wp-subj-modal__field">
                <span>Code</span>
                <input
                  ref={firstFieldRef}
                  className={errors.code ? 'is-invalid' : ''}
                  value={form.code}
                  onChange={(e) => setField('code', e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  maxLength={32}
                  disabled={saving}
                />
                {errors.code ? <small className="wp-subj-modal__error">{errors.code}</small> : null}
              </label>
              <label className="wp-subj-modal__field">
                <span>Title</span>
                <input
                  className={errors.title ? 'is-invalid' : ''}
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="Enter subject title"
                  disabled={saving}
                />
                {errors.title ? <small className="wp-subj-modal__error">{errors.title}</small> : null}
              </label>
              <label className="wp-subj-modal__field">
                <span>Units</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={errors.units ? 'is-invalid' : ''}
                  value={form.units}
                  onChange={(e) => setField('units', e.target.value)}
                  disabled={saving}
                />
                {errors.units ? <small className="wp-subj-modal__error">{errors.units}</small> : null}
              </label>
              <label className="wp-subj-modal__field">
                <span>Level</span>
                <select
                  className={editing ? 'is-locked' : ''}
                  value={form.academic_level}
                  onChange={(e) => setField('academic_level', e.target.value)}
                  disabled={saving || editing}
                  aria-describedby={editing ? 'subject-level-hint' : undefined}
                >
                  <option value="college">College</option>
                  <option value="shs">Senior High</option>
                </select>
                {editing ? (
                  <small id="subject-level-hint" className="wp-subj-modal__hint">
                    Level is set when the subject is created and cannot be changed.
                  </small>
                ) : null}
              </label>
            </div>
          </div>

          <footer className="wp-srm__footer">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="wp-srm__btn wp-srm__btn--primary" disabled={saving}>
              {saving ? 'Saving…' : (editing ? 'Save changes' : 'Add Subject')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
