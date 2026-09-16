import { useCallback, useEffect, useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import PageLoadingRow from '../components/common/PageLoadingRow'
import FlatPager from '../components/common/FlatPager'
import AuditDetailModal from '../components/audit/AuditDetailModal'
import { apiErrorMessage } from '../utils/apiError'
import './StudentsManagePage.css'

function fmtDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function recordLabel(row) {
  if (!row.auditable_type) return '—'
  const short = row.auditable_type.split('\\').pop()
  return row.auditable_id ? `${short} #${row.auditable_id}` : short
}

export default function ActivityLogPage() {
  const [rows, setRows] = useState([])
  const [action, setAction] = useState('')
  const [debouncedAction, setDebouncedAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedAction(action.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [action])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: 25 }
      if (debouncedAction) params.action = debouncedAction
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
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load the activity log.'))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedAction, from, to])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Activity Log</h1>
          <p className="wp-flat__sub">
            Who changed what and when — grade edits, submissions, approvals, and account changes.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
        </div>
      </div>

      <div className="wp-flat__toolbar">
        <input
          type="search"
          className="form-control wp-flat__search"
          placeholder="Search action, e.g. grade.updated, user.created…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <label className="wp-flat__records">
          From
          <input
            type="date"
            className="form-control wp-flat__control"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          />
        </label>
        <label className="wp-flat__records">
          To
          <input
            type="date"
            className="form-control wp-flat__control"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1) }}
          />
        </label>
      </div>

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Record</th>
                <th>IP</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={7} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="wp-flat__empty">No activity found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{fmtDateTime(row.created_at)}</td>
                    <td>{row.user?.name || 'System'}</td>
                    <td>{row.user?.role || '—'}</td>
                    <td>{row.action}</td>
                    <td>{recordLabel(row)}</td>
                    <td>{row.ip_address || '—'}</td>
                    <td>
                      <div className="wp-flat__actions">
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => setDetail(row)}
                        >
                          View
                        </button>
                      </div>
                    </td>
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
          <FlatPager meta={meta} disabled={loading} onPageChange={setPage} />
        </div>
      </div>

      {detail ? <AuditDetailModal entry={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  )
}
