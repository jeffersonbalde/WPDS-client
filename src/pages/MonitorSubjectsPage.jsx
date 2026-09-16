import { useCallback, useEffect, useState } from 'react'
import { FiRefreshCw, FiDownload } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import PageLoadingRow from '../components/common/PageLoadingRow'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import './StudentsManagePage.css'
import './SubjectsPage.css'

function levelValue(level) {
  if (level && typeof level === 'object' && level.value) return String(level.value)
  return String(level || '')
}

function levelLabel(level) {
  const v = levelValue(level)
  if (v === 'college') return 'COLLEGE'
  if (v === 'shs') return 'SHS'
  return v.toUpperCase() || '—'
}

export default function MonitorSubjectsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [summary, setSummary] = useState({ total: 0, college: 0, shs: 0, active: 0 })
  const [summaryReady, setSummaryReady] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const buildFilterParams = useCallback(() => {
    const params = {}
    if (debouncedSearch) params.search = debouncedSearch
    if (levelFilter !== 'all') params.academic_level = levelFilter
    if (statusFilter !== 'all') params.status = statusFilter
    return params
  }, [debouncedSearch, levelFilter, statusFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: perPage, ...buildFilterParams() }
      const { data } = await api.get('/subjects', { params })
      const list = Array.isArray(data) ? data : (data?.data || [])
      setRows(list)
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total ?? list.length,
        from: data.from || (list.length ? 1 : 0),
        to: data.to || list.length,
      })
      if (data.summary) {
        setSummary(data.summary)
        setSummaryReady(true)
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load subjects.'))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, buildFilterParams])

  useEffect(() => {
    load()
  }, [load])

  async function exportExcel() {
    setExporting(true)
    try {
      await downloadExcelExport({
        api,
        url: '/subjects/export',
        params: buildFilterParams(),
        fallbackFilename: `subjects-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Subject report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export subjects.'))
    } finally {
      setExporting(false)
    }
  }

  function setLevel(next) {
    setLevelFilter(next)
    setPage(1)
  }

  function onStatClick(next) {
    setLevel(levelFilter === next ? 'all' : next)
  }

  return (
    <div className="wp-flat wp-subj">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Directory — Subjects</h1>
          <p className="wp-flat__sub">
            Browse subjects offered in the curriculum.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading || exporting}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--export"
            onClick={exportExcel}
            disabled={exporting || loading}
          >
            <FiDownload size={15} />
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
        </div>
      </div>

      <div className="wp-flat__stats" aria-label="Subject counts">
        <button
          type="button"
          className={`wp-flat__stat${levelFilter === 'all' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          onClick={() => setLevel('all')}
        >
          <span className="wp-flat__stat-label">Total</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.total}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--blue${levelFilter === 'college' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          onClick={() => onStatClick('college')}
        >
          <span className="wp-flat__stat-label">College</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.college}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--teal${levelFilter === 'shs' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          onClick={() => onStatClick('shs')}
        >
          <span className="wp-flat__stat-label">Senior High</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.shs}</span>
          )}
        </button>
      </div>

      <div className="wp-flat__toolbar">
        <select
          className="form-select wp-flat__control"
          value={levelFilter}
          onChange={(e) => setLevel(e.target.value)}
          aria-label="Filter by level"
        >
          <option value="all">All levels</option>
          <option value="college">College</option>
          <option value="shs">Senior High</option>
        </select>
        <select
          className="form-select wp-flat__control"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <input
          type="search"
          className="form-control wp-flat__search"
          placeholder="Search code or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table">
            <thead>
              <tr>
                <th className="wp-flat__num">#</th>
                <th>Code</th>
                <th>Title</th>
                <th>Units</th>
                <th>Level</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={6} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="wp-flat__empty">No subjects found.</td></tr>
              ) : (
                rows.map((s, idx) => {
                  const active = s.is_active !== false
                  return (
                    <tr key={s.id}>
                      <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                      <td>{s.code}</td>
                      <td>{s.title}</td>
                      <td>{s.units}</td>
                      <td>{levelLabel(s.academic_level)}</td>
                      <td>
                        <span className="wp-flat__status">
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
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
              ? `Showing ${meta.from}–${meta.to} of ${meta.total}`
              : '0 records'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={loading} onPageChange={setPage} />
        </div>
      </div>
    </div>
  )
}
