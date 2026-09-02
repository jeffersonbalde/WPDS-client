import { useEffect, useState } from 'react'
import api from '../api/client'

export default function GradeChangesPage() {
  const [rows, setRows] = useState([])
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState({
    class_section_id: '',
    grade_id: '',
    period_field: 'final',
    new_value: '',
    reason: '',
  })
  const [enrollments, setEnrollments] = useState([])
  const [message, setMessage] = useState('')

  async function load() {
    const [changes, sections] = await Promise.all([
      api.get('/grade-change-requests'),
      api.get('/class-sections'),
    ])
    setRows(changes.data.data || changes.data)
    setClasses(sections.data.data || sections.data)
  }

  useEffect(() => {
    load()
  }, [])

  async function onClassChange(id) {
    setForm((f) => ({ ...f, class_section_id: id, grade_id: '' }))
    if (!id) return setEnrollments([])
    const { data } = await api.get(`/class-sections/${id}`)
    setEnrollments(data.enrollment_subjects || [])
  }

  async function submit(e) {
    e.preventDefault()
    setMessage('')
    await api.post('/grade-change-requests', {
      grade_id: Number(form.grade_id),
      period_field: form.period_field,
      new_value: Number(form.new_value),
      reason: form.reason,
    })
    setMessage('Change request submitted for registrar approval.')
    setForm((f) => ({ ...f, new_value: '', reason: '' }))
    load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Grade Change Requests</h1>

      <form onSubmit={submit} className="bg-white border rounded p-4 mb-6 grid md:grid-cols-2 gap-3">
        <label className="text-sm">
          Class
          <select className="form-select mt-1" value={form.class_section_id} onChange={(e) => onClassChange(e.target.value)} required>
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.subject?.code} — Sec {c.section}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Student / Grade
          <select className="form-select mt-1" value={form.grade_id} onChange={(e) => setForm({ ...form, grade_id: e.target.value })} required>
            <option value="">Select student</option>
            {enrollments.map((e) => (
              <option key={e.id} value={e.grade?.id}>
                {e.admission?.student_profile?.last_name}, {e.admission?.student_profile?.first_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Period
          <select className="form-select mt-1" value={form.period_field} onChange={(e) => setForm({ ...form, period_field: e.target.value })}>
            <option value="prelim">Prelim</option>
            <option value="midterm">Midterm</option>
            <option value="semi_final">Semi-Final</option>
            <option value="final">Final</option>
          </select>
        </label>
        <label className="text-sm">
          New Value
          <input className="form-control mt-1" value={form.new_value} onChange={(e) => setForm({ ...form, new_value: e.target.value })} required />
        </label>
        <label className="text-sm md:col-span-2">
          Reason
          <textarea className="form-control mt-1" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
        </label>
        <div className="md:col-span-2">
          <button className="btn btn-primary">Submit Request</button>
          {message && <span className="ml-3 text-sm text-green-700">{message}</span>}
        </div>
      </form>

      <div className="bg-white border rounded overflow-x-auto">
        <table className="data-table">
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.grade?.enrollment_subject?.admission?.student_profile?.last_name}</td>
                <td>{r.grade?.enrollment_subject?.class_section?.subject?.code}</td>
                <td>{r.period_field}</td>
                <td>{r.old_value}</td>
                <td>{r.new_value}</td>
                <td className="uppercase">{r.status}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
