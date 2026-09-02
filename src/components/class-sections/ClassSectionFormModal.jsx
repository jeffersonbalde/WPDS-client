import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import FlatSearchSelect from '../common/FlatSearchSelect'
import { apiErrorMessage } from '../../utils/apiError'
import { levelLabel, levelValue } from '../../utils/level'
import { wpConfirmDiscard } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import '../common/FlatSearchSelect.css'
import './ClassSectionFormModal.css'

const ANIM_MS = 220

const SUBJECT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'college', label: 'College' },
  { key: 'shs', label: 'Senior High' },
]

function emptyForm() {
  return {
    school_term_id: '',
    subject_id: '',
    teacher_id: '',
    section: '',
    schedule_time: '',
    schedule_day: '',
    room: '',
  }
}

function formFromSection(section) {
  if (!section?.id) return emptyForm()
  return {
    school_term_id: String(section.school_term_id || section.school_term?.id || ''),
    subject_id: String(section.subject_id || section.subject?.id || ''),
    teacher_id: String(section.teacher_id || section.teacher?.id || ''),
    section: section.section || '',
    schedule_time: section.schedule_time || '',
    schedule_day: section.schedule_day || '',
    room: section.room || '',
  }
}

function snapshot(form) {
  return JSON.stringify({
    school_term_id: String(form.school_term_id || ''),
    subject_id: String(form.subject_id || ''),
    teacher_id: String(form.teacher_id || ''),
    section: String(form.section || '').trim().toUpperCase(),
    schedule_time: String(form.schedule_time || '').trim(),
    schedule_day: String(form.schedule_day || '').trim(),
    room: String(form.room || '').trim(),
  })
}

function subjectLabel(subject) {
  return `${subject.code} — ${subject.title}`
}

function filterSubjectBySearch(subject, query) {
  const code = String(subject.code || '').toLowerCase()
  const title = String(subject.title || '').toLowerCase()
  return code.includes(query) || title.includes(query)
}

function filterSubjectByLevel(subject, filterKey) {
  return levelValue(subject.academic_level) === filterKey
}

function filterTermBySearch(term, query) {
  const name = String(term.name || '').toLowerCase()
  const year = String(term.school_year || '').toLowerCase()
  return name.includes(query) || year.includes(query)
}

function filterTeacherBySearch(teacher, query) {
  const name = String(teacher.name || '').toLowerCase()
  const email = String(teacher.email || '').toLowerCase()
  return name.includes(query) || email.includes(query)
}

function buildPayload(form) {
  return {
    school_term_id: Number(form.school_term_id),
    subject_id: Number(form.subject_id),
    teacher_id: Number(form.teacher_id),
    section: form.section.trim(),
    schedule_time: form.schedule_time.trim(),
    schedule_day: form.schedule_day.trim(),
    room: form.room.trim(),
  }
}

export default function ClassSectionFormModal({
  section,
  terms,
  subjects,
  teachers,
  onClose,
  onSaved,
}) {
  const titleId = useId()
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const editing = Boolean(section?.id)
  const [anim, setAnim] = useState('enter')
  const [form, setForm] = useState(() => formFromSection(section))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const savedSnap = useRef(snapshot(formFromSection(section))).current
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
    if (!form.school_term_id) next.school_term_id = 'Term is required.'
    if (!form.subject_id) next.subject_id = 'Subject is required.'
    if (!form.teacher_id) next.teacher_id = 'Teacher is required.'
    if (!String(form.section || '').trim()) next.section = 'Section is required.'
    if (!String(form.schedule_day || '').trim()) next.schedule_day = 'Day is required.'
    if (!String(form.schedule_time || '').trim()) next.schedule_time = 'Time is required.'
    if (!String(form.room || '').trim()) next.room = 'Room is required.'
    setErrors(next)
    if (Object.keys(next).length) return

    const payload = buildPayload(form)
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/class-sections/${section.id}`, payload)
        toast.success('Class section updated.')
      } else {
        await api.post('/class-sections', payload)
        toast.success('Class section created.')
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
        toast.error(apiErrorMessage(err, editing ? 'Failed to update class section.' : 'Failed to create class section.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-cs-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <h2 id={titleId} className="wp-srm__title">
            {editing ? 'Edit Class Section' : 'Add Class Section'}
          </h2>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close" disabled={saving}>
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-cs-modal__form" onSubmit={submit} noValidate>
          <div className="wp-srm__body">
            <div className="wp-cs-modal__grid">
              <div className="wp-cs-modal__field wp-cs-modal__field--span-3">
                <FlatSearchSelect
                  label="Term"
                  required
                  options={terms}
                  value={form.school_term_id}
                  onChange={(v) => setField('school_term_id', v)}
                  disabled={saving}
                  placeholder="—"
                  searchPlaceholder="Search"
                  overlayPanel
                  getValue={(t) => t.id}
                  getLabel={(t) => t.name}
                  getMeta={(t) => t.school_year}
                  filterBySearch={filterTermBySearch}
                  countLabel="term"
                  invalid={Boolean(fieldError('school_term_id'))}
                />
                {fieldError('school_term_id') ? <small className="wp-cs-modal__error">{fieldError('school_term_id')}</small> : null}
              </div>

              <div className="wp-cs-modal__field wp-cs-modal__field--span-3">
                <FlatSearchSelect
                  label="Subject"
                  required
                  options={subjects}
                  value={form.subject_id}
                  onChange={(v) => setField('subject_id', v)}
                  disabled={saving}
                  placeholder="—"
                  searchPlaceholder="Search"
                  overlayPanel
                  getValue={(s) => s.id}
                  getLabel={subjectLabel}
                  getMeta={(s) => levelLabel(s.academic_level)}
                  filters={SUBJECT_FILTERS}
                  filterByFilter={filterSubjectByLevel}
                  filterBySearch={filterSubjectBySearch}
                  countLabel="subject"
                  invalid={Boolean(fieldError('subject_id'))}
                />
                {fieldError('subject_id') ? <small className="wp-cs-modal__error">{fieldError('subject_id')}</small> : null}
              </div>

              <div className="wp-cs-modal__field wp-cs-modal__field--span-2">
                <FlatSearchSelect
                  label="Teacher"
                  required
                  options={teachers}
                  value={form.teacher_id}
                  onChange={(v) => setField('teacher_id', v)}
                  disabled={saving}
                  placeholder="—"
                  searchPlaceholder="Search"
                  overlayPanel
                  getValue={(t) => t.id}
                  getLabel={(t) => t.name}
                  getMeta={(t) => t.email}
                  filterBySearch={filterTeacherBySearch}
                  countLabel="teacher"
                  invalid={Boolean(fieldError('teacher_id'))}
                />
                {fieldError('teacher_id') ? <small className="wp-cs-modal__error">{fieldError('teacher_id')}</small> : null}
              </div>

              <div className="wp-cs-modal__field wp-cs-modal__field--plain wp-cs-modal__field--span-1">
                <span className="wp-cs-modal__label">
                  Section <span className="wp-cs-modal__req" aria-hidden="true">*</span>
                </span>
                <input
                  className={fieldError('section') ? 'is-invalid' : ''}
                  value={form.section}
                  onChange={(e) => setField('section', e.target.value)}
                  placeholder="A"
                  disabled={saving}
                  required
                />
                {fieldError('section') ? <small className="wp-cs-modal__error">{fieldError('section')}</small> : null}
              </div>

              <div className="wp-cs-modal__divider" aria-hidden />

              <div className="wp-cs-modal__field wp-cs-modal__field--plain wp-cs-modal__field--span-1">
                <span className="wp-cs-modal__label">
                  Day <span className="wp-cs-modal__req" aria-hidden="true">*</span>
                </span>
                <input
                  className={fieldError('schedule_day') ? 'is-invalid' : ''}
                  value={form.schedule_day}
                  onChange={(e) => setField('schedule_day', e.target.value)}
                  placeholder="MWF"
                  disabled={saving}
                  required
                />
                {fieldError('schedule_day') ? <small className="wp-cs-modal__error">{fieldError('schedule_day')}</small> : null}
              </div>

              <div className="wp-cs-modal__field wp-cs-modal__field--plain wp-cs-modal__field--span-1">
                <span className="wp-cs-modal__label">
                  Time <span className="wp-cs-modal__req" aria-hidden="true">*</span>
                </span>
                <input
                  className={fieldError('schedule_time') ? 'is-invalid' : ''}
                  value={form.schedule_time}
                  onChange={(e) => setField('schedule_time', e.target.value)}
                  placeholder="8:00 AM"
                  disabled={saving}
                  required
                />
                {fieldError('schedule_time') ? <small className="wp-cs-modal__error">{fieldError('schedule_time')}</small> : null}
              </div>

              <div className="wp-cs-modal__field wp-cs-modal__field--plain wp-cs-modal__field--span-1">
                <span className="wp-cs-modal__label">
                  Room <span className="wp-cs-modal__req" aria-hidden="true">*</span>
                </span>
                <input
                  className={fieldError('room') ? 'is-invalid' : ''}
                  value={form.room}
                  onChange={(e) => setField('room', e.target.value)}
                  placeholder="201"
                  disabled={saving}
                  required
                />
                {fieldError('room') ? <small className="wp-cs-modal__error">{fieldError('room')}</small> : null}
              </div>
            </div>
          </div>

          <footer className="wp-srm__footer">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="wp-srm__btn wp-srm__btn--primary" disabled={saving}>
              {saving ? 'Saving…' : (editing ? 'Save' : 'Create')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
