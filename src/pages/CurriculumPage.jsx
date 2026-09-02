import { useEffect, useState } from 'react'
import api from '../api/client'
import WestPrimeLoader from '../components/common/WestPrimeLoader'

export default function CurriculumPage() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/my/curriculum').then((res) => setData(res.data))
  }, [])

  if (!data) {
    return <WestPrimeLoader variant="page" message="Loading…" label="Loading" />
  }

  const items = data.items || []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">View Course Curriculum</h1>
      <p className="text-sm text-gray-600 mb-4">
        Note: The information in this view is provided for your reference only. Please contact the Registrar for confirmation.
      </p>
      <div className="mb-4 text-sm">
        <strong>Program:</strong> {data.program?.name || '—'}
        {data.program_major ? ` · ${data.program_major.label || data.program_major.name}` : ''}
      </div>
      <div className="bg-white border rounded overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Semester</th>
              <th>Course Code</th>
              <th>Descriptive Title</th>
              <th>Units</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.year_level}</td>
                <td>{item.semester}</td>
                <td>{item.subject?.code}</td>
                <td>{item.subject?.title}</td>
                <td>{item.subject?.units}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5}>No curriculum items.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
