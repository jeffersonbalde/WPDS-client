import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client'
import WestPrimeLoader from '../components/common/WestPrimeLoader'

export default function GradeSheetPage() {
  const { id } = useParams()
  const [section, setSection] = useState(null)
  const [grades, setGrades] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get(`/class-sections/${id}`)
    setSection(data)
    const map = {}
    ;(data.enrollment_subjects || []).forEach((e) => {
      map[e.id] = {
        enrollment_subject_id: e.id,
        prelim: e.grade?.prelim ?? '',
        midterm: e.grade?.midterm ?? '',
        semi_final: e.grade?.semi_final ?? '',
        final: e.grade?.final ?? '',
        final_grade: e.grade?.final_grade,
        remarks: e.grade?.remarks,
        is_locked: e.grade?.is_locked,
      }
    })
    setGrades(map)
  }

  useEffect(() => {
    load()
  }, [id])

  function update(enrollmentId, field, value) {
    setGrades((g) => ({ ...g, [enrollmentId]: { ...g[enrollmentId], [field]: value } }))
  }

  async function save(lock = false) {
    setMessage('')
    setError('')
    try {
      await api.post(`/class-sections/${id}/grades`, {
        grades: Object.values(grades).map((g) => ({
          enrollment_subject_id: g.enrollment_subject_id,
          prelim: g.prelim === '' ? null : Number(g.prelim),
          midterm: g.midterm === '' ? null : Number(g.midterm),
          semi_final: g.semi_final === '' ? null : Number(g.semi_final),
          final: g.final === '' ? null : Number(g.final),
        })),
        lock,
      })
      setMessage(lock ? 'Grades submitted and locked.' : 'Grades saved.')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save grades')
    }
  }

  if (!section) {
    return <WestPrimeLoader variant="page" message="Loading…" label="Loading" />
  }

  const level = section.subject?.academic_level

  return (
    <div>
      <Link to="/classes" className="text-sm text-[var(--wp-blue)]">← Back to My Classes</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Grade Sheet</h1>
      <p className="text-sm text-gray-600 mb-4">
        {section.subject?.code} — {section.subject?.title} · Section {section.section} · Level: {String(level).toUpperCase()}
        {level === 'shs' ? ' (0–100)' : ' (1.00–5.00)'}
      </p>
      {message && <p className="text-green-700 text-sm mb-2">{message}</p>}
      {error && <p className="text-red-700 text-sm mb-2">{error}</p>}

      <div className="flex gap-2 mb-3">
        <button className="btn btn-primary" onClick={() => save(false)}>Save Grades</button>
        <button className="btn btn-success" onClick={() => save(true)}>Submit & Lock</button>
      </div>

      <div className="bg-white border rounded overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student No.</th>
              <th>Name</th>
              <th>Prelim</th>
              <th>Midterm</th>
              <th>Semi-Final</th>
              <th>Final</th>
              <th>Final Grade</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {(section.enrollment_subjects || []).map((e) => {
              const sp = e.admission?.student_profile
              const g = grades[e.id] || {}
              const locked = g.is_locked
              return (
                <tr key={e.id}>
                  <td>{sp?.student_no}</td>
                  <td>{sp ? `${sp.last_name}, ${sp.first_name}` : '—'}</td>
                  {['prelim', 'midterm', 'semi_final', 'final'].map((field) => (
                    <td key={field}>
                      <input
                        className="form-control w-20"
                        disabled={locked}
                        value={g[field] ?? ''}
                        onChange={(ev) => update(e.id, field, ev.target.value)}
                      />
                    </td>
                  ))}
                  <td className="font-semibold">{g.final_grade != null ? Number(g.final_grade).toFixed(2) : '—'}</td>
                  <td>{g.remarks || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-3">Final Grade = (Prelim + Midterm + Semi-Final + Final) ÷ 4. Locked grades require a Grade Change Request.</p>
    </div>
  )
}
