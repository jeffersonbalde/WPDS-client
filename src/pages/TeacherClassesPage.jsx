import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

export default function TeacherClassesPage() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    api.get('/class-sections').then((res) => setRows(res.data.data || res.data))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">My Classes</h1>
      <div className="bg-white border rounded overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Title</th>
              <th>Term</th>
              <th>Section</th>
              <th>Schedule</th>
              <th>Room</th>
              <th>Students</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.subject?.code}</td>
                <td>{c.subject?.title}</td>
                <td>{c.school_term?.name}</td>
                <td>{c.section}</td>
                <td>{c.schedule_day} {c.schedule_time}</td>
                <td>{c.room}</td>
                <td>{c.enrollment_subjects?.length ?? 0}</td>
                <td>
                  <Link className="btn btn-primary" to={`/classes/${c.id}`}>Grade Sheet</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
