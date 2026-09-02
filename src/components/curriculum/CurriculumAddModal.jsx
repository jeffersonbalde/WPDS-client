import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import FlatSearchSelect from '../common/FlatSearchSelect'
import { apiErrorMessage } from '../../utils/apiError'
import { wpConfirm, wpConfirmDiscard } from '../../utils/wpSwal'
import '../common/FlatSearchSelect.css'
import '../students/StudentRecordModal.css'
import './CurriculumAddModal.css'

const ANIM_MS = 220

const SEMESTER_LABELS = {
  1: '1st Semester',
  2: '2nd Semester',
  3: 'Summer',
}

function levelValue(level) {
  if (level && typeof level === 'object' && level.value) return String(level.value)
  return String(level || '')
}

function groupLabel(year, semester) {
  return `Year ${year} · ${SEMESTER_LABELS[semester] || `Sem ${semester}`}`
}

function emptyForm(initial = {}) {
  return {
    subject_id: '',
    year_level: String(initial.year_level ?? '1'),
    semester: String(initial.semester ?? '1'),
  }
}

function snapshot(form) {
  return JSON.stringify({
    subject_id: String(form.subject_id || ''),
    year_level: String(form.year_level || ''),
    semester: String(form.semester || ''),
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

export default function CurriculumAddModal({
  program,
  programId,
  items,
  subjects,
  initial,
  onClose,
  onSaved,
}) {
  const titleId = useId()
  const firstFieldRef = useRef(null)
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [form, setForm] = useState(() => emptyForm(initial))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const savedSnap = useRef(snapshot(emptyForm(initial))).current
  const dirty = snapshot(form) !== savedSnap

  const programLevel = levelValue(program?.academic_level)

  const yearOptions = useMemo(() => {
    const years = program?.duration_years || (programLevel === 'shs' ? 2 : 4)
    return Array.from({ length: years }, (_, i) => i + 1)
  }, [program, programLevel])

  const availableSubjects = useMemo(() => {
    const usedKeys = new Set(
      items
        .filter((row) => String(row.year_level) === String(form.year_level) && String(row.semester) === String(form.semester))
        .map((row) => String(row.subject_id || row.subject?.id)),
    )
    return subjects.filter((s) => {
      if (levelValue(s.academic_level) !== programLevel) return false
      if (s.is_active === false) return false
      return !usedKeys.has(String(s.id))
    })
  }, [subjects, programLevel, items, form.year_level, form.semester])

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
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key !== 'subject_id' ? { subject_id: '' } : {}),
    }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (!programId || saving) return

    const next = {}
    if (!form.subject_id) next.subject_id = 'Select a subject.'
    if (!form.year_level) next.year_level = 'Year is required.'
    if (!form.semester) next.semester = 'Semester is required.'
    setErrors(next)
    if (Object.keys(next).length) return

    const subject = availableSubjects.find((s) => String(s.id) === String(form.subject_id))
    const subjectLabel = subject ? `${subject.code} — ${subject.title}` : 'this subject'
    const confirmed = await wpConfirm({
      icon: 'question',
      title: 'Add to curriculum?',
      text: `Add ${subjectLabel} to ${program?.code || 'the program'} for ${groupLabel(form.year_level, form.semester)}?`,
      confirmText: 'Add subject',
      focusCancel: false,
    })
    if (!confirmed || closingRef.current) return

    setSaving(true)
    try {
      await api.post('/curriculum', {
        program_id: Number(programId),
        subject_id: Number(form.subject_id),
        year_level: Number(form.year_level),
        semester: Number(form.semester),
      })
      toast.success('Subject added to curriculum.')
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
      toast.error(apiErrorMessage(err, 'Failed to add subject to curriculum.'))
    } finally {
      setSaving(false)
    }
  }

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''
  const noSubjects = availableSubjects.length === 0

  return (
    <div
      className={`wp-srm wp-curr-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        className="wp-srm__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="wp-srm__header">
          <div className="wp-srm__header-main">
            <h2 id={titleId} className="wp-srm__title">Add Subject</h2>
            {program ? (
              <p className="wp-curr-modal__sub">
                {program.code} — {program.name}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="wp-srm__icon-btn"
            onClick={requestClose}
            aria-label="Close"
            disabled={saving}
          >
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-curr-modal__form" onSubmit={submit} noValidate>
          <div className="wp-srm__body">
            <div className="wp-curr-modal__grid">
              <label className="wp-curr-modal__field">
                <span>Year</span>
                <select
                  ref={firstFieldRef}
                  className={errors.year_level ? 'is-invalid' : ''}
                  value={form.year_level}
                  onChange={(e) => setField('year_level', e.target.value)}
                  disabled={saving}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>Year {y}</option>
                  ))}
                </select>
                {errors.year_level ? <small className="wp-curr-modal__error">{errors.year_level}</small> : null}
              </label>

              <label className="wp-curr-modal__field">
                <span>Semester</span>
                <select
                  className={errors.semester ? 'is-invalid' : ''}
                  value={form.semester}
                  onChange={(e) => setField('semester', e.target.value)}
                  disabled={saving}
                >
                  <option value="1">1st Semester</option>
                  <option value="2">2nd Semester</option>
                  <option value="3">Summer</option>
                </select>
                {errors.semester ? <small className="wp-curr-modal__error">{errors.semester}</small> : null}
              </label>

              <div className="wp-curr-modal__field wp-curr-modal__field--full">
                <FlatSearchSelect
                  className="wp-curr-modal__subject"
                  label="Subject"
                  required
                  embedded
                  options={availableSubjects}
                  value={form.subject_id}
                  onChange={(v) => setField('subject_id', v)}
                  disabled={saving || noSubjects}
                  placeholder={noSubjects ? 'No subjects available for this year and semester' : 'Select subject'}
                  searchPlaceholder="Search code or title"
                  getValue={(s) => s.id}
                  getLabel={subjectLabel}
                  getMeta={(s) => (s.units != null ? `${s.units} unit${Number(s.units) === 1 ? '' : 's'}` : null)}
                  filterBySearch={filterSubjectBySearch}
                  countLabel="subject"
                  invalid={Boolean(errors.subject_id)}
                />
                {errors.subject_id ? <small className="wp-curr-modal__error">{errors.subject_id}</small> : null}
                {noSubjects && !errors.subject_id ? (
                  <small className="wp-curr-modal__hint">
                    All catalog subjects may already be assigned for {groupLabel(form.year_level, form.semester)}.
                  </small>
                ) : null}
              </div>
            </div>
          </div>

          <footer className="wp-srm__footer">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="wp-srm__btn wp-srm__btn--primary"
              disabled={saving || noSubjects}
            >
              {saving ? 'Adding…' : 'Add Subject'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
