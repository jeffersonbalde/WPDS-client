import { useEffect, useState } from 'react'
import api from '../api/client'
import AdmissionViewModal from '../components/admissions/AdmissionViewModal'

export default function AdmissionsPage() {
  const [rows, setRows] = useState([])
  const [viewAdmissionId, setViewAdmissionId] = useState(null)

  useEffect(() => {
    api.get('/my/admissions').then((res) => setRows(res.data.data || res.data))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">My Admissions</h1>
      <p className="text-sm text-gray-600 mb-4">View your enrollment records by term. Select View Details to see subjects and grades.</p>
      <div className="bg-white border rounded shadow-sm overflow-x-auto">
        <table className="data-table">
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
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.admission_number}</td>
                <td>{row.school_term?.name}</td>
                <td>{row.program?.name}</td>
                <td>{row.program_major?.label || row.program_major?.name || '—'}</td>
                <td>{row.year_level}</td>
                <td>{row.section || '—'}</td>
                <td className="uppercase">{row.status}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => setViewAdmissionId(row.id)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8}>No admissions found.</td></tr>
            )}
          </tbody>
        </table>
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
