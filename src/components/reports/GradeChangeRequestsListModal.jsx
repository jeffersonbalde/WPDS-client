import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import FlatPager from '../common/FlatPager'
import WestPrimeLoader from '../common/WestPrimeLoader'
import GradeChangeReviewModal from '../grade-submissions/GradeChangeReviewModal'
import { apiErrorMessage } from '../../utils/apiError'
import '../students/StudentRecordModal.css'
import '../../pages/StudentsManagePage.css'
import './StudentListModal.css'

const ANIM_MS = 220

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
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

export default function GradeChangeRequestsListModal({ title, contextLine, baseParams, initialStatus = 'all', onClose }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState(initialStatus)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [reviewRow, setReviewRow] = useState(null)

  const beginLeave = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnim('leave')
  }, [])

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    beginLeave()
  }, [beginLeave])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnim('open'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (anim !== 'leave') return undefined
    const timer = window.setTimeout(() => onClose?.(), ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [anim, onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [requestClose])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { ...baseParams, status, page, per_page: perPage }
      const { data } = await api.get('/grade-change-requests', { params })
      const list = data.data || []
      setRows(list)
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total ?? list.length,
        from: data.from || (list.length ? 1 : 0),
        to: data.to || list.length,
      })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load grade change requests.'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(baseParams), status, page, perPage])

  useEffect(() => {
    load()
  }, [load])

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-report-students-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <div className="wp-report-students-modal__head">
            <h2 id={titleId} className="wp-srm__title">{title}</h2>
            {contextLine ? <p className="wp-report-students-modal__context">{contextLine}</p> : null}
          </div>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="wp-srm__body">
          <div className="wp-flat__toolbar wp-report-students-modal__toolbar">
            <select
              className="form-select wp-flat__control"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <label className="wp-flat__records">
              Records
              <select
                className="form-select wp-flat__control"
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value))
                  setPage(1)
                }}
                aria-label="Rows per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="wp-report-students-modal__content">
            {loading ? (
              <div className="wp-report-students-modal__state">
                <WestPrimeLoader variant="inline" message="Loading change requests…" label="Loading" />
              </div>
            ) : (
              <div className="wp-flat__panel wp-report-students-modal__panel">
                <div className="table-responsive wp-report-students-modal__table-scroll">
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
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={9} className="wp-flat__empty">No grade change requests found.</td></tr>
                      ) : (
                        rows.map((r, idx) => {
                          const sp = r.grade?.enrollment_subject?.admission?.student_profile
                          const subjectCode = r.grade?.enrollment_subject?.class_section?.subject?.code
                          return (
                            <tr key={r.id}>
                              <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                              <td>
                                <button
                                  type="button"
                                  className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                                  onClick={() => setReviewRow(r)}
                                >
                                  View
                                </button>
                              </td>
                              <td>{r.requester?.name || '—'}</td>
                              <td>{studentName(sp)}</td>
                              <td>{subjectCode || '—'}</td>
                              <td>{PERIOD_LABEL[r.period_field] || r.period_field}</td>
                              <td>{fmtGrade(r.old_value)}</td>
                              <td>{fmtGrade(r.new_value)}</td>
                              <td><span className="wp-flat__status">{String(r.status || '—').toUpperCase()}</span></td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="wp-flat__footer wp-report-students-modal__panel-footer">
                  <span className="wp-flat__footer-meta">
                    {meta.total > 0
                      ? `Showing ${meta.from}–${meta.to} of ${meta.total} requests`
                      : '0 requests'}
                    {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
                  </span>
                  <FlatPager meta={meta} disabled={loading} onPageChange={setPage} />
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="wp-srm__footer wp-report-students-modal__footer">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={requestClose}>
            Close
          </button>
        </footer>
      </div>

      {reviewRow ? createPortal(
        <GradeChangeReviewModal request={reviewRow} onClose={() => setReviewRow(null)} readOnly />,
        document.body
      ) : null}
    </div>
  )
}
