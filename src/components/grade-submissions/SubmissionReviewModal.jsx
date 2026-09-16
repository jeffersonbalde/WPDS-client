import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import WestPrimeLoader from '../common/WestPrimeLoader'
import { apiErrorMessage } from '../../utils/apiError'
import { wpConfirm } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import '../../pages/StudentsManagePage.css'
import './SubmissionReviewModal.css'

const ANIM_MS = 220

function fmtGrade(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : String(value)
}

function lineValue(primary, secondary) {
  const left = String(primary || '').trim()
  const right = String(secondary || '').trim()
  if (left && right) return `${left} · ${right}`
  return left || right || '—'
}

export default function SubmissionReviewModal({ submissionId, onClose, onReviewed, readOnly = false }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const reviewedRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  const beginLeave = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnim('leave')
  }, [])

  const requestClose = useCallback(() => {
    if (busy || closingRef.current) return
    beginLeave()
  }, [busy, beginLeave])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnim('open'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (anim !== 'leave') return undefined
    const timer = window.setTimeout(() => {
      if (reviewedRef.current) onReviewed?.()
      else onClose?.()
    }, ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [anim, onClose, onReviewed])

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
    if (!submissionId) return undefined
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const { data } = await api.get(`/grade-submissions/${submissionId}`)
        if (!cancelled) setPayload(data)
      } catch (err) {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, 'Failed to load the submission.'))
          beginLeave()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [submissionId, beginLeave])

  const submission = payload?.submission
  const rows = payload?.rows || []
  const isPending = submission?.status === 'pending' && !readOnly
  const cs = submission?.class_section || {}

  async function review(action) {
    if (busy) return
    if (action === 'returned' && remarks.trim().length < 3) {
      toast.error('Add a short note so the teacher knows what to correct.')
      return
    }

    const label = submission?.period_label || submission?.period
    const ok = await wpConfirm({
      icon: action === 'released' ? 'question' : 'warning',
      title: action === 'released' ? `Release ${label} grades?` : `Return ${label} grades?`,
      text:
        action === 'released'
          ? `${label} grades for ${cs.subject?.code || 'this class'} will become visible to the students.`
          : `${label} grades will be sent back to ${cs.teacher?.name || 'the teacher'} for correction.`,
      confirmText: action === 'released' ? 'Release' : 'Return',
      danger: action === 'returned',
    })
    if (!ok || closingRef.current) return

    setBusy(true)
    try {
      await api.post(`/grade-submissions/${submissionId}/review`, {
        action,
        review_remarks: remarks.trim() || null,
      })
      toast.success(action === 'released' ? 'Grades released to students.' : 'Grades returned to the teacher.')
      reviewedRef.current = true
      beginLeave()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to submit the review.'))
    } finally {
      setBusy(false)
    }
  }

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-sub-review${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <div>
            <h2 id={titleId} className="wp-srm__title">Review grade submission</h2>
            <p className="wp-sub-review__context">
              {loading
                ? 'Loading…'
                : `${cs.subject?.code || ''} · ${submission?.period_label || ''} · Section ${cs.section || '—'}`}
            </p>
          </div>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} disabled={busy} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="wp-srm__body">
          {loading ? (
            <div className="wp-sub-review__state">
              <WestPrimeLoader variant="inline" message="Loading submission…" label="Loading" />
            </div>
          ) : (
            <>
              <div className="wp-sub-review__meta">
                <div><span>Subject</span>{lineValue(cs.subject?.code, cs.subject?.title)}</div>
                <div><span>Term</span>{cs.school_term?.name || '—'}</div>
                <div><span>Teacher</span>{cs.teacher?.name || submission?.submitter?.name || '—'}</div>
                <div><span>Period</span>{submission?.period_label || '—'}</div>
                <div><span>Status</span>{String(submission?.status || '—').toUpperCase()}</div>
                <div><span>Students</span>{rows.length}</div>
              </div>

              {submission?.review_remarks && !isPending ? (
                <p className="wp-sub-review__prev-remark">
                  <strong>Registrar note:</strong> {submission.review_remarks}
                </p>
              ) : null}

              <div className="wp-flat__panel wp-sub-review__table-panel">
                <div className="table-responsive wp-sub-review__table-scroll">
                  <table className="wp-flat__table">
                    <thead>
                      <tr>
                        <th className="wp-flat__num">#</th>
                        <th>Student No.</th>
                        <th>Name</th>
                        <th>{submission?.period_label || 'Grade'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={4} className="wp-flat__empty">No students in this section.</td></tr>
                      ) : (
                        rows.map((row, idx) => (
                          <tr key={`${row.student_no || idx}`}>
                            <td className="wp-flat__num">{idx + 1}</td>
                            <td>{row.student_no || '—'}</td>
                            <td>{row.name || '—'}</td>
                            <td>{fmtGrade(row.value)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {isPending ? (
                <label className="wp-sub-review__remarks">
                  <span>Note to teacher {`(required only when returning)`}</span>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={busy}
                    placeholder="e.g. Prelim grade for two students looks transposed — please recheck."
                  />
                </label>
              ) : null}
            </>
          )}
        </div>

        <footer className="wp-srm__footer wp-sub-review__foot">
          <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={busy}>
            Close
          </button>
          {isPending ? (
            <>
              <button
                type="button"
                className="wp-srm__btn wp-sub-review__btn-return"
                onClick={() => review('returned')}
                disabled={busy}
              >
                Return to teacher
              </button>
              <button
                type="button"
                className="wp-srm__btn wp-srm__btn--primary"
                onClick={() => review('released')}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Release to students'}
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  )
}
