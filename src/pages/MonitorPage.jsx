import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api/client'

export default function MonitorPage() {
  const { resource } = useParams()
  const [rows, setRows] = useState([])
  const [title, setTitle] = useState('')

  useEffect(() => {
    async function load() {
      if (resource === 'students') {
        setTitle('Monitor — Students')
        const { data } = await api.get('/students')
        setRows((data.data || data).map((s) => ({
          id: s.id,
          a: s.student_no,
          b: `${s.last_name}, ${s.first_name}`,
          c: String(s.academic_level).toUpperCase(),
          d: s.program?.code,
          e: s.year_level,
        })))
      } else if (resource === 'teachers') {
        setTitle('Monitor — Teachers')
        const { data } = await api.get('/teachers')
        setRows(data.map((t) => ({ id: t.id, a: t.name, b: t.email, c: t.role, d: '—', e: '—' })))
      } else if (resource === 'programs') {
        setTitle('Monitor — Programs')
        const { data } = await api.get('/programs')
        const list = Array.isArray(data) ? data : (data?.data || [])
        setRows(list.map((p) => {
          const level = p.academic_level && typeof p.academic_level === 'object'
            ? p.academic_level.value
            : p.academic_level
          return { id: p.id, a: p.code, b: p.name, c: String(level || '').toUpperCase(), d: p.track_type, e: p.duration_years }
        }))
      } else if (resource === 'subjects') {
        setTitle('Monitor — Subjects')
        const { data } = await api.get('/subjects')
        setRows((data.data || data).map((s) => ({ id: s.id, a: s.code, b: s.title, c: s.units, d: s.academic_level, e: '—' })))
      }
    }
    load()
  }, [resource])

  const headers = {
    students: ['Student No.', 'Name', 'Level', 'Program', 'Year'],
    teachers: ['Name', 'Email', 'Role', '', ''],
    programs: ['Code', 'Name', 'Level', 'Track', 'Years'],
    subjects: ['Code', 'Title', 'Units', 'Level', ''],
  }[resource] || ['A', 'B', 'C', 'D', 'E']

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-sm text-gray-600 mb-4">Read-only monitoring view for Admin / Stakeholders.</p>
      <div className="bg-white border rounded overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>{headers.filter(Boolean).map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.a}</td>
                <td>{r.b}</td>
                <td>{r.c}</td>
                {headers[3] ? <td>{r.d}</td> : null}
                {headers[4] ? <td>{r.e}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
