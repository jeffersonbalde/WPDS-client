import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiEdit3, FiBookOpen, FiUser, FiClipboard } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import WestPrimeLoader from '../components/common/WestPrimeLoader'
import StudentProfilePanels from '../components/student-profile/StudentProfilePanels'
import { apiErrorMessage } from '../utils/apiError'
import { majorLabel } from '../utils/program'
import {
  normalizeEducationalBackground,
  normalizeParentsGuardian,
} from '../utils/studentProfile'
import './ProfilePage.css'
import './StudentRecordPage.css'

const PROFILE_TABS = [
  { key: 'info', label: 'Student Information' },
  { key: 'edu', label: 'Educational Background' },
  { key: 'parents', label: 'Parents/Guardian' },
]

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

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function StudentRecordPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [section, setSection] = useState('overview')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get(`/students/${id}`)
        if (cancelled) return
        setProfile({
          ...data,
          educational_background: normalizeEducationalBackground(data.educational_background),
          parents_guardian: normalizeParentsGuardian(data.parents_guardian),
        })
      } catch (err) {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, 'Failed to load student record.'))
          navigate('/students')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, navigate])

  if (loading) {
    return <WestPrimeLoader variant="page" message="Loading…" label="Loading" />
  }

  if (!profile) {
    return <div className="wp-profile__error">Student not found.</div>
  }

  const active = profile.user?.is_active !== false
  const admissions = Array.isArray(profile.admissions) ? profile.admissions : []
  const activeLabel = PROFILE_TABS.find((t) => t.key === tab)?.label || 'Profile'

  return (
    <div className="wp-profile wp-profile--edit wp-record">
      <div className="wp-profile__header">
        <div>
          <Link to="/students" className="wp-record__back">
            <FiArrowLeft /> Back to Students
          </Link>
          <h1 className="wp-profile__title">Student Record</h1>
          <p className="wp-profile__sub">
            Complete student profile, portal account, and admission history.
          </p>
          <div className="wp-profile__badge-row">
            <span className="wp-profile__chip">{profile.student_no}</span>
            <span className="wp-profile__chip is-muted">{levelLabel(profile.academic_level)}</span>
            <span className={`wp-record__status${active ? ' is-active' : ' is-inactive'}`}>
              {active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <div className="wp-profile__actions">
          <Link to={`/students/${id}/edit`} className="wp-profile__btn wp-profile__btn--primary">
            <FiEdit3 />
            Edit Profile
          </Link>
        </div>
      </div>

      <div className="wp-record__section-nav" role="tablist" aria-label="Record sections">
        <button
          type="button"
          role="tab"
          aria-selected={section === 'overview'}
          className={`wp-record__section-btn${section === 'overview' ? ' is-active' : ''}`}
          onClick={() => setSection('overview')}
        >
          <FiUser /> Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'profile'}
          className={`wp-record__section-btn${section === 'profile' ? ' is-active' : ''}`}
          onClick={() => setSection('profile')}
        >
          <FiBookOpen /> Profile Details
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'admissions'}
          className={`wp-record__section-btn${section === 'admissions' ? ' is-active' : ''}`}
          onClick={() => setSection('admissions')}
        >
          <FiClipboard /> Admissions
          {admissions.length > 0 ? <span className="wp-record__count">{admissions.length}</span> : null}
        </button>
      </div>

      {section === 'overview' && (
        <div className="wp-record__overview">
          <section className="wp-record__card">
            <h2>Identity</h2>
            <dl className="wp-record__dl">
              <div>
                <dt>Full name</dt>
                <dd>{profile.last_name}, {profile.first_name}{profile.middle_name ? ` ${profile.middle_name}` : ''}</dd>
              </div>
              <div>
                <dt>Student number</dt>
                <dd className="wp-record__mono">{profile.student_no}</dd>
              </div>
              <div>
                <dt>Academic level</dt>
                <dd>{levelLabel(profile.academic_level)}</dd>
              </div>
              <div>
                <dt>Contact email</dt>
                <dd>{profile.contact_email || '—'}</dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>{profile.mobile || '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="wp-record__card">
            <h2>Portal account</h2>
            <dl className="wp-record__dl">
              <div>
                <dt>Login</dt>
                <dd className="wp-record__mono">{profile.user?.email || '—'}</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd>
                  <span className={`wp-record__status${active ? ' is-active' : ' is-inactive'}`}>
                    {active ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd className="text-capitalize">{profile.user?.role || 'student'}</dd>
              </div>
            </dl>
          </section>

          <section className="wp-record__card">
            <h2>Current placement</h2>
            <dl className="wp-record__dl">
              <div>
                <dt>Program</dt>
                <dd>
                  {profile.program
                    ? `${profile.program.code} — ${profile.program.name}`
                    : 'Not enrolled yet'}
                </dd>
              </div>
              <div>
                <dt>Major</dt>
                <dd>{profile.program_major ? majorLabel(profile.program_major) : '—'}</dd>
              </div>
              <div>
                <dt>Year level</dt>
                <dd>{profile.year_level ?? '—'}</dd>
              </div>
              <div>
                <dt>Section</dt>
                <dd>{profile.section || '—'}</dd>
              </div>
            </dl>
            <p className="wp-record__hint">
              Placement is updated when the student is enrolled under Admissions.
            </p>
          </section>
        </div>
      )}

      {section === 'profile' && (
        <div className="wp-profile__layout">
          <nav className="wp-profile__tabs" aria-label="Profile sections">
            {PROFILE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`wp-profile__tab${tab === t.key ? ' is-active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <section className="wp-profile__panel">
            <h2 className="wp-profile__panel-title">{activeLabel}</h2>
            <p className="wp-profile__note">
              This record is read-only. Use Edit Profile to update personal details.
            </p>
            <StudentProfilePanels profile={profile} tab={tab} readOnly />
          </section>
        </div>
      )}

      {section === 'admissions' && (
        <div className="wp-record__admissions">
          {admissions.length === 0 ? (
            <div className="wp-record__empty">
              <p>No admissions yet.</p>
              <Link to="/admissions-manage" className="wp-profile__btn wp-profile__btn--primary">
                Go to Admissions
              </Link>
            </div>
          ) : (
            admissions.map((a) => (
              <article key={a.id} className="wp-record__admission">
                <header className="wp-record__admission-head">
                  <div>
                    <h3 className="wp-record__mono">{a.admission_number}</h3>
                    <p>
                      {a.school_term?.name || 'Term'}
                      {a.school_term?.school_year ? ` · ${a.school_term.school_year}` : ''}
                    </p>
                  </div>
                  <span className={`wp-students__badge${a.status === 'enrolled' ? '' : ' is-muted'}`}>
                    {String(a.status || '—').toUpperCase()}
                  </span>
                </header>
                <dl className="wp-record__dl wp-record__dl--inline">
                  <div>
                    <dt>Program</dt>
                    <dd>{a.program ? `${a.program.code} — ${a.program.name}` : '—'}</dd>
                  </div>
                  <div>
                    <dt>Major</dt>
                    <dd>{a.program_major ? majorLabel(a.program_major) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Year</dt>
                    <dd>{a.year_level ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Section</dt>
                    <dd>{a.section || '—'}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(a.created_at)}</dd>
                  </div>
                </dl>
                {Array.isArray(a.enrollment_subjects) && a.enrollment_subjects.length > 0 ? (
                  <div className="wp-record__subjects">
                    <h4>Enrolled subjects</h4>
                    <ul>
                      {a.enrollment_subjects.map((es) => {
                        const subj = es.class_section?.subject
                        return (
                          <li key={es.id}>
                            <span className="wp-record__mono">{subj?.code || '—'}</span>
                            <span>{subj?.title || subj?.name || 'Subject'}</span>
                            {es.class_section?.section ? (
                              <span className="wp-record__muted">Sec. {es.class_section.section}</span>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="wp-record__hint">No subjects enrolled for this admission.</p>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </div>
  )
}
