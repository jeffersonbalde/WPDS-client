import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import FlatPager from '../common/FlatPager'
import WestPrimeLoader from '../common/WestPrimeLoader'
import SubmissionReviewModal from '../grade-submissions/SubmissionReviewModal'
import { apiErrorMessage } from '../../utils/apiError'
import '../students/StudentRecordModal.css'
import '../../pages/StudentsManagePage.css'
import './StudentListModal.css'

const ANIM_MS = 220

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending review' },
  { value: 'released', label: 'Released' },
  { value: 'returned', label: 'Returned' },
]

function statusLabel(value) {
  if (value === 'pending') return 'PENDING REVIEW'
  return String(value || '—').toUpperCase()
}

export default function GradeSubmissionsListModal({ title, contextLine, baseParams, initialStatus = 'all', onClose }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState(initialStatus)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [submissionId, setSubmissionId] = useState(null)

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

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { ...baseParams, status, page, per_page: perPage }
      if (debouncedSearch) params.search = debouncedSearch
      const { data } = await api.get('/grade-submissions', { params })
      setRows(data.data || [])
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total || 0,
        from: data.from || 0,
        to: data.to || 0,
      })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load grade submissions.'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(baseParams), status, page, perPage, debouncedSearch])

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
            <input
              type="search"
              className="form-control wp-flat__search"
              placeholder="Search subject or section…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search submissions"
            />
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
                <WestPrimeLoader variant="inline" message="Loading submissions…" label="Loading" />
              </div>
            ) : (
              <div className="wp-flat__panel wp-report-students-modal__panel">
                <div className="table-responsive wp-report-students-modal__table-scroll">
                  <table className="wp-flat__table">
                    <thead>
                      <tr>
                        <th className="wp-flat__num">#</th>
                        <th>Actions</th>
                        <th>Subject</th>
                        <th>Section</th>
                        <th>Teacher</th>
                        <th>Period</th>
                        <th>Students</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={8} className="wp-flat__empty">No submissions found.</td></tr>
                      ) : (
                        rows.map((row, idx) => (
                          <tr key={row.id}>
                            <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                            <td>
                              <button
                                type="button"
                                className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                                onClick={() => setSubmissionId(row.id)}
                              >
                                View
                              </button>
                            </td>
                            <td>{row.class_section?.subject?.code || '—'}</td>
                            <td>{row.class_section?.section || '—'}</td>
                            <td>{row.class_section?.teacher?.name || '—'}</td>
                            <td>{row.period_label || row.period}</td>
                            <td>{row.students_count ?? 0}</td>
                            <td><span className="wp-flat__status">{statusLabel(row.status)}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="wp-flat__footer wp-report-students-modal__panel-footer">
                  <span className="wp-flat__footer-meta">
                    {meta.total > 0
                      ? `Showing ${meta.from}–${meta.to} of ${meta.total} submissions`
                      : '0 submissions'}
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

      {submissionId ? createPortal(
        <SubmissionReviewModal submissionId={submissionId} onClose={() => setSubmissionId(null)} readOnly />,
        document.body
      ) : null}
    </div>
  )
}
