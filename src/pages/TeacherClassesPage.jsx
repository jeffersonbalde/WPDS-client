import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import FlatSearchSelect from '../components/common/FlatSearchSelect'
import PageLoadingRow from '../components/common/PageLoadingRow'
import { apiErrorMessage } from '../utils/apiError'
import './StudentsManagePage.css'
import '../components/common/FlatSearchSelect.css'
import './TeacherClassesPage.css'

function filterTermBySearch(term, query) {
  const name = String(term.name || '').toLowerCase()
  const year = String(term.school_year || '').toLowerCase()
  return name.includes(query) || year.includes(query)
}

export default function TeacherClassesPage() {
  const [rows, setRows] = useState([])
  const [terms, setTerms] = useState([])
  const [termFilter, setTermFilter] = useState('all')
  const [defaultApplied, setDefaultApplied] = useState(false)
  const [loadingTerms, setLoadingTerms] = useState(true)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })

  useEffect(() => {
    let cancelled = false
    setLoadingTerms(true)
    api.get('/school-terms').then(({ data }) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setTerms(list)
      const active = list.find((t) => t.is_active)
      if (active) setTermFilter(String(active.id))
      setDefaultApplied(true)
    }).catch(() => {
      if (!cancelled) setDefaultApplied(true)
    }).finally(() => {
      if (!cancelled) setLoadingTerms(false)
    })
    return () => { cancelled = true }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: perPage }
      if (termFilter !== 'all') params.school_term_id = termFilter
      const { data } = await api.get('/class-sections', { params })
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
      toast.error(apiErrorMessage(err, 'Failed to load classes.'))
    } finally {
      setLoading(false)
    }
  }, [termFilter, page, perPage])

  useEffect(() => {
    if (!defaultApplied) return
    load()
  }, [defaultApplied, load])

  const termOptions = useMemo(() => terms, [terms])
  const pagerDisabled = loading

  return (
    <div className="wp-flat wp-tclass">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">My Classes</h1>
          <p className="wp-flat__sub">
            Open a class grade sheet to encode, save, or submit period grades.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
        </div>
      </div>

      <div className="wp-flat__toolbar">
        <div className="wp-tclass__term-filter">
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
            className="wp-tclass__term-select"
          />
        </div>
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
              {loading ? (
                <PageLoadingRow colSpan={9} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="wp-flat__empty">No classes assigned.</td></tr>
              ) : (
                rows.map((c, idx) => (
                  <tr key={c.id}>
                    <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                    <td>{c.subject?.code || '—'}</td>
                    <td>{c.subject?.title || '—'}</td>
                    <td>{c.school_term?.name || '—'}</td>
                    <td>{c.section || '—'}</td>
                    <td>
                      {[c.schedule_day, c.schedule_time].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td>{c.room || '—'}</td>
                    <td>{c.enrollment_subjects?.length ?? c.enrollment_subjects_count ?? 0}</td>
                    <td>
                      <div className="wp-flat__actions">
                        <Link
                          to={`/classes/${c.id}`}
                          className="wp-flat__btn wp-flat__btn--primary wp-flat__btn--sm"
                        >
                          Grade Sheet
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="wp-flat__footer">
          <span className="wp-flat__footer-meta">
            {meta.total > 0
              ? `Showing ${meta.from}–${meta.to} of ${meta.total} class${meta.total === 1 ? '' : 'es'}`
              : '0 classes'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={pagerDisabled} onPageChange={setPage} />
        </div>
      </div>
    </div>
  )
}
