import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { apiErrorMessage } from '../../utils/apiError'
import { wpConfirm } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import './SubmissionReviewModal.css'

const ANIM_MS = 220

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

export default function GradeChangeReviewModal({ request, onClose, onReviewed, readOnly = false }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const reviewedRef = useRef(false)
  const [anim, setAnim] = useState('enter')
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

  const sp = request?.grade?.enrollment_subject?.admission?.student_profile
  const subject = request?.grade?.enrollment_subject?.class_section?.subject
  const isPending = request?.status === 'pending' && !readOnly

  async function review(status) {
    if (busy) return
    if (status === 'rejected' && remarks.trim().length < 3) {
      toast.error('Add a short reason so the teacher knows why it was rejected.')
      return
    }

    const ok = await wpConfirm({
      icon: status === 'approved' ? 'question' : 'warning',
      title: status === 'approved' ? 'Approve grade change?' : 'Reject grade change?',
      text:
        status === 'approved'
          ? `The ${PERIOD_LABEL[request.period_field] || request.period_field} grade will be updated to ${fmtGrade(request.new_value)} and the final grade recomputed.`
          : 'The request will be rejected and the grade left unchanged.',
      confirmText: status === 'approved' ? 'Approve' : 'Reject',
      danger: status === 'rejected',
    })
    if (!ok || closingRef.current) return

    setBusy(true)
    try {
      await api.post(`/grade-change-requests/${request.id}/review`, {
        status,
        review_remarks: remarks.trim() || null,
      })
      toast.success(status === 'approved' ? 'Grade change approved.' : 'Grade change rejected.')
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
            <h2 id={titleId} className="wp-srm__title">Review grade change</h2>
            <p className="wp-sub-review__context">
              {subject?.code || ''} · {PERIOD_LABEL[request?.period_field] || request?.period_field} ·{' '}
              {studentName(sp)}
            </p>
          </div>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} disabled={busy} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="wp-srm__body">
          <div className="wp-sub-review__meta">
            <div><span>Teacher</span>{request?.requester?.name || '—'}</div>
            <div><span>Student</span>{studentName(sp)}</div>
            <div><span>Subject</span>{subject?.code || '—'}</div>
            <div><span>Period</span>{PERIOD_LABEL[request?.period_field] || request?.period_field}</div>
            <div><span>Old value</span>{fmtGrade(request?.old_value)}</div>
            <div><span>New value</span>{fmtGrade(request?.new_value)}</div>
          </div>

          <p className="wp-sub-review__prev-remark">
            <strong>Teacher's reason:</strong> {request?.reason || '—'}
          </p>

          {!isPending ? (
            <p className="wp-sub-review__prev-remark">
              <strong>Outcome:</strong> {String(request?.status || '').toUpperCase()}
              {request?.reviewer?.name ? ` by ${request.reviewer.name}` : ''}
              {request?.review_remarks ? ` — ${request.review_remarks}` : ''}
            </p>
          ) : (
            <label className="wp-sub-review__remarks">
              <span>Note to teacher {`(required when rejecting)`}</span>
              <textarea
                className="form-control"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
                placeholder="e.g. Approved — verified against the class record."
              />
            </label>
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
                onClick={() => review('rejected')}
                disabled={busy}
              >
                Reject
              </button>
              <button
                type="button"
                className="wp-srm__btn wp-srm__btn--primary"
                onClick={() => review('approved')}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Approve'}
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  )
}
