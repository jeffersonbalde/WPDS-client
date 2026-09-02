import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { apiErrorMessage } from '../../utils/apiError'
import { wpConfirm, wpConfirmDiscard } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import './SchoolTermFormModal.css'

const ANIM_MS = 220

const TERM_TYPES = [
  { value: 'first_semester', label: 'First Semester' },
  { value: 'second_semester', label: 'Second Semester' },
  { value: 'summer', label: 'Summer' },
]

function termTypeLabel(value) {
  return TERM_TYPES.find((t) => t.value === value)?.label || value || '—'
}

function defaultSchoolYear() {
  const now = new Date()
  const year = now.getFullYear()
  if (now.getMonth() >= 5) return `${year}-${year + 1}`
  return `${year - 1}-${year}`
}

function emptyForm() {
  return {
    name: '',
    term_type: 'first_semester',
    school_year: defaultSchoolYear(),
    is_active: true,
  }
}

function formFromTerm(term) {
  if (!term?.id) return emptyForm()
  return {
    name: term.name || '',
    term_type: term.term_type || 'first_semester',
    school_year: term.school_year || defaultSchoolYear(),
    is_active: term.is_active !== false,
  }
}

function snapshot(form) {
  return JSON.stringify({
    name: String(form.name || '').trim(),
    term_type: String(form.term_type || ''),
    school_year: String(form.school_year || '').trim(),
    is_active: Boolean(form.is_active),
  })
}

export default function SchoolTermFormModal({ term, onClose, onSaved }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const editing = Boolean(term?.id)
  const [anim, setAnim] = useState('enter')
  const [form, setForm] = useState(() => formFromTerm(term))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const savedSnap = useRef(snapshot(formFromTerm(term))).current
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

  function fieldError(name) {
    const msg = errors[name]
    return Array.isArray(msg) ? msg[0] : msg || ''
  }

  async function submit(e) {
    e.preventDefault()
    if (saving) return

    const next = {}
    if (!String(form.name || '').trim()) next.name = 'Term name is required.'
    if (!String(form.school_year || '').trim()) next.school_year = 'School year is required.'
    if (!form.term_type) next.term_type = 'Term type is required.'
    setErrors(next)
    if (Object.keys(next).length) return

    const name = form.name.trim()
    const schoolYear = form.school_year.trim()
    const typeLabel = termTypeLabel(form.term_type)

    const confirmed = await wpConfirm({
      icon: 'question',
      title: editing ? 'Save school term changes?' : 'Add this school term?',
      text: editing
        ? `Save changes to ${name}?`
        : `Add ${name} (${typeLabel}, ${schoolYear}) to the school terms list?`,
      confirmText: editing ? 'Save changes' : 'Create term',
      focusCancel: false,
    })
    if (!confirmed || closingRef.current) return

    const payload = {
      name,
      term_type: form.term_type,
      school_year: schoolYear,
      is_active: Boolean(form.is_active),
    }

    setSaving(true)
    try {
      if (editing) {
        await api.put(`/school-terms/${term.id}`, payload)
        toast.success('School term updated.')
      } else {
        await api.post('/school-terms', payload)
        toast.success('School term created.')
      }
      savedRef.current = true
      beginLeave()
    } catch (err) {
      const serverErrors = err.response?.data?.errors
      if (serverErrors && typeof serverErrors === 'object') {
        const mapped = {}
        Object.entries(serverErrors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setErrors(mapped)
      } else {
        toast.error(apiErrorMessage(err, editing ? 'Failed to update school term.' : 'Failed to create school term.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-term-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <h2 id={titleId} className="wp-srm__title">
            {editing ? 'Edit School Term' : 'Add School Term'}
          </h2>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close" disabled={saving}>
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-term-modal__form" onSubmit={submit} noValidate>
          <div className="wp-srm__body">
            <div className="wp-term-modal__grid">
              <label className="wp-term-modal__field wp-term-modal__field--span-2">
                <span>Name</span>
                <input
                  className={fieldError('name') ? 'is-invalid' : ''}
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Enter term name"
                  disabled={saving}
                  required
                />
                {fieldError('name') ? <small className="wp-term-modal__error">{fieldError('name')}</small> : null}
              </label>

              <label className="wp-term-modal__field">
                <span>Type</span>
                <select
                  className={fieldError('term_type') ? 'is-invalid' : ''}
                  value={form.term_type}
                  onChange={(e) => setField('term_type', e.target.value)}
                  disabled={saving}
                  required
                >
                  {TERM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {fieldError('term_type') ? <small className="wp-term-modal__error">{fieldError('term_type')}</small> : null}
              </label>

              <label className="wp-term-modal__field">
                <span>School Year</span>
                <input
                  className={fieldError('school_year') ? 'is-invalid' : ''}
                  value={form.school_year}
                  onChange={(e) => setField('school_year', e.target.value)}
                  placeholder="2025-2026"
                  disabled={saving}
                  required
                />
                {fieldError('school_year') ? <small className="wp-term-modal__error">{fieldError('school_year')}</small> : null}
              </label>

              <label className="wp-term-modal__field wp-term-modal__field--span-2 wp-term-modal__check">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(e) => setField('is_active', e.target.checked)}
                  disabled={saving}
                />
                <span>Active term</span>
              </label>
            </div>
          </div>

          <footer className="wp-srm__footer">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="wp-srm__btn wp-srm__btn--primary" disabled={saving}>
              {saving ? 'Saving…' : (editing ? 'Save changes' : 'Create term')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
