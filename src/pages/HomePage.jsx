import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiUsers,
  FiUserCheck,
  FiBriefcase,
  FiAlertCircle,
  FiBook,
  FiLayers,
  FiPercent,
  FiRefreshCw,
  FiArrowRight,
  FiClipboard,
  FiCheckCircle,
} from 'react-icons/fi'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../layouts/nav'
import './HomePage.css'

export default function HomePage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    api
      .get('/dashboard')
      .then((res) => setSummary(res.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const title = pageTitle(user?.role)

  return (
    <div className="wp-home">
      <div className="wp-home__header">
        <div>
          <h1 className="wp-home__title">{title}</h1>
          <p className="wp-home__sub">
            {user?.role === 'registrar'
              ? `Welcome, ${user?.name || 'User'}.`
              : `Welcome, ${user?.name || 'User'} · ${roleLabel(user?.role)}. Overview of academic operations and records.`}
          </p>
        </div>
        <button type="button" className="wp-home__refresh" onClick={load} disabled={loading}>
          <FiRefreshCw className={loading ? 'is-spin' : ''} />
          Refresh
        </button>
      </div>

      {['student', 'alumni'].includes(user?.role) && (
        <StudentPortalHome summary={summary} />
      )}

      {user?.role === 'teacher' && (
        <div className="wp-home__stats">
          <StatCard tone="blue" icon={FiLayers} label="My Classes" value={summary?.my_classes} />
          <StatCard
            tone="amber"
            icon={FiAlertCircle}
            label="Pending Change Requests"
            value={summary?.pending_change_requests}
          />
        </div>
      )}

      {user?.role === 'registrar' && (
        <RegistrarDashboard summary={summary} loading={loading} />
      )}

      {['admin', 'stakeholder', 'it'].includes(user?.role) && (
        <AdminDashboard summary={summary} />
      )}
    </div>
  )
}

function RegistrarDashboard({ summary, loading }) {
  const ready = !loading && summary

  return (
    <div className="wp-regdash">
      <div className="wp-regdash__stats">
        <div className={`wp-regdash__stat wp-regdash__stat--blue${!ready ? ' is-loading' : ''}`}>
          <span className="wp-regdash__stat-label">Total Students</span>
          {ready ? (
            <span className="wp-regdash__stat-value">{summary.students ?? 0}</span>
          ) : (
            <span className="wp-regdash__stat-skeleton" aria-hidden />
          )}
        </div>
        <div className={`wp-regdash__stat wp-regdash__stat--blue${!ready ? ' is-loading' : ''}`}>
          <span className="wp-regdash__stat-label">College</span>
          {ready ? (
            <span className="wp-regdash__stat-value">{summary.students_college ?? 0}</span>
          ) : (
            <span className="wp-regdash__stat-skeleton" aria-hidden />
          )}
        </div>
        <div className={`wp-regdash__stat wp-regdash__stat--teal${!ready ? ' is-loading' : ''}`}>
          <span className="wp-regdash__stat-label">Senior High</span>
          {ready ? (
            <span className="wp-regdash__stat-value">{summary.students_shs ?? 0}</span>
          ) : (
            <span className="wp-regdash__stat-skeleton" aria-hidden />
          )}
        </div>
      </div>

      <div className="wp-regdash__stats wp-regdash__stats--two">
        <Link to="/grade-approvals" className="wp-regdash__stat wp-regdash__stat--warn wp-regdash__stat--link">
          <span className="wp-regdash__stat-label">Pending Grade Approvals</span>
          <span className="wp-regdash__stat-value">{ready ? (summary.pending_grade_changes ?? 0) : '—'}</span>
          <span className="wp-regdash__stat-hint">Review requests from faculty</span>
        </Link>
        <Link to="/admissions-manage" className="wp-regdash__stat wp-regdash__stat--neutral wp-regdash__stat--link">
          <span className="wp-regdash__stat-label">Total Admissions</span>
          <span className="wp-regdash__stat-value">{ready ? (summary.admissions ?? 0) : '—'}</span>
          <span className="wp-regdash__stat-hint">Enrolment records on file</span>
        </Link>
      </div>

      <section className="wp-regdash__panel">
        <div className="wp-regdash__panel-head">Quick Access</div>
        <div className="wp-regdash__links">
          <Link to="/students" className="wp-regdash__link">
            <FiUsers />
            Students
            <FiArrowRight />
          </Link>
          <Link to="/students/new" className="wp-regdash__link">
            <FiUserCheck />
            Add Student
            <FiArrowRight />
          </Link>
          <Link to="/admissions-manage" className="wp-regdash__link">
            <FiClipboard />
            Admissions
            <FiArrowRight />
          </Link>
          <Link to="/grade-approvals" className="wp-regdash__link">
            <FiCheckCircle />
            Grade Approvals
            <FiArrowRight />
          </Link>
        </div>
      </section>

      {ready && summary.students_by_program?.length > 0 ? (
        <section className="wp-regdash__panel">
          <div className="wp-regdash__panel-head">Students by Program</div>
          <div className="wp-regdash__panel-body">
            <div className="table-responsive">
              <table className="wp-regdash__table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Program</th>
                    <th className="wp-regdash__th-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.students_by_program.map((row) => (
                    <tr key={row.program || row.name || row.total}>
                      <td>{row.program || '—'}</td>
                      <td>{row.name || '—'}</td>
                      <td className="wp-regdash__td-num">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function AdminDashboard({ summary }) {
  return (
    <>
      <div className="wp-home__stats">
        <StatCard tone="blue" icon={FiUsers} label="Students" value={summary?.students} />
        <StatCard tone="teal" icon={FiUserCheck} label="Teachers" value={summary?.teachers} />
        <StatCard tone="indigo" icon={FiBriefcase} label="Programs" value={summary?.programs} />
        <StatCard
          tone="rose"
          icon={FiAlertCircle}
          label="Pending Grade Changes"
          value={summary?.pending_grade_changes}
        />
      </div>
      <div className="wp-home__stats">
        <StatCard tone="slate" icon={FiBook} label="Subjects" value={summary?.subjects} />
        <StatCard tone="cyan" icon={FiLayers} label="Class Sections" value={summary?.class_sections} />
        <StatCard
          tone="green"
          icon={FiPercent}
          label="Grade Completion"
          value={summary ? `${summary.grade_completion_percent}%` : null}
        />
      </div>

      {summary?.students_by_program?.length > 0 && (
        <section className="wp-home__panel">
          <div className="wp-home__panel-head">Students by Program</div>
          <div className="wp-home__panel-body wp-home__panel-body--flush">
            <div className="table-responsive">
              <table className="wp-home__table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Program</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.students_by_program.map((row) => (
                    <tr key={row.program || row.name}>
                      <td>{row.program}</td>
                      <td>{row.name}</td>
                      <td>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </>
  )
}

function StudentPortalHome({ summary }) {
  return (
    <div className="wp-home__stack">
      <section className="wp-home__panel">
        <div className="wp-home__panel-head">Quick Links</div>
        <div className="wp-home__panel-body">
          <div className="wp-home__links">
            <Link to="/profile" className="wp-home__link">
              My Profile <FiArrowRight />
            </Link>
            <Link to="/admissions" className="wp-home__link">
              My Admissions <FiArrowRight />
            </Link>
            <Link to="/curriculum" className="wp-home__link">
              Course Curriculum <FiArrowRight />
            </Link>
          </div>
          {summary && (
            <p className="wp-home__meta">
              Program: <strong>{summary.program?.name || '—'}</strong>
              {summary.program_major ? (
                <>
                  <span>·</span>
                  Major: <strong>{summary.program_major.label || summary.program_major.name}</strong>
                </>
              ) : null}
              <span>·</span>
              Year Level: <strong>{summary.year_level ?? '—'}</strong>
              <span>·</span>
              Level: <strong>{String(summary.academic_level || '').toUpperCase() || '—'}</strong>
            </p>
          )}
        </div>
      </section>

      <section className="wp-home__panel">
        <div className="wp-home__panel-head">Announcements</div>
        <div className="wp-home__panel-body">
          <p className="wp-home__note">
            Grades and academic records are available online. Contact the Registrar for confirmation of
            official records.
          </p>
        </div>
      </section>
    </div>
  )
}

function pageTitle(role) {
  if (role === 'teacher') return 'Faculty Dashboard'
  if (role === 'registrar') return 'Dashboard'
  if (role === 'it') return 'IT Administration Dashboard'
  if (role === 'admin') return 'System Administration Dashboard'
  if (role === 'stakeholder') return 'Stakeholder Dashboard'
  if (role === 'alumni') return 'Alumni Portal'
  return 'Student Portal'
}

function StatCard({ tone, icon: Icon, label, value }) {
  return (
    <div className={`wp-home__stat wp-home__stat--${tone}`}>
      <div className="wp-home__stat-icon">
        <Icon />
      </div>
      <div>
        <div className="wp-home__stat-label">{label}</div>
        <div className="wp-home__stat-value">{value ?? '—'}</div>
      </div>
    </div>
  )
}
