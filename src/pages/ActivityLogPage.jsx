import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiRefreshCw, FiSave, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import PageLoadingRow from '../components/common/PageLoadingRow'
import FlatPager from '../components/common/FlatPager'
import AuditDetailModal from '../components/audit/AuditDetailModal'
import { useAuth } from '../context/AuthContext'
import { actionLabel } from '../utils/auditLabels'
import { apiErrorMessage } from '../utils/apiError'
import { wpConfirm } from '../utils/wpSwal'
import './StudentsManagePage.css'
import './ActivityLogPage.css'

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'auth.login', label: 'Login' },
  { value: 'auth.logout', label: 'Logout' },
  { value: 'auth.login_failed', label: 'Failed login' },
  { value: 'auth.login_blocked', label: 'Blocked login' },
  { value: 'student.created', label: 'Student created' },
  { value: 'student.deleted', label: 'Student deleted' },
  { value: 'admission.created', label: 'Admission created' },
  { value: 'admission.status_updated', label: 'Admission status' },
  { value: 'admission.subjects_enrolled', label: 'Subjects enrolled' },
  { value: 'admission.deleted', label: 'Admission deleted' },
  { value: 'grade.updated', label: 'Grade updated' },
  { value: 'grade_submission', label: 'Grade submissions' },
  { value: 'grade_change', label: 'Grade change requests' },
  { value: 'user.', label: 'User accounts' },
  { value: 'system.', label: 'System / backups' },
]

const DEFAULT_RETENTION = {
  enabled: true,
  retention_days: 30,
  label: '1 month',
  last_run_at: null,
  last_deleted: null,
  options: [
    { value: 7, label: '1 week' },
    { value: 14, label: '2 weeks' },
    { value: 30, label: '1 month' },
    { value: 60, label: '2 months' },
    { value: 90, label: '3 months' },
    { value: 180, label: '6 months' },
    { value: 365, label: '1 year' },
  ],
}

function fmtDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
}

function recordSummary(row) {
  if (row.record_summary) return row.record_summary
  if (!row.auditable_type) return '—'
  const short = row.auditable_type.split('\\').pop()
  return row.auditable_id ? `${short} #${row.auditable_id}` : short
}

function userDisplayName(row) {
  if (row.user_name) return row.user_name
  if (row.user?.name) return row.user.name
  return 'System / Guest'
}

function roleLabel(role) {
  if (!role) return '—'
  const map = {
    student: 'Student',
    teacher: 'Teacher',
    registrar: 'Registrar',
    it: 'IT',
    admin: 'Admin',
    stakeholder: 'Stakeholder',
  }
  return map[role] || role
}

export default function ActivityLogPage() {
  const { user } = useAuth()
  const isIt = user?.role === 'it'

  const [rows, setRows] = useState([])
  const [actionFilter, setActionFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [retention, setRetention] = useState(DEFAULT_RETENTION)
  const [scheduleForm, setScheduleForm] = useState({
    enabled: DEFAULT_RETENTION.enabled,
    retention_days: DEFAULT_RETENTION.retention_days,
  })
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [working, setWorking] = useState(false)

  function applyRetention(raw) {
    if (!raw) return
    const next = {
      ...DEFAULT_RETENTION,
      ...raw,
      options: Array.isArray(raw.options) && raw.options.length ? raw.options : DEFAULT_RETENTION.options,
    }
    setRetention(next)
    setScheduleForm({
      enabled: !!next.enabled,
      retention_days: Number(next.retention_days) || 30,
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: perPage }
      if (actionFilter) params.action = actionFilter
      if (from) params.from = from
      if (to) params.to = to

      const { data } = await api.get('/audit-logs', { params })
      setRows(data.data || [])
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total || 0,
        from: data.from || 0,
        to: data.to || 0,
      })
      applyRetention(data.meta?.retention)
      setSelected(new Set())
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load the activity log.'))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, actionFilter, from, to])

  useEffect(() => {
    load()
  }, [load])

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((row) => selected.has(row.id)),
    [rows, selected],
  )

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(rows.map((row) => row.id)))
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function deleteSelected() {
    const ids = Array.from(selected)
    if (!ids.length) return

    const ok = await wpConfirm({
      icon: 'warning',
      title: ids.length === 1 ? 'Delete this entry?' : `Delete ${ids.length} entries?`,
      text: 'This permanently removes the selected activity records.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return

    setWorking(true)
    try {
      const { data } = await api.delete('/audit-logs', { data: { ids } })
      toast.success(data.message || 'Deleted.')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete activity entries.'))
    } finally {
      setWorking(false)
    }
  }

  async function deleteOne(row) {
    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Delete this entry?',
      text: `${actionLabel(row.action)} — ${fmtDateTime(row.created_at)}`,
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return

    setWorking(true)
    try {
      await api.delete(`/audit-logs/${row.id}`)
      toast.success('Activity entry deleted.')
      if (detail?.id === row.id) setDetail(null)
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete activity entry.'))
    } finally {
      setWorking(false)
    }
  }

  async function saveSchedule(e) {
    e.preventDefault()
    setScheduleSaving(true)
    try {
      const { data } = await api.put('/audit-logs/retention', {
        enabled: !!scheduleForm.enabled,
        retention_days: Number(scheduleForm.retention_days),
      })
      applyRetention(data.retention)
      toast.success(data.message || 'Auto-delete schedule saved.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save auto-delete schedule.'))
    } finally {
      setScheduleSaving(false)
    }
  }

  async function pruneOld() {
    const label = retention.label || `${retention.retention_days} days`
    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Clean old records now?',
      text: `Delete all activity entries older than ${label} right now.`,
      confirmText: 'Clean now',
      danger: true,
    })
    if (!ok) return

    setWorking(true)
    try {
      const { data } = await api.post('/audit-logs/prune', {
        days: Number(retention.retention_days) || 30,
      })
      if (data.retention) applyRetention(data.retention)
      toast.success(data.message || 'Cleanup done.')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to clean old records.'))
    } finally {
      setWorking(false)
    }
  }

  function clearFilters() {
    setActionFilter('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const scheduleDirty = scheduleForm.enabled !== retention.enabled
    || Number(scheduleForm.retention_days) !== Number(retention.retention_days)

  const retentionSummary = retention.enabled
    ? `Auto-delete is on · keep logs for ${retention.label}`
    : 'Auto-delete is off · logs are kept until cleaned manually'

  const colSpan = isIt ? 8 : 7

  return (
    <div className="wp-flat wp-audit">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Activity Log</h1>
          <p className="wp-flat__sub">
            Track logins, enrollments, grade actions, and account changes across the system.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading || working || scheduleSaving}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
          {isIt && selected.size > 0 ? (
            <button
              type="button"
              className="wp-flat__btn wp-flat__btn--danger"
              onClick={deleteSelected}
              disabled={working || scheduleSaving}
            >
              <FiTrash2 size={15} />
              Delete selected ({selected.size})
            </button>
          ) : null}
        </div>
      </div>

      {isIt ? (
        <div className="wp-audit__schedule">
          <div className="wp-audit__schedule-head">
            <div>
              <h2>Auto-delete schedule</h2>
              <p>Choose how long activity records are kept. The system removes older entries automatically every day.</p>
            </div>
            <span className={`wp-audit__badge${retention.enabled ? ' is-on' : ' is-off'}`}>
              {retention.enabled ? 'On' : 'Off'}
            </span>
          </div>

          <form className="wp-audit__schedule-form" onSubmit={saveSchedule}>
            <label className="wp-audit__check-field">
              <input
                type="checkbox"
                checked={scheduleForm.enabled}
                onChange={(e) => setScheduleForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                disabled={scheduleSaving || working}
              />
              <span>Automatically delete old records</span>
            </label>

            <label className="wp-audit__field">
              <span>Keep records for</span>
              <select
                className="form-select"
                value={scheduleForm.retention_days}
                onChange={(e) => setScheduleForm((prev) => ({
                  ...prev,
                  retention_days: Number(e.target.value),
                }))}
                disabled={scheduleSaving || working || !scheduleForm.enabled}
              >
                {(retention.options || DEFAULT_RETENTION.options).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <div className="wp-audit__schedule-actions">
              <button
                type="submit"
                className="wp-flat__btn wp-flat__btn--primary"
                disabled={scheduleSaving || working || !scheduleDirty}
              >
                <FiSave size={15} />
                {scheduleSaving ? 'Saving…' : 'Save schedule'}
              </button>
              <button
                type="button"
                className="wp-flat__btn wp-flat__btn--secondary"
                onClick={pruneOld}
                disabled={working || scheduleSaving || loading}
              >
                <FiTrash2 size={15} />
                Clean now
              </button>
            </div>
          </form>

          <div className="wp-audit__schedule-meta">
            <span>{retentionSummary}</span>
            {retention.last_run_at ? (
              <span>
                Last cleanup: {fmtDateTime(retention.last_run_at)}
                {retention.last_deleted != null ? ` · ${retention.last_deleted} removed` : ''}
              </span>
            ) : (
              <span>No automatic cleanup has run yet.</span>
            )}
          </div>
        </div>
      ) : (
        <div className="wp-audit__note" role="note">
          {retention.enabled
            ? <>Records older than <strong>{retention.label}</strong> are removed automatically every day.</>
            : <>Auto-delete is currently off. Older records stay until IT cleans them.</>}
        </div>
      )}

      <div className="wp-audit__filters" role="search" aria-label="Activity filters">
        <label className="wp-audit__filter">
          <span>Action</span>
          <select
            className="form-select"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
            aria-label="Filter by action"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="wp-audit__filter">
          <span>From</span>
          <input
            type="date"
            className="form-control"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          />
        </label>
        <label className="wp-audit__filter">
          <span>To</span>
          <input
            type="date"
            className="form-control"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1) }}
          />
        </label>
        <label className="wp-flat__records wp-audit__records">
          Records
          <select
            className="form-select wp-flat__control"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value))
              setPage(1)
            }}
            aria-label="Rows per page"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
        {(actionFilter || from || to) ? (
          <div className="wp-audit__filter-actions">
            <button type="button" className="wp-flat__btn wp-flat__btn--secondary wp-flat__btn--sm" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table wp-audit__table">
            <thead>
              <tr>
                {isIt ? (
                  <th className="wp-audit__check">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={loading || rows.length === 0}
                      aria-label="Select all on this page"
                    />
                  </th>
                ) : null}
                <th className="wp-flat__num">#</th>
                <th>Actions</th>
                <th>Date / Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={colSpan} message="Loading activity…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={colSpan} className="wp-flat__empty">No activity found for these filters.</td></tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id} className={selected.has(row.id) ? 'wp-audit__row-selected' : ''}>
                    {isIt ? (
                      <td className="wp-audit__check">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleOne(row.id)}
                          disabled={working}
                          aria-label={`Select entry ${row.id}`}
                        />
                      </td>
                    ) : null}
                    <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                    <td>
                      <div className="wp-flat__actions">
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => setDetail(row)}
                        >
                          View
                        </button>
                        {isIt ? (
                          <button
                            type="button"
                            className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                            onClick={() => deleteOne(row)}
                            disabled={working}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="wp-audit__when">{fmtDateTime(row.created_at)}</td>
                    <td className="wp-audit__user">{userDisplayName(row)}</td>
                    <td>{roleLabel(row.user?.role)}</td>
                    <td>
                      <span className="wp-audit__action">{actionLabel(row.action)}</span>
                    </td>
                    <td className="wp-audit__record">{recordSummary(row)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="wp-flat__footer">
          <span className="wp-flat__footer-meta">
            {meta.total > 0 ? `Showing ${meta.from}–${meta.to} of ${meta.total}` : '0 records'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={loading || working} onPageChange={setPage} />
        </div>
      </div>

      {detail ? <AuditDetailModal entry={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  )
}
