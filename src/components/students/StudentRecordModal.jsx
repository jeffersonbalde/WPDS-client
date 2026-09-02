import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import WestPrimeLoader from '../common/WestPrimeLoader'
import StudentProfilePanels from '../student-profile/StudentProfilePanels'
import { apiErrorMessage } from '../../utils/apiError'
import {
  normalizeEducationalBackground,
  normalizeParentsGuardian,
} from '../../utils/studentProfile'
import '../../pages/ProfilePage.css'
import './StudentRecordModal.css'

const ANIM_MS = 220

const SECTIONS = [
  { key: 'profile', label: 'Profile' },
  { key: 'admissions', label: 'Admissions' },
]

const PROFILE_TABS = [
  { key: 'info', label: 'Student Information' },
  { key: 'edu', label: 'Educational Background' },
  { key: 'parents', label: 'Parents/Guardian' },
]

const TERM_ORDER = {
  first_semester: 1,
  second_semester: 2,
  summer: 3,
}

function levelValue(level) {
  if (level && typeof level === 'object' && level.value) return String(level.value)
  return String(level || '')
}

function levelLabel(level) {
  const v = levelValue(level)
  if (v === 'college') return 'College'
  if (v === 'shs') return 'Senior High'
  return v || '—'
}

function fullName(profile) {
  if (!profile) return ''
  const middle = profile.middle_name ? ` ${profile.middle_name}` : ''
  return `${profile.last_name}, ${profile.first_name}${middle}`.trim()
}

function termLabel(admission) {
  const term = admission?.school_term
  if (!term) return '—'
  if (term.name) return term.name
  if (term.school_year) return term.school_year
  return '—'
}

function courseLabel(admission) {
  const p = admission?.program
  if (!p) return '—'
  return String(p.name || p.code || '—').toUpperCase()
}

function majorLabel(admission) {
  const major = admission?.program_major
  if (!major) return '—'
  const code = String(major.code || '').trim()
  const name = String(major.name || major.label || '').trim()
  if (code && name) return `${code} — ${name}`
  return name || code || '—'
}

function sortAdmissions(list) {
  return [...list].sort((a, b) => {
    const ay = String(a.school_term?.school_year || '')
    const by = String(b.school_term?.school_year || '')
    if (ay !== by) return by.localeCompare(ay)
    const at = TERM_ORDER[a.school_term?.term_type] || 99
    const bt = TERM_ORDER[b.school_term?.term_type] || 99
    if (at !== bt) return bt - at
    return (b.id || 0) - (a.id || 0)
  })
}

function formatGrade(value) {
  if (value === null || value === undefined || value === '') return 'NG'
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  return n.toFixed(2)
}

function gradeCell(enrollment, key) {
  return formatGrade(enrollment?.grade?.[key])
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function StudentRecordModal({ studentId, onClose }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('profile')
  const [tab, setTab] = useState('info')
  const [selectedAdmissionId, setSelectedAdmissionId] = useState(null)
  const [admissionSearch, setAdmissionSearch] = useState('')

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnim('leave')
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setAnim('open')
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (anim !== 'leave') return undefined
    const timer = window.setTimeout(() => {
      onClose?.()
    }, ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [anim, onClose])

  useEffect(() => {
    if (!studentId) return undefined
    let cancelled = false

    async function load() {
      setLoading(true)
      setSection('profile')
      setTab('info')
      setSelectedAdmissionId(null)
      setAdmissionSearch('')
      try {
        const { data } = await api.get(`/students/${studentId}`)
        if (cancelled) return
        setProfile({
          ...data,
          educational_background: normalizeEducationalBackground(data.educational_background),
          parents_guardian: normalizeParentsGuardian(data.parents_guardian),
        })
      } catch (err) {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, 'Failed to load student record.'))
          requestClose()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [studentId, requestClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e) {
      if (e.key === 'Escape') {
        if (selectedAdmissionId) setSelectedAdmissionId(null)
        else requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [requestClose, selectedAdmissionId])

  const admissions = useMemo(
    () => sortAdmissions(Array.isArray(profile?.admissions) ? profile.admissions : []),
    [profile],
  )

  const filteredAdmissions = useMemo(() => {
    const q = admissionSearch.trim().toLowerCase()
    if (!q) return admissions
    return admissions.filter((a) => {
      const hay = [
        a.admission_number,
        termLabel(a),
        courseLabel(a),
        majorLabel(a),
        a.year_level,
        a.section,
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [admissions, admissionSearch])

  const selectedAdmission = useMemo(
    () => admissions.find((a) => a.id === selectedAdmissionId) || null,
    [admissions, selectedAdmissionId],
  )

  const selectedSubjects = Array.isArray(selectedAdmission?.enrollment_subjects)
    ? selectedAdmission.enrollment_subjects
    : []

  const totalUnits = selectedSubjects.reduce((sum, es) => {
    const units = Number(es.class_section?.subject?.units)
    return sum + (Number.isFinite(units) ? units : 0)
  }, 0)

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm${animClass}`}
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
            <p className="wp-srm__eyebrow">Student record</p>
            <h2 id={titleId} className="wp-srm__title">
              {loading ? 'Loading…' : fullName(profile) || 'Student'}
            </h2>
            <div className="wp-srm__meta" aria-hidden={loading || !profile}>
              {loading || !profile ? (
                <>
                  <span className="wp-srm__chip wp-srm__chip--skeleton" />
                  <span className="wp-srm__chip wp-srm__chip--skeleton is-short" />
                </>
              ) : (
                <>
                  <span className="wp-srm__chip">{profile.student_no}</span>
                  <span className="wp-srm__chip">{levelLabel(profile.academic_level)}</span>
                </>
              )}
            </div>
            {!loading && profile ? (
              <div className="wp-srm__timestamps">
                <div className="wp-srm__timestamp">
                  <span className="wp-srm__timestamp-label">Registered</span>
                  <span className="wp-srm__timestamp-value">{formatDateTime(profile.created_at)}</span>
                </div>
                <div className="wp-srm__timestamp">
                  <span className="wp-srm__timestamp-label">Last updated</span>
                  <span className="wp-srm__timestamp-value">{formatDateTime(profile.updated_at)}</span>
                </div>
              </div>
            ) : null}
          </div>
          <div className="wp-srm__header-actions">
            <button
              type="button"
              className="wp-srm__icon-btn"
              onClick={requestClose}
              aria-label="Close"
            >
              <FiX size={20} />
            </button>
          </div>
        </header>

        <nav className="wp-srm__tabs" aria-label="Record sections">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`wp-srm__tab${section === s.key ? ' is-active' : ''}`}
              onClick={() => {
                setSection(s.key)
                if (s.key !== 'admissions') setSelectedAdmissionId(null)
              }}
              disabled={loading}
            >
              {s.label}
              {s.key === 'admissions' && admissions.length > 0 ? (
                <span className="wp-srm__tab-count">{admissions.length}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="wp-srm__body">
          {loading ? (
            <WestPrimeLoader variant="page" message="Loading…" label="Loading" />
          ) : !profile ? (
            <div className="wp-srm__loading">Student not found.</div>
          ) : section === 'profile' ? (
            <div className="wp-srm__profile">
              <div className="wp-srm__subtabs" role="tablist" aria-label="Profile sections">
                {PROFILE_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    className={`wp-srm__subtab${tab === t.key ? ' is-active' : ''}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="wp-srm__profile-panel">
                <StudentProfilePanels profile={profile} tab={tab} readOnly />
              </div>
            </div>
          ) : selectedAdmission ? (
            <div className="wp-srm__adm-detail">
              <button
                type="button"
                className="wp-srm__adm-back"
                onClick={() => setSelectedAdmissionId(null)}
              >
                <FiArrowLeft size={15} />
                Back to Admissions
              </button>

              <div className="wp-srm__adm-fields">
                <label className="wp-srm__adm-field">
                  <span>Term/School Year</span>
                  <input readOnly value={termLabel(selectedAdmission)} />
                </label>
                <label className="wp-srm__adm-field">
                  <span>Year Level</span>
                  <input readOnly value={selectedAdmission.year_level ?? '—'} />
                </label>
                <label className="wp-srm__adm-field">
                  <span>Section</span>
                  <input readOnly value={selectedAdmission.section || '—'} />
                </label>
                <label className="wp-srm__adm-field wp-srm__adm-field--wide">
                  <span>Course</span>
                  <input readOnly value={courseLabel(selectedAdmission)} />
                </label>
                <label className="wp-srm__adm-field">
                  <span>Admission Number</span>
                  <input readOnly value={selectedAdmission.admission_number || '—'} />
                </label>
                <label className="wp-srm__adm-field">
                  <span>Academic Major</span>
                  <input readOnly value={majorLabel(selectedAdmission)} />
                </label>
              </div>

              <div className="wp-srm__adm-table-wrap">
                <table className="wp-srm__adm-table">
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Descriptive Title</th>
                      <th>Units</th>
                      <th>Time</th>
                      <th>Day</th>
                      <th>Room</th>
                      <th>Instructor</th>
                      <th>Prelim</th>
                      <th>Midterm</th>
                      <th>Semi-Final</th>
                      <th>Final</th>
                      <th>Final Grade</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="wp-srm__adm-empty-cell">
                          No subjects enrolled for this admission.
                        </td>
                      </tr>
                    ) : (
                      selectedSubjects.map((es) => {
                        const subj = es.class_section?.subject
                        const teacher = es.class_section?.teacher
                        const remarks = String(es.grade?.remarks || '').toUpperCase()
                        const remarkTone = remarks === 'FAILED'
                          ? 'is-fail'
                          : remarks === 'PASSED'
                            ? 'is-pass'
                            : ''
                        return (
                          <tr key={es.id}>
                            <td>{subj?.code || '—'}</td>
                            <td>{subj?.title || subj?.name || '—'}</td>
                            <td>{subj?.units != null ? Number(subj.units).toFixed(2) : '—'}</td>
                            <td>{es.class_section?.schedule_time || '—'}</td>
                            <td>{es.class_section?.schedule_day || '—'}</td>
                            <td>{es.class_section?.room || '—'}</td>
                            <td>{teacher?.name || '—'}</td>
                            <td>{gradeCell(es, 'prelim')}</td>
                            <td>{gradeCell(es, 'midterm')}</td>
                            <td>{gradeCell(es, 'semi_final')}</td>
                            <td>{gradeCell(es, 'final')}</td>
                            <td>{gradeCell(es, 'final_grade')}</td>
                            <td>
                              {remarks ? (
                                <span className={`wp-srm__remark ${remarkTone}`.trim()}>{remarks}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {selectedSubjects.length > 0 ? (
                <p className="wp-srm__adm-units">
                  Total Units: {totalUnits.toFixed(1)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="wp-srm__admissions">
              {admissions.length === 0 ? (
                <div className="wp-srm__empty">
                  <p>No admissions yet.</p>
                  <Link
                    to="/admissions-manage"
                    className="wp-srm__btn wp-srm__btn--primary"
                    onClick={onClose}
                  >
                    Go to Admissions
                  </Link>
                </div>
              ) : (
                <>
                  <div className="wp-srm__adm-toolbar">
                    <label className="wp-srm__adm-search">
                      <span>Search</span>
                      <input
                        type="search"
                        className="form-control"
                        value={admissionSearch}
                        onChange={(e) => setAdmissionSearch(e.target.value)}
                        placeholder="Search admissions…"
                      />
                    </label>
                  </div>

                  <div className="wp-srm__adm-table-wrap">
                    <table className="wp-srm__adm-table">
                      <thead>
                        <tr>
                          <th>Admission Number</th>
                          <th>Term/School Year</th>
                          <th>Course</th>
                          <th>Academic Major</th>
                          <th>Year</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAdmissions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="wp-srm__adm-empty-cell">
                              No admissions match your search.
                            </td>
                          </tr>
                        ) : (
                          filteredAdmissions.map((a) => (
                            <tr key={a.id}>
                              <td>{a.admission_number}</td>
                              <td>{termLabel(a)}</td>
                              <td>{courseLabel(a)}</td>
                              <td>{majorLabel(a)}</td>
                              <td>{a.year_level ?? '—'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="wp-srm__btn wp-srm__btn--success wp-srm__btn--sm"
                                  onClick={() => setSelectedAdmissionId(a.id)}
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="wp-srm__adm-count">
                    Showing {filteredAdmissions.length} of {admissions.length} records
                  </p>
                </>
              )}
            </div>
          )}
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
