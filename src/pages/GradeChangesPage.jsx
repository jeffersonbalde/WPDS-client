import { useCallback, useEffect, useState } from 'react'
import { FiPlus, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import PageLoadingRow from '../components/common/PageLoadingRow'
import GradeChangeRequestModal from '../components/grade-submissions/GradeChangeRequestModal'
import { apiErrorMessage } from '../utils/apiError'
import './StudentsManagePage.css'

function periodLabel(value) {
  const map = {
    prelim: 'Prelim',
    midterm: 'Midterm',
    semi_final: 'Semi-Final',
    final: 'Final',
  }
  return map[value] || value || '—'
}

export default function GradeChangesPage() {
  const [rows, setRows] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [changes, sections] = await Promise.all([
        api.get('/grade-change-requests'),
        api.get('/class-sections'),
      ])
      setRows(changes.data.data || changes.data || [])
      setClasses(sections.data.data || sections.data || [])
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load grade change requests.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="wp-flat wp-grade-changes">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Grade Change Requests</h1>
          <p className="wp-flat__sub">
            Request corrections to locked grades. Registrar approval is required before values change.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--primary"
            onClick={() => setModalOpen(true)}
            disabled={loading}
          >
            <FiPlus size={16} />
            New Request
          </button>
        </div>
      </div>

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Subject</th>
                <th>Period</th>
                <th>Old</th>
                <th>New</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={7} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="wp-flat__empty">No grade change requests yet.</td></tr>
              ) : (
                rows.map((r) => {
                  const profile = r.grade?.enrollment_subject?.admission?.student_profile
                  const studentName = profile
                    ? [profile.last_name, profile.first_name].filter(Boolean).join(', ')
                    : '—'
                  return (
                    <tr key={r.id}>
                      <td>{studentName || '—'}</td>
                      <td>{r.grade?.enrollment_subject?.class_section?.subject?.code || '—'}</td>
                      <td>{periodLabel(r.period_field)}</td>
                      <td>{r.old_value ?? '—'}</td>
                      <td>{r.new_value ?? '—'}</td>
                      <td>
                        <span className="wp-flat__status">{String(r.status || '—').toUpperCase()}</span>
                      </td>
                      <td>{r.reason || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <GradeChangeRequestModal
          classes={classes}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
