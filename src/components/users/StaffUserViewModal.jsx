import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import WestPrimeLoader from '../common/WestPrimeLoader'
import ClassSectionStudentsModal from '../class-sections/ClassSectionStudentsModal'
import { apiErrorMessage } from '../../utils/apiError'
import { initialsOf } from '../../utils/avatar'
import '../students/StudentRecordModal.css'
import '../../pages/StudentsManagePage.css'
import '../admissions/AdmissionViewModal.css'
import './StaffUserViewModal.css'

const ANIM_MS = 220

const ROLE_LABELS = {
  student: 'Student',
  teacher: 'Teacher',
  registrar: 'Registrar',
  it: 'IT',
  admin: 'Admin',
  stakeholder: 'Stakeholder',
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role || '—'
}

function fmtDateTime(value) {
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

export default function StaffUserViewModal({ userId, onClose, baseUrl = '/users' }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [viewSectionRow, setViewSectionRow] = useState(null)

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
    if (!userId) return undefined
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get(`${baseUrl}/${userId}`)
        if (!cancelled) setUser(data)
      } catch (err) {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, 'Failed to load user details.'))
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
  }, [userId, baseUrl, beginLeave])

  const staff = user?.staff_profile
  const isTeacher = user?.role === 'teacher'
  const classSections = user?.class_sections || []

  const accountFields = useMemo(() => {
    if (!user) return []
    return [
      { label: 'Full name', value: user.name || '—', span: 2 },
      { label: 'Email / Username', value: user.email || '—' },
      { label: 'Role', value: roleLabel(user.role) },
      { label: 'Status', value: user.is_active ? 'Active' : 'Inactive' },
      { label: 'Account created', value: fmtDateTime(user.created_at) },
      { label: 'Last updated', value: fmtDateTime(user.updated_at) },
    ]
  }, [user])

  const staffFields = useMemo(() => {
    if (!staff) {
      return [{ label: 'Staff profile', value: 'No staff profile on file.', span: 2 }]
    }
    return [
      { label: 'Employee number', value: staff.employee_no || '—' },
      { label: 'Position', value: staff.position || '—' },
      { label: 'Department', value: staff.department || '—', span: 2 },
      { label: 'Mobile', value: staff.mobile || '—' },
    ]
  }, [staff])

  const headerContext = user
    ? `${user.name || 'User'} · ${roleLabel(user.role)}`
    : 'Loading user…'

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
          <div className="wp-adm-view-modal__head wp-svm__head">
            <div className="wp-svm__avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" />
              ) : (
                <span>{initialsOf(user?.name)}</span>
              )}
            </div>
            <div>
              <h2 id={titleId} className="wp-srm__title">View user</h2>
              <p className="wp-adm-view-modal__context">{headerContext}</p>
            </div>
          </div>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="wp-srm__body">
          {loading ? (
            <div className="wp-adm-view-modal__state">
              <WestPrimeLoader variant="inline" message="Loading user…" label="Loading" />
            </div>
          ) : (
            <>
              <section className="wp-adm-view-modal__panel" aria-label="Account details">
                <h3 className="wp-adm-view-modal__panel-title">Account details</h3>
                <div className="wp-adm-view-modal__fields">
                  {accountFields.map((field) => (
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

              <section className="wp-adm-view-modal__panel" aria-label="Staff profile">
                <h3 className="wp-adm-view-modal__panel-title">Staff profile</h3>
                <div className="wp-adm-view-modal__fields">
                  {staffFields.map((field) => (
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

              {isTeacher ? (
                <section className="wp-adm-view-modal__panel wp-adm-view-modal__panel--subjects" aria-label="Assigned class sections">
                  <div className="wp-adm-view-modal__panel-head">
                    <h3 className="wp-adm-view-modal__panel-title">Assigned class sections</h3>
                    <span className="wp-adm-view-modal__units">{classSections.length} section{classSections.length === 1 ? '' : 's'}</span>
                  </div>

                  <div className="wp-flat__panel wp-adm-view-modal__table-panel">
                    <div className="table-responsive wp-adm-view-modal__table-scroll">
                      <table className="wp-flat__table">
                        <thead>
                          <tr>
                            <th className="wp-flat__num">#</th>
                            <th>Actions</th>
                            <th>Code</th>
                            <th>Subject</th>
                            <th>Section</th>
                            <th>Term</th>
                            <th>Schedule</th>
                            <th>Room</th>
                            <th>Enrolled</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classSections.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="wp-flat__empty">No class sections assigned to this teacher.</td>
                            </tr>
                          ) : (
                            classSections.map((row, idx) => (
                              <tr key={row.id}>
                                <td className="wp-flat__num">{idx + 1}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                                    onClick={() => setViewSectionRow(row)}
                                  >
                                    View Students
                                  </button>
                                </td>
                                <td>{row.subject?.code || '—'}</td>
                                <td>{row.subject?.title || '—'}</td>
                                <td>{row.section || '—'}</td>
                                <td>{row.school_term?.name || row.school_term?.school_year || '—'}</td>
                                <td>
                                  {[row.schedule_day, row.schedule_time].filter(Boolean).join(' · ') || '—'}
                                </td>
                                <td>{row.room || '—'}</td>
                                <td>{row.enrollment_subjects_count ?? 0}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>

      {viewSectionRow ? createPortal(
        <ClassSectionStudentsModal sectionRow={viewSectionRow} onClose={() => setViewSectionRow(null)} />,
        document.body
      ) : null}
    </div>
  )
}
