import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import FlatSearchSelect from '../common/FlatSearchSelect'
import { apiErrorMessage } from '../../utils/apiError'
import {
  gradeValidationMessage,
  isValidPeriodGrade,
  normalizeAcademicLevel,
  sanitizeGradeInput,
} from '../../utils/gradeInput'
import { wpConfirmDiscard } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import '../common/FlatSearchSelect.css'
import './GradeChangeRequestModal.css'

const ANIM_MS = 220

const PERIODS = [
  { id: 'prelim', name: 'Prelim' },
  { id: 'midterm', name: 'Midterm' },
  { id: 'semi_final', name: 'Semi-Final' },
  { id: 'final', name: 'Final' },
]

function emptyForm() {
  return {
    class_section_id: '',
    grade_id: '',
    period_field: 'final',
    new_value: '',
    reason: '',
  }
}

function snapshot(form) {
  return JSON.stringify({
    class_section_id: String(form.class_section_id || ''),
    grade_id: String(form.grade_id || ''),
    period_field: String(form.period_field || 'final'),
    new_value: String(form.new_value || '').trim(),
    reason: String(form.reason || '').trim(),
  })
}

function classLabel(c) {
  const code = c.subject?.code || 'Subject'
  const section = c.section ? `Sec ${c.section}` : '—'
  return `${code} — ${section}`
}

function classMeta(c) {
  const parts = [c.school_term?.name, c.subject?.title].filter(Boolean)
  return parts.join(' · ') || null
}

function filterClassBySearch(item, query) {
  const hay = [
    item.subject?.code,
    item.subject?.title,
    item.section,
    item.school_term?.name,
    item.room,
  ].filter(Boolean).join(' ').toLowerCase()
  return hay.includes(query)
}

function studentLabel(row) {
  const p = row.admission?.student_profile
  if (!p) return 'Unknown student'
  const name = [p.last_name, p.first_name].filter(Boolean).join(', ')
  return p.student_no ? `${name} (${p.student_no})` : name
}

function studentMeta(row) {
  return row.admission?.admission_number
    ? `Admission ${row.admission.admission_number}`
    : null
}

function filterStudentBySearch(item, query) {
  const p = item.admission?.student_profile
  const hay = [
    p?.last_name,
    p?.first_name,
    p?.middle_name,
    p?.student_no,
    item.admission?.admission_number,
  ].filter(Boolean).join(' ').toLowerCase()
  return hay.includes(query)
}

export default function GradeChangeRequestModal({ classes = [], onClose, onSaved }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [form, setForm] = useState(emptyForm)
  const [enrollments, setEnrollments] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const savedSnap = useRef(snapshot(emptyForm())).current
  const dirty = snapshot(form) !== savedSnap

  const studentOptions = useMemo(
    () => enrollments.filter((row) => row.grade?.id),
    [enrollments],
  )

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === String(form.class_section_id)) || null,
    [classes, form.class_section_id],
  )

  const gradeLevel = normalizeAcademicLevel(selectedClass?.subject?.academic_level || 'college')
  const newValueInvalid = form.new_value !== '' && !isValidPeriodGrade(form.new_value, gradeLevel)

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

  async function onClassChange(id) {
    setForm((f) => ({ ...f, class_section_id: id || '', grade_id: '' }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.class_section_id
      delete next.grade_id
      return next
    })
    if (!id) {
      setEnrollments([])
      return
    }
    setLoadingStudents(true)
    try {
      const { data } = await api.get(`/class-sections/${id}`)
      setEnrollments(data.enrollment_subjects || [])
    } catch (err) {
      setEnrollments([])
      toast.error(apiErrorMessage(err, 'Failed to load class students.'))
    } finally {
      setLoadingStudents(false)
    }
  }

  function fieldError(key) {
    return errors[key] || ''
  }

  async function submit(e) {
    e.preventDefault()
    if (saving) return

    const nextErrors = {}
    if (!form.class_section_id) nextErrors.class_section_id = 'Select a class.'
    if (!form.grade_id) nextErrors.grade_id = 'Select a student.'
    if (!String(form.new_value || '').trim()) nextErrors.new_value = 'Enter the new grade value.'
    else if (!isValidPeriodGrade(form.new_value, gradeLevel)) {
      nextErrors.new_value = gradeValidationMessage(gradeLevel)
    }
    if (!String(form.reason || '').trim()) nextErrors.reason = 'Provide a reason for the change.'
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      await api.post('/grade-change-requests', {
        grade_id: Number(form.grade_id),
        period_field: form.period_field,
        new_value: Number(form.new_value),
        reason: String(form.reason).trim(),
      })
      toast.success('Change request submitted for registrar approval.')
      savedRef.current = true
      beginLeave()
    } catch (err) {
      const apiErrors = err?.response?.data?.errors
      if (apiErrors && typeof apiErrors === 'object') {
        const mapped = {}
        Object.entries(apiErrors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setErrors(mapped)
      }
      toast.error(apiErrorMessage(err, 'Failed to submit change request.'))
    } finally {
      setSaving(false)
    }
  }

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-gcr-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <h2 id={titleId} className="wp-srm__title">Submit Grade Change Request</h2>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close" disabled={saving}>
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-gcr-modal__form" onSubmit={submit} noValidate>
          <div className="wp-srm__body">
            <p className="wp-gcr-modal__note">
              Locked grades cannot be edited directly. Submit a request for registrar review.
            </p>

            <div className="wp-gcr-modal__grid">
              <div className="wp-gcr-modal__field">
                <span>Class</span>
                <FlatSearchSelect
                  options={classes}
                  value={form.class_section_id}
                  onChange={onClassChange}
                  disabled={saving}
                  required
                  placeholder="Select class"
                  searchPlaceholder="Search subject, section, term…"
                  overlayPanel
                  getValue={(c) => String(c.id)}
                  getLabel={classLabel}
                  getMeta={classMeta}
                  filterBySearch={filterClassBySearch}
                  countLabel="class"
                  invalid={Boolean(fieldError('class_section_id'))}
                />
                {fieldError('class_section_id') ? (
                  <small className="wp-gcr-modal__error">{fieldError('class_section_id')}</small>
                ) : null}
              </div>

              <div className="wp-gcr-modal__field">
                <span>Student / Grade</span>
                <FlatSearchSelect
                  options={studentOptions}
                  value={form.grade_id}
                  onChange={(v) => setField('grade_id', v || '')}
                  disabled={saving || !form.class_section_id}
                  loading={loadingStudents}
                  required
                  placeholder={form.class_section_id ? 'Select student' : 'Select a class first'}
                  searchPlaceholder="Search name or student no…"
                  overlayPanel
                  getValue={(row) => String(row.grade.id)}
                  getLabel={studentLabel}
                  getMeta={studentMeta}
                  filterBySearch={filterStudentBySearch}
                  countLabel="student"
                  invalid={Boolean(fieldError('grade_id'))}
                />
                {fieldError('grade_id') ? (
                  <small className="wp-gcr-modal__error">{fieldError('grade_id')}</small>
                ) : null}
              </div>

              <label className="wp-gcr-modal__field">
                <span>Period</span>
                <select
                  className="form-select"
                  value={form.period_field}
                  onChange={(e) => setField('period_field', e.target.value)}
                  disabled={saving}
                >
                  {PERIODS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label className="wp-gcr-modal__field">
                <span>New Value</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={(fieldError('new_value') || newValueInvalid) ? 'is-invalid' : ''}
                  value={form.new_value}
                  onChange={(e) => setField('new_value', sanitizeGradeInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.ctrlKey || e.metaKey || e.altKey) return
                    const allowed = [
                      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
                    ]
                    if (allowed.includes(e.key)) return
                    if (e.key.length === 1 && !/[0-9.]/.test(e.key)) e.preventDefault()
                  }}
                  onPaste={(e) => {
                    e.preventDefault()
                    setField('new_value', sanitizeGradeInput(e.clipboardData.getData('text')))
                  }}
                  disabled={saving}
                  placeholder={gradeLevel === 'shs' ? '0–100' : '1.00–5.00'}
                  title={gradeValidationMessage(gradeLevel)}
                  required
                />
                {fieldError('new_value') ? (
                  <small className="wp-gcr-modal__error">{fieldError('new_value')}</small>
                ) : newValueInvalid ? (
                  <small className="wp-gcr-modal__error">{gradeValidationMessage(gradeLevel)}</small>
                ) : null}
              </label>

              <label className="wp-gcr-modal__field wp-gcr-modal__field--full">
                <span>Reason</span>
                <textarea
                  className={fieldError('reason') ? 'is-invalid' : ''}
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setField('reason', e.target.value)}
                  disabled={saving}
                  placeholder="Explain why this grade needs correction"
                  required
                />
                {fieldError('reason') ? (
                  <small className="wp-gcr-modal__error">{fieldError('reason')}</small>
                ) : null}
              </label>
            </div>
          </div>

          <footer className="wp-srm__footer">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="wp-srm__btn wp-srm__btn--primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
