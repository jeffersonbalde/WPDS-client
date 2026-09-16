import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiLock, FiAlertTriangle } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import WestPrimeLoader from '../components/common/WestPrimeLoader'
import { apiErrorMessage } from '../utils/apiError'
import {
  gradeRangeHint,
  gradeValidationMessage,
  isValidPeriodGrade,
  normalizeAcademicLevel,
  sanitizeGradeInput,
} from '../utils/gradeInput'
import { wpConfirm } from '../utils/wpSwal'
import './StudentsManagePage.css'
import './GradeSheetPage.css'

const PERIODS = [
  { key: 'prelim', label: 'Prelim' },
  { key: 'midterm', label: 'Midterm' },
  { key: 'semi_final', label: 'Semi-Final' },
  { key: 'final', label: 'Final' },
]

const STATUS_META = {
  draft: { label: 'Draft', cls: 'is-draft' },
  pending: { label: 'For review', cls: 'is-pending' },
  released: { label: 'Released', cls: 'is-released' },
  returned: { label: 'Returned', cls: 'is-returned' },
}

export default function GradeSheetPage() {
  const { id } = useParams()
  const [section, setSection] = useState(null)
  const [grades, setGrades] = useState({})
  const [submissions, setSubmissions] = useState({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await api.get(`/class-sections/${id}`)
    setSection(data)

    const map = {}
    ;(data.enrollment_subjects || []).forEach((e) => {
      map[e.id] = {
        enrollment_subject_id: e.id,
        prelim: e.grade?.prelim ?? '',
        midterm: e.grade?.midterm ?? '',
        semi_final: e.grade?.semi_final ?? '',
        final: e.grade?.final ?? '',
        final_grade: e.grade?.final_grade,
        remarks: e.grade?.remarks,
      }
    })
    setGrades(map)

    const subs = {}
    ;(data.grade_submissions || []).forEach((s) => {
      subs[s.period] = s
    })
    setSubmissions(subs)
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        await load()
      } catch (err) {
        if (!cancelled) toast.error(apiErrorMessage(err, 'Failed to load grade sheet.'))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [id])

  const level = normalizeAcademicLevel(section?.subject?.academic_level)

  function periodStatus(period) {
    return submissions[period]?.status || 'draft'
  }

  function isPeriodLocked(period) {
    const s = periodStatus(period)
    return s === 'pending' || s === 'released'
  }

  function periodComplete(period) {
    const rows = section?.enrollment_subjects || []
    if (rows.length === 0) return false
    return rows.every((e) => {
      const v = (grades[e.id] || {})[period]
      return v !== '' && v !== null && v !== undefined && isValidPeriodGrade(v, level)
    })
  }

  function update(enrollmentId, field, value) {
    const next = sanitizeGradeInput(value)
    setGrades((g) => ({ ...g, [enrollmentId]: { ...g[enrollmentId], [field]: next } }))
  }

  function collectInvalidGrades() {
    const invalid = []
    Object.values(grades).forEach((g) => {
      PERIODS.forEach((p) => {
        if (isPeriodLocked(p.key)) return
        const v = g[p.key]
        if (v === '' || v === null || v === undefined) return
        if (!isValidPeriodGrade(v, level)) {
          invalid.push(`${p.label}: ${v}`)
        }
      })
    })
    return invalid
  }

  async function saveDraft({ silent = false } = {}) {
    const invalid = collectInvalidGrades()
    if (invalid.length) {
      const err = new Error(gradeValidationMessage(level))
      err.code = 'INVALID_GRADE'
      throw err
    }

    const payload = {
      grades: Object.values(grades).map((g) => ({
        enrollment_subject_id: g.enrollment_subject_id,
        prelim: g.prelim === '' ? null : Number(g.prelim),
        midterm: g.midterm === '' ? null : Number(g.midterm),
        semi_final: g.semi_final === '' ? null : Number(g.semi_final),
        final: g.final === '' ? null : Number(g.final),
      })),
    }
    await api.post(`/class-sections/${id}/grades`, payload)
    if (!silent) toast.success('Draft grades saved.')
  }

  async function onSave() {
    setSaving(true)
    try {
      await saveDraft()
      await load()
    } catch (err) {
      if (err?.code === 'INVALID_GRADE') {
        toast.error(err.message)
      } else {
        toast.error(apiErrorMessage(err, 'Failed to save grades.'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function submitPeriod(period) {
    const label = PERIODS.find((p) => p.key === period)?.label || period
    if (!periodComplete(period)) {
      toast.error(`Encode valid ${label} grades (${gradeRangeHint(level)}) for every student before submitting.`)
      return
    }
    const ok = await wpConfirm({
      icon: 'question',
      title: `Submit ${label} grades?`,
      text: `${label} grades will be sent to the Registrar for review. You cannot edit them while they are under review.`,
      confirmText: `Submit ${label}`,
    })
    if (!ok) return

    setSaving(true)
    try {
      await saveDraft({ silent: true })
      await api.post(`/class-sections/${id}/grades/submit`, { period })
      toast.success(`${label} grades submitted for registrar review.`)
      await load()
    } catch (err) {
      if (err?.code === 'INVALID_GRADE') {
        toast.error(err.message)
      } else {
        toast.error(apiErrorMessage(err, `Failed to submit ${label} grades.`))
      }
    } finally {
      setSaving(false)
    }
  }

  if (!section) {
    return <WestPrimeLoader variant="page" message="Loading…" label="Loading" />
  }

  const rows = section.enrollment_subjects || []
  const returned = PERIODS.filter((p) => periodStatus(p.key) === 'returned')

  return (
    <div className="wp-flat wp-gradesheet">
      <div className="wp-flat__top">
        <div>
          <Link to="/classes" className="wp-gradesheet__back">
            <FiArrowLeft size={14} />
            Back to My Classes
          </Link>
          <h1 className="wp-flat__title">Grade Sheet</h1>
          <p className="wp-flat__sub">
            {section.subject?.code} — {section.subject?.title} · Section {section.section}
            {' · '}
            Level: {String(level || '').toUpperCase() || '—'}
            {level === 'shs' ? ' (0–100)' : ' (1.00–5.00)'}
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--primary"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      </div>

      <div className="wp-gradesheet__periods">
        {PERIODS.map((p) => {
          const status = periodStatus(p.key)
          const meta = STATUS_META[status]
          const locked = isPeriodLocked(p.key)
          const complete = periodComplete(p.key)
          return (
            <div key={p.key} className="wp-gradesheet__period">
              <div className="wp-gradesheet__period-head">
                <span className="wp-gradesheet__period-name">{p.label}</span>
                <span className={`wp-gradesheet__chip ${meta.cls}`}>{meta.label}</span>
              </div>
              <button
                type="button"
                className="wp-flat__btn wp-flat__btn--export wp-flat__btn--sm wp-gradesheet__submit"
                onClick={() => submitPeriod(p.key)}
                disabled={saving || locked || !complete}
                title={
                  locked
                    ? 'Already submitted'
                    : complete
                      ? `Submit ${p.label} for review`
                      : 'Encode all students first'
                }
              >
                {locked ? 'Submitted' : `Submit ${p.label}`}
              </button>
            </div>
          )
        })}
      </div>

      {returned.length > 0 ? (
        <div className="wp-gradesheet__returned" role="alert">
          <FiAlertTriangle size={16} />
          <div>
            {returned.map((p) => (
              <p key={p.key}>
                <strong>{p.label} returned by registrar:</strong>{' '}
                {submissions[p.key]?.review_remarks || 'No note provided.'} Correct the values and submit again.
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table">
            <thead>
              <tr>
                <th>Student No.</th>
                <th>Name</th>
                {PERIODS.map((p) => (
                  <th key={p.key}>
                    <span className="wp-gradesheet__th-period">
                      {p.label}
                      {isPeriodLocked(p.key) ? <FiLock size={12} aria-label="Locked" /> : null}
                    </span>
                  </th>
                ))}
                <th>Final Grade</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="wp-flat__empty">No students enrolled in this section.</td></tr>
              ) : (
                rows.map((e) => {
                  const sp = e.admission?.student_profile
                  const g = grades[e.id] || {}
                  return (
                    <tr key={e.id}>
                      <td>{sp?.student_no || '—'}</td>
                      <td>{sp ? `${sp.last_name}, ${sp.first_name}` : '—'}</td>
                      {PERIODS.map((p) => {
                        const value = g[p.key] ?? ''
                        const invalid = value !== '' && !isValidPeriodGrade(value, level)
                        return (
                          <td key={p.key}>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              className={`form-control wp-gradesheet__input${invalid ? ' is-invalid' : ''}`}
                              disabled={isPeriodLocked(p.key) || saving}
                              value={value}
                              title={gradeValidationMessage(level)}
                              aria-invalid={invalid}
                              onChange={(ev) => update(e.id, p.key, ev.target.value)}
                              onKeyDown={(ev) => {
                                if (ev.ctrlKey || ev.metaKey || ev.altKey) return
                                const allowed = [
                                  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                                  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
                                ]
                                if (allowed.includes(ev.key)) return
                                if (ev.key.length === 1 && !/[0-9.]/.test(ev.key)) {
                                  ev.preventDefault()
                                }
                              }}
                              onPaste={(ev) => {
                                ev.preventDefault()
                                const text = ev.clipboardData.getData('text')
                                update(e.id, p.key, text)
                              }}
                            />
                          </td>
                        )
                      })}
                      <td>{g.final_grade != null ? Number(g.final_grade).toFixed(2) : '—'}</td>
                      <td>{g.remarks || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="wp-flat__footer">
          <span className="wp-flat__footer-meta">
            Numbers only — College {gradeRangeHint('college')}, SHS {gradeRangeHint('shs')}.
            Final Grade = (Prelim + Midterm + Semi-Final + Final) ÷ 4. Students see grades only after registrar release.
          </span>
        </div>
      </div>
    </div>
  )
}
