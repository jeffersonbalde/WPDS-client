import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import FlatPager from '../common/FlatPager'
import WestPrimeLoader from '../common/WestPrimeLoader'
import StudentRecordModal from '../students/StudentRecordModal'
import { apiErrorMessage } from '../../utils/apiError'
import '../students/StudentRecordModal.css'
import '../../pages/StudentsManagePage.css'
import './StudentListModal.css'

const ANIM_MS = 220

export default function StudentListModal({ title, contextLine, fetchUrl, baseParams, columns, emptyMessage, onClose }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [viewStudentId, setViewStudentId] = useState(null)

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
      const params = { ...baseParams, page, per_page: perPage }
      if (debouncedSearch) params.search = debouncedSearch
      const { data } = await api.get(fetchUrl, { params })
      setRows(data.data || [])
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total || 0,
        from: data.from || 0,
        to: data.to || 0,
      })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load students.'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl, JSON.stringify(baseParams), page, perPage, debouncedSearch])

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
            <input
              type="search"
              className="form-control wp-flat__search"
              placeholder="Search student no., name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search students"
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
                <WestPrimeLoader variant="inline" message="Loading students…" label="Loading" />
              </div>
            ) : (
              <div className="wp-flat__panel wp-report-students-modal__panel">
                <div className="table-responsive wp-report-students-modal__table-scroll">
                  <table className="wp-flat__table">
                    <thead>
                      <tr>
                        <th className="wp-flat__num">#</th>
                        <th>Actions</th>
                        {columns.map((col) => <th key={col.key}>{col.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length + 2} className="wp-flat__empty">
                            {emptyMessage || 'No students found.'}
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, idx) => (
                          <tr key={row.student_id ? `${row.student_id}-${idx}` : idx}>
                            <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                            <td>
                              {row.student_id ? (
                                <button
                                  type="button"
                                  className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                                  onClick={() => setViewStudentId(row.student_id)}
                                >
                                  View
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            {columns.map((col) => (
                              <td key={col.key}>
                                {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="wp-flat__footer wp-report-students-modal__panel-footer">
                  <span className="wp-flat__footer-meta">
                    {meta.total > 0
                      ? `Showing ${meta.from}–${meta.to} of ${meta.total} students`
                      : '0 students'}
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

      {viewStudentId ? createPortal(
        <StudentRecordModal studentId={viewStudentId} onClose={() => setViewStudentId(null)} />,
        document.body
      ) : null}
    </div>
  )
}
