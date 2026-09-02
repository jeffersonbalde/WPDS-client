import { useEffect, useState } from 'react'
import { FiTool } from 'react-icons/fi'
import api from '../api/client'
import './GradeApprovalsPage.css'

/**
 * Set to true when Grade Approvals is ready for the next phase.
 * Existing implementation is preserved in GradeApprovalsPageLive below.
 */
const GRADE_APPROVALS_ENABLED = false

export default function GradeApprovalsPage() {
  if (!GRADE_APPROVALS_ENABLED) {
    return <GradeApprovalsComingSoon />
  }

  return <GradeApprovalsPageLive />
}

function GradeApprovalsComingSoon() {
  return (
    <div className="wp-grade-approvals">
      <div className="wp-grade-approvals__header">
        <h1 className="wp-grade-approvals__title">Grade Change Approvals</h1>
        <p className="wp-grade-approvals__sub">
          Registrar review for grade change requests from faculty.
        </p>
      </div>

      <section className="wp-grade-approvals__placeholder" aria-live="polite">
        <span className="wp-grade-approvals__placeholder-icon" aria-hidden>
          <FiTool />
        </span>
        <h2 className="wp-grade-approvals__placeholder-title">Currently working</h2>
        <p className="wp-grade-approvals__placeholder-text">
          This module is under development and will be available in the next phase.
        </p>
      </section>
    </div>
  )
}

/** Full page — enable via GRADE_APPROVALS_ENABLED when ready. */
function GradeApprovalsPageLive() {
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')

  async function load() {
    const { data } = await api.get('/grade-change-requests', { params: { status: 'pending' } })
    setRows(data.data || data)
  }

  useEffect(() => {
    load()
  }, [])

  async function review(id, status) {
    await api.post(`/grade-change-requests/${id}/review`, { status })
    setMessage(`Request ${status}.`)
    load()
  }

  return (
    <div className="wp-grade-approvals">
      <div className="wp-grade-approvals__header">
        <h1 className="wp-grade-approvals__title">Grade Change Approvals</h1>
        <p className="wp-grade-approvals__sub">
          Registrar may approve or reject only. Grade values are changed by teachers via requests.
        </p>
      </div>
      {message ? <p className="wp-grade-approvals__message">{message}</p> : null}
      <div className="wp-grade-approvals__panel">
        <div className="table-responsive">
          <table className="wp-grade-approvals__table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Student</th>
                <th>Subject</th>
                <th>Period</th>
                <th>Old</th>
                <th>New</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.requester?.name}</td>
                  <td>{r.grade?.enrollment_subject?.admission?.student_profile?.last_name}</td>
                  <td>{r.grade?.enrollment_subject?.class_section?.subject?.code}</td>
                  <td>{r.period_field}</td>
                  <td>{r.old_value}</td>
                  <td>{r.new_value}</td>
                  <td>{r.reason}</td>
                  <td className="wp-grade-approvals__actions">
                    <button type="button" className="btn btn-success" onClick={() => review(r.id, 'approved')}>
                      Approve
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => review(r.id, 'rejected')}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="wp-grade-approvals__empty">No pending requests.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
