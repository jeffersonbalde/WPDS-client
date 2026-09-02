import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import WestPrimeLoader from '../common/WestPrimeLoader'
import { apiErrorMessage } from '../../utils/apiError'
import { majorLabel } from '../../utils/program'
import '../students/StudentRecordModal.css'
import '../../pages/StudentsManagePage.css'
import './AdmissionViewModal.css'

const ANIM_MS = 220

function statusLabel(value) {
  if (!value) return '—'
  const s = String(value)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function lineValue(primary, secondary) {
  const left = String(primary || '').trim()
  const right = String(secondary || '').trim()
  if (left && right) return `${left} · ${right}`
  return left || right || '—'
}

function fmtGrade(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}

function studentName(profile) {
  if (!profile) return '—'
  return `${profile.last_name || ''}, ${profile.first_name || ''}`.trim() || '—'
}

export default function AdmissionViewModal({ admissionId, onClose }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [loading, setLoading] = useState(true)
  const [admission, setAdmission] = useState(null)

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

  useEffect(() => {
    if (!admissionId) return undefined
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get(`/admissions/${admissionId}`)
        if (!cancelled) setAdmission(data)
      } catch (err) {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, 'Failed to load admission details.'))
          beginLeave()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [admissionId, beginLeave])

  const detailFields = useMemo(() => {
    if (!admission) return []
    const program = admission.program
    const term = admission.school_term
    return [
      { label: 'Student', value: lineValue(studentName(admission.student_profile), admission.student_profile?.student_no) },
      { label: 'Admission #', value: admission.admission_number || '—' },
      { label: 'Term', value: lineValue(term?.name, term?.school_year) },
      { label: 'Program', value: lineValue(program?.code, program?.name), span: 2 },
      { label: 'Major', value: majorLabel(admission.program_major) },
      { label: 'Year level', value: admission.year_level ?? '—' },
      { label: 'Section', value: admission.section || '—' },
      { label: 'Status', value: statusLabel(admission.status) },
    ]
  }, [admission])

  const enrollmentRows = admission?.enrollment_subjects || []
  const totalUnits = enrollmentRows.reduce(
    (sum, row) => sum + Number(row.class_section?.subject?.units || 0),
    0,
  )

  const headerContext = admission
    ? lineValue(
        lineValue(studentName(admission.student_profile), admission.student_profile?.student_no),
        admission.admission_number,
      )
    : 'Loading admission…'

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-adm-view-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <div className="wp-adm-view-modal__head">
            <h2 id={titleId} className="wp-srm__title">View admission</h2>
            <p className="wp-adm-view-modal__context">{headerContext}</p>
          </div>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="wp-srm__body">
          {loading ? (
            <div className="wp-adm-view-modal__state">
              <WestPrimeLoader variant="inline" message="Loading admission…" label="Loading" />
            </div>
          ) : (
            <>
              <section className="wp-adm-view-modal__panel" aria-label="Admission details">
                <h3 className="wp-adm-view-modal__panel-title">Admission details</h3>
                <div className="wp-adm-view-modal__fields">
                  {detailFields.map((field) => (
                    <div
                      key={field.label}
                      className={`wp-adm-view-modal__field${field.span === 2 ? ' wp-adm-view-modal__field--span-2' : ''}`}
                    >
                      <span className="wp-adm-view-modal__field-label">{field.label}</span>
                      <div className="wp-adm-view-modal__readonly">{field.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="wp-adm-view-modal__panel wp-adm-view-modal__panel--subjects" aria-label="Enrolled subjects">
                <div className="wp-adm-view-modal__panel-head">
                  <h3 className="wp-adm-view-modal__panel-title">Enrolled subjects</h3>
                  <span className="wp-adm-view-modal__units">Total units: {totalUnits.toFixed(1)}</span>
                </div>

                <div className="wp-flat__panel wp-adm-view-modal__table-panel">
                  <div className="table-responsive wp-adm-view-modal__table-scroll">
                    <table className="wp-flat__table">
                      <thead>
                        <tr>
                          <th className="wp-flat__num">#</th>
                          <th>Code</th>
                          <th>Title</th>
                          <th>Units</th>
                          <th>Time</th>
                          <th>Day</th>
                          <th>Room</th>
                          <th>Instructor</th>
                          <th>Prelim</th>
                          <th>Midterm</th>
                          <th>Semi-final</th>
                          <th>Final</th>
                          <th>Final grade</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrollmentRows.length === 0 ? (
                          <tr>
                            <td colSpan={14} className="wp-flat__empty">No subjects enrolled for this admission.</td>
                          </tr>
                        ) : (
                          enrollmentRows.map((row, idx) => {
                            const section = row.class_section || {}
                            const subject = section.subject || {}
                            const grade = row.grade || {}
                            return (
                              <tr key={row.id}>
                                <td className="wp-flat__num">{idx + 1}</td>
                                <td>{subject.code || '—'}</td>
                                <td>{subject.title || '—'}</td>
                                <td>{subject.units ?? '—'}</td>
                                <td>{section.schedule_time || '—'}</td>
                                <td>{section.schedule_day || '—'}</td>
                                <td>{section.room || '—'}</td>
                                <td>{section.teacher?.name || '—'}</td>
                                <td>{fmtGrade(grade.prelim)}</td>
                                <td>{fmtGrade(grade.midterm)}</td>
                                <td>{fmtGrade(grade.semi_final)}</td>
                                <td>{fmtGrade(grade.final)}</td>
                                <td>{fmtGrade(grade.final_grade)}</td>
                                <td>
                                  <span className="wp-flat__status">{grade.remarks || '—'}</span>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="wp-srm__footer wp-adm-view-modal__foot">
          <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
