import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import FlatSearchSelect from '../components/common/FlatSearchSelect'
import PageLoadingRow from '../components/common/PageLoadingRow'
import SubmissionReviewModal from '../components/grade-submissions/SubmissionReviewModal'
import { apiErrorMessage } from '../utils/apiError'
import './StudentsManagePage.css'
import '../components/common/FlatSearchSelect.css'
import './GradeSubmissionsReviewPage.css'

const STATUS_TABS = [
  { value: 'pending', label: 'For review' },
  { value: 'released', label: 'Released' },
  { value: 'returned', label: 'Returned' },
  { value: 'all', label: 'All' },
]

function filterTermBySearch(term, query) {
  const name = String(term.name || '').toLowerCase()
  const year = String(term.school_year || '').toLowerCase()
  return name.includes(query) || year.includes(query)
}

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusText(value) {
  if (value === 'pending') return 'FOR REVIEW'
  return String(value || '—').toUpperCase()
}

export default function GradeSubmissionsReviewPage() {
  const [rows, setRows] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [status, setStatus] = useState('pending')
  const [terms, setTerms] = useState([])
  const [termFilter, setTermFilter] = useState('all')
  const [loadingTerms, setLoadingTerms] = useState(true)
  const [loading, setLoading] = useState(true)
  const [reviewId, setReviewId] = useState(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })

  useEffect(() => {
    let cancelled = false
    setLoadingTerms(true)
    api.get('/school-terms').then(({ data }) => {
      if (!cancelled) setTerms(Array.isArray(data) ? data : [])
    }).catch(() => {
      if (!cancelled) setTerms([])
    }).finally(() => {
      if (!cancelled) setLoadingTerms(false)
    })
    return () => { cancelled = true }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { status, page, per_page: perPage }
      if (termFilter !== 'all') params.school_term_id = termFilter
      const { data } = await api.get('/grade-submissions', { params })
      const list = data.data || []
      setRows(list)
      setPendingCount(data.summary?.pending ?? 0)
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total ?? list.length,
        from: data.from || (list.length ? 1 : 0),
        to: data.to || list.length,
      })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load grade submissions.'))
    } finally {
      setLoading(false)
    }
  }, [status, termFilter, page, perPage])

  useEffect(() => {
    load()
  }, [load])

  const termOptions = useMemo(() => terms, [terms])
  const pagerDisabled = loading

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Grade Submissions</h1>
          <p className="wp-flat__sub">
            Review the grades teachers submit per period. Release to make them visible to students, or
            return them to the teacher for correction.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
        </div>
      </div>

      <div className="wp-flat__stats" aria-label="Submission counts">
        <div className="wp-flat__stat wp-flat__stat--blue">
          <span className="wp-flat__stat-label">Awaiting review</span>
          <span className="wp-flat__stat-value">{pendingCount}</span>
        </div>
      </div>

      <div className="wp-flat__toolbar">
        <div className="wp-gsr__term-filter">
          <FlatSearchSelect
            allowEmpty
            emptyOptionLabel="All terms"
            options={termOptions}
            value={termFilter === 'all' ? '' : termFilter}
            onChange={(v) => {
              setTermFilter(v || 'all')
              setPage(1)
            }}
            disabled={loading}
            loading={loadingTerms}
            placeholder="All terms"
            searchPlaceholder="Search term or year"
            overlayPanel
            getValue={(t) => String(t.id)}
            getLabel={(t) => (t.is_active ? `${t.name} (active)` : t.name)}
            getMeta={(t) => t.school_year}
            filterBySearch={filterTermBySearch}
            countLabel="term"
          />
        </div>
        <select
          className="form-select wp-flat__control"
          value={status}
          disabled={loading}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
        >
          {STATUS_TABS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <label className="wp-flat__records">
          Records
          <select
            className="form-select wp-flat__control"
            value={perPage}
            disabled={pagerDisabled}
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

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table">
            <thead>
              <tr>
                <th className="wp-flat__num">#</th>
                <th>Actions</th>
                <th>Subject</th>
                <th>Section</th>
                <th>Term</th>
                <th>Teacher</th>
                <th>Period</th>
                <th>Students</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={10} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="wp-flat__empty">No submissions found.</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const cs = r.class_section || {}
                  return (
                    <tr key={r.id}>
                      <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                      <td>
                        <div className="wp-flat__actions">
                          <button
                            type="button"
                            className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                            onClick={() => setReviewId(r.id)}
                          >
                            {r.status === 'pending' ? 'Review' : 'View'}
                          </button>
                        </div>
                      </td>
                      <td>
                        {cs.subject?.code || '—'}
                        {cs.subject?.title ? <span className="wp-flat__subline">{cs.subject.title}</span> : null}
                      </td>
                      <td>{cs.section || '—'}</td>
                      <td>{cs.school_term?.name || '—'}</td>
                      <td>{cs.teacher?.name || r.submitter?.name || '—'}</td>
                      <td>{r.period_label || r.period}</td>
                      <td>{r.students_count ?? '—'}</td>
                      <td>{fmtDate(r.submitted_at)}</td>
                      <td><span className="wp-flat__status">{statusText(r.status)}</span></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="wp-flat__footer">
          <span className="wp-flat__footer-meta">
            {meta.total > 0
              ? `Showing ${meta.from}–${meta.to} of ${meta.total} submission${meta.total === 1 ? '' : 's'}`
              : '0 submissions'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={pagerDisabled} onPageChange={setPage} />
        </div>
      </div>

      {reviewId ? (
        <SubmissionReviewModal
          submissionId={reviewId}
          onClose={() => setReviewId(null)}
          onReviewed={() => {
            setReviewId(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
