import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiUsers,
  FiUserCheck,
  FiBriefcase,
  FiAlertCircle,
  FiBook,
  FiLayers,
  FiRefreshCw,
  FiArrowRight,
  FiClipboard,
  FiCheckCircle,
  FiUser,
} from 'react-icons/fi'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ACTIVITY_LOG_NAV_ENABLED } from '../layouts/nav'
import './HomePage.css'

const CHART_COLORS = {
  blue: '#1036c9',
  teal: '#0d9488',
  slate: '#64748b',
  warn: '#f30500',
}

const LEVEL_COLORS = [CHART_COLORS.blue, CHART_COLORS.teal]
const STATUS_COLORS = {
  enrolled: CHART_COLORS.blue,
  withdrawn: CHART_COLORS.warn,
  completed: CHART_COLORS.teal,
}

function formatFeedDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function HomePage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  function load() {
    setLoading(true)
    setReloadKey((k) => k + 1)
    api
      .get('/dashboard')
      .then((res) => setSummary(res.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="wp-home">
      <div className="wp-home__header">
        <div>
          <h1 className="wp-home__title">Dashboard</h1>
          <p className="wp-home__sub">
            Welcome, {user?.name || 'User'}.
          </p>
        </div>
        <button type="button" className="wp-home__refresh" onClick={load} disabled={loading}>
          <FiRefreshCw className={loading ? 'is-spin' : ''} />
          Refresh
        </button>
      </div>

      {user?.role === 'student' && (
        <StudentPortalHome reloadKey={reloadKey} />
      )}

      {user?.role === 'teacher' && (
        <TeacherDashboard summary={summary} loading={loading} />
      )}

      {user?.role === 'registrar' && (
        <RegistrarDashboard summary={summary} loading={loading} />
      )}

      {['admin', 'stakeholder', 'it'].includes(user?.role) && (
        <AdminDashboard summary={summary} loading={loading} role={user?.role} />
      )}
    </div>
  )
}

function FlatStat({ label, value, tone = 'blue', loading, to, hint }) {
  const ready = !loading
  const className = [
    'wp-regdash__stat',
    `wp-regdash__stat--${tone}`,
    to ? 'wp-regdash__stat--link' : '',
    !ready ? 'is-loading' : '',
  ].filter(Boolean).join(' ')

  const body = (
    <>
      <span className="wp-regdash__stat-label">{label}</span>
      {ready ? (
        <span className="wp-regdash__stat-value">{value ?? 0}</span>
      ) : (
        <span className="wp-regdash__stat-skeleton" aria-hidden />
      )}
      {hint ? <span className="wp-regdash__stat-hint">{hint}</span> : null}
    </>
  )

  if (to) {
    return <Link to={to} className={className}>{body}</Link>
  }
  return <div className={className}>{body}</div>
}

function ChartEmpty({ message = 'No data to display.' }) {
  return <p className="wp-regdash__chart-empty">{message}</p>
}

function ChartPanel({ title, loading, children, empty }) {
  return (
    <section className="wp-regdash__panel wp-regdash__chart-panel">
      <div className="wp-regdash__panel-head">{title}</div>
      <div className="wp-regdash__chart-body">
        {loading ? (
          <div className="wp-regdash__chart-skeleton" aria-hidden />
        ) : empty ? (
          <ChartEmpty />
        ) : (
          children
        )}
      </div>
    </section>
  )
}

function DonutChart({ data, colors }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={82}
          paddingAngle={2}
          stroke="#fff"
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell key={entry.key || entry.name} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [value, name]}
          contentStyle={{
            borderRadius: '0.25rem',
            border: '1px solid #dee2e6',
            fontSize: '0.8rem',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

function ChartLegend({ items }) {
  return (
    <ul className="wp-regdash__legend">
      {items.map((item) => (
        <li key={item.key || item.name}>
          <span className="wp-regdash__legend-swatch" style={{ background: item.color }} />
          <span className="wp-regdash__legend-label">{item.name}</span>
          <span className="wp-regdash__legend-value">{item.value}</span>
        </li>
      ))}
    </ul>
  )
}

function RegistrarDashboard({ summary, loading }) {
  const ready = !loading && summary
  const analytics = summary?.analytics

  const levelData = useMemo(() => {
    const rows = analytics?.students_by_level
    if (Array.isArray(rows) && rows.length) {
      return rows.map((row) => ({
        key: row.key,
        name: row.label,
        value: Number(row.total) || 0,
      }))
    }
    if (!ready) return []
    return [
      { key: 'college', name: 'College', value: Number(summary.students_college) || 0 },
      { key: 'shs', name: 'Senior High', value: Number(summary.students_shs) || 0 },
    ]
  }, [analytics, ready, summary])

  const programData = useMemo(() => {
    const rows = analytics?.students_by_program || summary?.students_by_program || []
    return rows
      .slice(0, 8)
      .map((row) => ({
        name: row.program || row.name || '—',
        fullName: row.name || row.program || '—',
        value: Number(row.total) || 0,
      }))
  }, [analytics, summary])

  const statusData = useMemo(() => {
    const rows = analytics?.admissions_by_status || []
    return rows.map((row) => ({
      key: row.key,
      name: row.label,
      value: Number(row.total) || 0,
      color: STATUS_COLORS[row.key] || CHART_COLORS.slate,
    }))
  }, [analytics])

  const termData = useMemo(() => {
    const rows = analytics?.admissions_by_term || []
    return rows.map((row) => ({
      name: row.label,
      value: Number(row.total) || 0,
    }))
  }, [analytics])

  const levelTotal = levelData.reduce((sum, row) => sum + row.value, 0)
  const statusTotal = statusData.reduce((sum, row) => sum + row.value, 0)
  const programTotal = programData.reduce((sum, row) => sum + row.value, 0)
  const termTotal = termData.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="wp-regdash">
      <div className="wp-regdash__stats wp-regdash__stats--six" aria-label="Registrar summary">
        <FlatStat label="Total Students" value={summary?.students} tone="blue" loading={loading} />
        <FlatStat label="College" value={summary?.students_college} tone="blue" loading={loading} />
        <FlatStat label="Senior High" value={summary?.students_shs} tone="teal" loading={loading} />
        <FlatStat
          label="Grade Submissions to Review"
          value={ready ? (summary.pending_grade_submissions ?? 0) : null}
          tone="warn"
          loading={loading}
          to="/grade-submissions-review"
          hint="Release period grades to students"
        />
        <FlatStat
          label="Pending Grade Change Approvals"
          value={ready ? (summary.pending_grade_changes ?? 0) : null}
          tone="warn"
          loading={loading}
          to="/grade-approvals"
          hint="Approve or reject teacher requests"
        />
        <FlatStat
          label="Total Admissions"
          value={ready ? (summary.admissions ?? 0) : null}
          tone="neutral"
          loading={loading}
          to="/admissions-manage"
          hint="Enrolment records on file"
        />
      </div>

      <div className="wp-regdash__charts" aria-label="Registrar analytics">
        <ChartPanel title="Students by Level" loading={loading} empty={!loading && levelTotal === 0}>
          <div className="wp-regdash__chart-split">
            <DonutChart data={levelData} colors={LEVEL_COLORS} />
            <ChartLegend
              items={levelData.map((row, i) => ({
                key: row.key,
                name: row.name,
                value: row.value,
                color: LEVEL_COLORS[i % LEVEL_COLORS.length],
              }))}
            />
          </div>
        </ChartPanel>

        <ChartPanel title="Students by Program" loading={loading} empty={!loading && programTotal === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={programData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                type="category"
                dataKey="name"
                width={56}
                tick={{ fontSize: 12, fill: '#64748b' }}
              />
              <Tooltip
                formatter={(value, _name, props) => [value, props?.payload?.fullName || 'Students']}
                contentStyle={{
                  borderRadius: '0.25rem',
                  border: '1px solid #dee2e6',
                  fontSize: '0.8rem',
                }}
              />
              <Bar dataKey="value" fill={CHART_COLORS.blue} radius={[0, 2, 2, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Admissions by Status" loading={loading} empty={!loading && statusTotal === 0}>
          <div className="wp-regdash__chart-split">
            <DonutChart
              data={statusData}
              colors={statusData.map((row) => row.color)}
            />
            <ChartLegend
              items={statusData.map((row) => ({
                key: row.key,
                name: row.name,
                value: row.value,
                color: row.color,
              }))}
            />
          </div>
        </ChartPanel>

        <ChartPanel title="Admissions by Term" loading={loading} empty={!loading && termTotal === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={termData} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-28}
                textAnchor="end"
                tick={{ fontSize: 11, fill: '#64748b' }}
                height={56}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip
                formatter={(value) => [value, 'Admissions']}
                contentStyle={{
                  borderRadius: '0.25rem',
                  border: '1px solid #dee2e6',
                  fontSize: '0.8rem',
                }}
              />
              <Bar dataKey="value" fill={CHART_COLORS.teal} radius={[2, 2, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
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
          <Link to="/grade-submissions-review" className="wp-regdash__link">
            <FiCheckCircle />
            Grade Submissions
            <FiArrowRight />
          </Link>
          <Link to="/grade-approvals" className="wp-regdash__link">
            <FiCheckCircle />
            Grade Change Approvals
            <FiArrowRight />
          </Link>
        </div>
      </section>

      <StudentsByProgramPanel summary={summary} ready={ready} />
    </div>
  )
}

function TeacherDashboard({ summary, loading }) {
  return (
    <div className="wp-regdash">
      <div className="wp-regdash__stats">
        <FlatStat
          label="My Classes"
          value={summary?.my_classes}
          tone="blue"
          loading={loading}
          to="/classes"
          hint="Open grade sheets"
        />
        <FlatStat
          label="Returned Submissions"
          value={summary?.returned_submissions}
          tone="warn"
          loading={loading}
          to="/grade-submissions"
          hint="Registrar sent back for correction"
        />
        <FlatStat
          label="Pending Change Requests"
          value={summary?.pending_change_requests}
          tone="warn"
          loading={loading}
          to="/grade-changes"
          hint="Awaiting registrar review"
        />
      </div>

      <section className="wp-regdash__panel">
        <div className="wp-regdash__panel-head">Quick Access</div>
        <div className="wp-regdash__links">
          <Link to="/classes" className="wp-regdash__link">
            <FiLayers />
            My Classes
            <FiArrowRight />
          </Link>
          <Link to="/grade-submissions" className="wp-regdash__link">
            <FiCheckCircle />
            Grade Submissions
            <FiArrowRight />
          </Link>
          <Link to="/grade-changes" className="wp-regdash__link">
            <FiAlertCircle />
            Grade Change Requests
            <FiArrowRight />
          </Link>
        </div>
      </section>
    </div>
  )
}

function StudentPortalHome({ reloadKey }) {
  return (
    <div className="wp-regdash">
      <section className="wp-regdash__panel">
        <div className="wp-regdash__panel-head">Quick Access</div>
        <div className="wp-regdash__links">
          <Link to="/profile" className="wp-regdash__link">
            <FiUser />
            My Profile
            <FiArrowRight />
          </Link>
          <Link to="/admissions" className="wp-regdash__link">
            <FiClipboard />
            My Admissions
            <FiArrowRight />
          </Link>
          <Link to="/curriculum" className="wp-regdash__link">
            <FiBook />
            Course Curriculum
            <FiArrowRight />
          </Link>
        </div>
      </section>

      <StudentAnnouncements reloadKey={reloadKey} />
    </div>
  )
}

function StudentAnnouncements({ reloadKey }) {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get('/announcements/feed')
      .then((res) => {
        if (!cancelled) setItems(Array.isArray(res.data?.data) ? res.data.data : [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <section className="wp-regdash__panel">
      <div className="wp-regdash__panel-head">Announcements</div>
      <div className="wp-regdash__panel-body">
        {loading ? (
          <p className="wp-regdash__note">Loading announcements…</p>
        ) : !items || items.length === 0 ? (
          <p className="wp-regdash__note">No announcements right now.</p>
        ) : (
          <ul className="wp-ann-feed">
            {items.map((a) => (
              <li key={a.id} className="wp-ann-feed__item">
                <div className="wp-ann-feed__head">
                  <span className="wp-ann-feed__title">{a.title}</span>
                  {a.published_at ? (
                    <span className="wp-ann-feed__date">{formatFeedDate(a.published_at)}</span>
                  ) : null}
                </div>
                <p className="wp-ann-feed__body">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function AdminDashboard({ summary, loading, role }) {
  const ready = !loading && summary
  const analytics = summary?.analytics
  const isIt = role === 'it'

  const levelData = useMemo(() => {
    const rows = analytics?.students_by_level
    if (Array.isArray(rows) && rows.length) {
      return rows.map((row) => ({
        key: row.key,
        name: row.label,
        value: Number(row.total) || 0,
      }))
    }
    if (!ready) return []
    return [
      { key: 'college', name: 'College', value: Number(summary.students_college) || 0 },
      { key: 'shs', name: 'Senior High', value: Number(summary.students_shs) || 0 },
    ]
  }, [analytics, ready, summary])

  const programData = useMemo(() => {
    const rows = analytics?.students_by_program || summary?.students_by_program || []
    return rows
      .slice(0, 8)
      .map((row) => ({
        name: row.program || row.name || '—',
        fullName: row.name || row.program || '—',
        value: Number(row.total) || 0,
      }))
  }, [analytics, summary])

  const roleData = useMemo(() => {
    const rows = analytics?.users_by_role || []
    return rows.map((row) => ({
      key: row.key,
      name: row.label,
      value: Number(row.total) || 0,
    }))
  }, [analytics])

  const statusData = useMemo(() => {
    const rows = analytics?.users_by_status || []
    return rows.map((row) => ({
      key: row.key,
      name: row.label,
      value: Number(row.total) || 0,
      color: row.key === 'active' ? CHART_COLORS.teal : CHART_COLORS.warn,
    }))
  }, [analytics])

  const admissionStatusData = useMemo(() => {
    const rows = analytics?.admissions_by_status || []
    return rows.map((row) => ({
      key: row.key,
      name: row.label,
      value: Number(row.total) || 0,
      color: STATUS_COLORS[row.key] || CHART_COLORS.slate,
    }))
  }, [analytics])

  const ROLE_COLORS = [CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.slate, '#f59e0b', '#6366f1', '#0ea5e9']

  const levelTotal = levelData.reduce((sum, row) => sum + row.value, 0)
  const programTotal = programData.reduce((sum, row) => sum + row.value, 0)
  const roleTotal = roleData.reduce((sum, row) => sum + row.value, 0)
  const statusTotal = statusData.reduce((sum, row) => sum + row.value, 0)
  const admissionTotal = admissionStatusData.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="wp-regdash">
      <div className="wp-regdash__stats wp-regdash__stats--six" aria-label="System summary">
        <FlatStat label="Students" value={summary?.students} tone="blue" loading={loading} />
        <FlatStat label="Teachers" value={summary?.teachers} tone="teal" loading={loading} />
        <FlatStat label="Programs" value={summary?.programs} tone="neutral" loading={loading} />
        <FlatStat label="Subjects" value={summary?.subjects} tone="blue" loading={loading} />
        <FlatStat label="Class Sections" value={summary?.class_sections} tone="teal" loading={loading} />
        <FlatStat
          label="Grade Completion"
          value={ready ? `${summary.grade_completion_percent}%` : null}
          tone="neutral"
          loading={loading}
        />
      </div>

      <div className="wp-regdash__stats">
        <FlatStat
          label={isIt ? 'Portal Users' : 'Grade Submissions to Review'}
          value={isIt ? (summary?.users_total ?? summary?.staff) : summary?.pending_grade_submissions}
          tone={isIt ? 'blue' : 'warn'}
          loading={loading}
          to={isIt ? '/users' : undefined}
          hint={isIt ? 'All portal accounts' : undefined}
        />
        <FlatStat
          label={isIt ? 'Active Accounts' : 'Pending Grade Changes'}
          value={isIt ? summary?.users_active : summary?.pending_grade_changes}
          tone={isIt ? 'teal' : 'warn'}
          loading={loading}
          to={isIt ? '/users' : undefined}
          hint={isIt ? 'Currently enabled' : undefined}
        />
        <FlatStat
          label="Admissions"
          value={summary?.admissions}
          tone="neutral"
          loading={loading}
        />
      </div>

      <div className="wp-regdash__charts" aria-label="System analytics">
        <ChartPanel title="Students by Level" loading={loading} empty={!loading && levelTotal === 0}>
          <div className="wp-regdash__chart-split">
            <DonutChart data={levelData} colors={LEVEL_COLORS} />
            <ChartLegend
              items={levelData.map((row, i) => ({
                key: row.key,
                name: row.name,
                value: row.value,
                color: LEVEL_COLORS[i % LEVEL_COLORS.length],
              }))}
            />
          </div>
        </ChartPanel>

        <ChartPanel title="Students by Program" loading={loading} empty={!loading && programTotal === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={programData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip
                formatter={(value, _name, props) => [value, props?.payload?.fullName || 'Students']}
                contentStyle={{
                  borderRadius: '0.25rem',
                  border: '1px solid #dee2e6',
                  fontSize: '0.8rem',
                }}
              />
              <Bar dataKey="value" fill={CHART_COLORS.blue} radius={[0, 2, 2, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        {isIt ? (
          <>
            <ChartPanel title="Users by Role" loading={loading} empty={!loading && roleTotal === 0}>
              <div className="wp-regdash__chart-split">
                <DonutChart data={roleData} colors={ROLE_COLORS} />
                <ChartLegend
                  items={roleData.map((row, i) => ({
                    key: row.key,
                    name: row.name,
                    value: row.value,
                    color: ROLE_COLORS[i % ROLE_COLORS.length],
                  }))}
                />
              </div>
            </ChartPanel>

            <ChartPanel title="Account Status" loading={loading} empty={!loading && statusTotal === 0}>
              <div className="wp-regdash__chart-split">
                <DonutChart
                  data={statusData}
                  colors={statusData.map((row) => row.color)}
                />
                <ChartLegend
                  items={statusData.map((row) => ({
                    key: row.key,
                    name: row.name,
                    value: row.value,
                    color: row.color,
                  }))}
                />
              </div>
            </ChartPanel>
          </>
        ) : (
          <ChartPanel title="Admissions by Status" loading={loading} empty={!loading && admissionTotal === 0}>
            <div className="wp-regdash__chart-split">
              <DonutChart
                data={admissionStatusData}
                colors={admissionStatusData.map((row) => row.color)}
              />
              <ChartLegend
                items={admissionStatusData.map((row) => ({
                  key: row.key,
                  name: row.name,
                  value: row.value,
                  color: row.color,
                }))}
              />
            </div>
          </ChartPanel>
        )}
      </div>

      {isIt ? (
        <section className="wp-regdash__panel">
          <div className="wp-regdash__panel-head">Quick Access</div>
          <div className="wp-regdash__links">
            <Link to="/users" className="wp-regdash__link">
              <FiUsers />
              User Accounts
              <FiArrowRight />
            </Link>
            <Link to="/system" className="wp-regdash__link">
              <FiBriefcase />
              Backup & Security
              <FiArrowRight />
            </Link>
            {ACTIVITY_LOG_NAV_ENABLED ? (
              <Link to="/activity-log" className="wp-regdash__link">
                <FiCheckCircle />
                Activity Log
                <FiArrowRight />
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="wp-regdash__panel">
          <div className="wp-regdash__panel-head">Quick Access</div>
          <div className="wp-regdash__links">
            <Link to="/reports/population" className="wp-regdash__link">
              <FiUsers />
              Population Report
              <FiArrowRight />
            </Link>
            <Link to="/reports/performance" className="wp-regdash__link">
              <FiBook />
              Performance Report
              <FiArrowRight />
            </Link>
            <Link to="/reports/grade-operations" className="wp-regdash__link">
              <FiCheckCircle />
              Grade Operations Report
              <FiArrowRight />
            </Link>
            {ACTIVITY_LOG_NAV_ENABLED ? (
              <Link to="/activity-log" className="wp-regdash__link">
                <FiClipboard />
                Activity Log
                <FiArrowRight />
              </Link>
            ) : null}
          </div>
        </section>
      )}

      <StudentsByProgramPanel summary={summary} ready={ready} />
    </div>
  )
}

function StudentsByProgramPanel({ summary, ready }) {
  if (!ready || !summary?.students_by_program?.length) return null

  return (
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
  )
}
