import { useCallback, useEffect, useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import PageLoadingRow from '../components/common/PageLoadingRow'
import GradeChangeReviewModal from '../components/grade-submissions/GradeChangeReviewModal'
import { apiErrorMessage } from '../utils/apiError'
import './StudentsManagePage.css'

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const PERIOD_LABEL = {
  prelim: 'Prelim',
  midterm: 'Midterm',
  semi_final: 'Semi-Final',
  final: 'Final',
}

function fmtGrade(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : String(value)
}

function studentName(sp) {
  if (!sp) return '—'
  return `${sp.last_name || ''}, ${sp.first_name || ''}`.trim() || '—'
}

export default function GradeApprovalsPage() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [reviewRow, setReviewRow] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/grade-change-requests', { params: { status } })
      setRows(data.data || data || [])
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load grade change requests.'))
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Grade Change Approvals</h1>
          <p className="wp-flat__sub">
            Approve or reject grade change requests from teachers.
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
        <select
          className="form-select wp-flat__control"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_TABS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table">
            <thead>
              <tr>
                <th className="wp-flat__num">#</th>
                <th>Actions</th>
                <th>Teacher</th>
                <th>Student</th>
                <th>Subject</th>
                <th>Period</th>
                <th>Old</th>
                <th>New</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={10} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="wp-flat__empty">No grade change requests found.</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const sp = r.grade?.enrollment_subject?.admission?.student_profile
                  const subjectCode = r.grade?.enrollment_subject?.class_section?.subject?.code
                  return (
                    <tr key={r.id}>
                      <td className="wp-flat__num">{idx + 1}</td>
                      <td>
                        <div className="wp-flat__actions">
                          <button
                            type="button"
                            className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                            onClick={() => setReviewRow(r)}
                          >
                            {r.status === 'pending' ? 'Review' : 'View'}
                          </button>
                        </div>
                      </td>
                      <td>{r.requester?.name || '—'}</td>
                      <td>{studentName(sp)}</td>
                      <td>{subjectCode || '—'}</td>
                      <td>{PERIOD_LABEL[r.period_field] || r.period_field}</td>
                      <td>{fmtGrade(r.old_value)}</td>
                      <td>{fmtGrade(r.new_value)}</td>
                      <td>{r.reason || '—'}</td>
                      <td><span className="wp-flat__status">{String(r.status || '—').toUpperCase()}</span></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reviewRow ? (
        <GradeChangeReviewModal
          request={reviewRow}
          onClose={() => setReviewRow(null)}
          onReviewed={() => {
            setReviewRow(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
