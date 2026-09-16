import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import api from '../api/client'
import PageLoadingRow from '../components/common/PageLoadingRow'
import AdmissionViewModal from '../components/admissions/AdmissionViewModal'
import { apiErrorMessage } from '../utils/apiError'
import './StudentsManagePage.css'

export default function AdmissionsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewAdmissionId, setViewAdmissionId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get('/my/admissions')
        if (!cancelled) setRows(data.data || data || [])
      } catch (err) {
        if (!cancelled) toast.error(apiErrorMessage(err, 'Failed to load admissions.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">My Admissions</h1>
          <p className="wp-flat__sub">
            View your enrollment records by term. Select View Details to see subjects and grades.
          </p>
        </div>
      </div>

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table">
            <thead>
              <tr>
                <th>Admission Number</th>
                <th>Term / School Year</th>
                <th>Course</th>
                <th>Major</th>
                <th>Year</th>
                <th>Section</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={8} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="wp-flat__empty">No admissions found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.admission_number}</td>
                    <td>{row.school_term?.name || '—'}</td>
                    <td>{row.program?.name || '—'}</td>
                    <td>{row.program_major?.label || row.program_major?.name || '—'}</td>
                    <td>{row.year_level ?? '—'}</td>
                    <td>{row.section || '—'}</td>
                    <td>{String(row.status || '—').toUpperCase()}</td>
                    <td>
                      <div className="wp-flat__actions">
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => setViewAdmissionId(row.id)}
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewAdmissionId ? (
        <AdmissionViewModal
          admissionId={viewAdmissionId}
          onClose={() => setViewAdmissionId(null)}
        />
      ) : null}
    </div>
  )
}
