import { useCallback, useEffect, useState } from 'react'
import { FiRefreshCw, FiDownload } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import PageLoadingRow from '../components/common/PageLoadingRow'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import { majorsFullText } from '../utils/program'
import './StudentsManagePage.css'
import './ProgramsPage.css'

const TRACK_LABELS = {
  academic: 'Academic',
  tvl: 'TVL',
  degree: 'Degree',
  associate: 'Associate',
}

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

export default function MonitorProgramsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [trackFilter, setTrackFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [summary, setSummary] = useState({ total: 0, college: 0, shs: 0 })
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
    if (trackFilter !== 'all') params.track_type = trackFilter
    if (statusFilter !== 'all') params.status = statusFilter
    return params
  }, [debouncedSearch, levelFilter, trackFilter, statusFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: perPage, ...buildFilterParams() }
      const { data } = await api.get('/programs', { params })
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
      toast.error(apiErrorMessage(err, 'Failed to load programs.'))
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
        url: '/programs/export',
        params: buildFilterParams(),
        fallbackFilename: `programs-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Program report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export programs.'))
    } finally {
      setExporting(false)
    }
  }

  function setLevel(next) {
    setLevelFilter(next)
    setTrackFilter('all')
    setPage(1)
  }

  function onStatClick(next) {
    setLevel(levelFilter === next ? 'all' : next)
  }

  const trackOptions = levelFilter === 'shs'
    ? [['academic', 'Academic'], ['tvl', 'TVL']]
    : levelFilter === 'college'
      ? [['degree', 'Degree'], ['associate', 'Associate']]
      : [['degree', 'Degree'], ['associate', 'Associate'], ['academic', 'Academic'], ['tvl', 'TVL']]

  return (
    <div className="wp-flat wp-prog">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Directory — Programs</h1>
          <p className="wp-flat__sub">
            Browse programs and majors.
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

      <div className="wp-flat__stats" aria-label="Program counts">
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
          value={trackFilter}
          onChange={(e) => {
            setTrackFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by track"
        >
          <option value="all">{levelFilter === 'college' ? 'All program types' : 'All tracks'}</option>
          {trackOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
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
          placeholder="Search code, name, or major…"
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
                <th>Name</th>
                <th>Majors</th>
                <th>Level</th>
                <th>Track</th>
                <th>Years</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={8} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="wp-flat__empty">No programs found.</td></tr>
              ) : (
                rows.map((p, idx) => {
                  const active = p.is_active !== false
                  const majors = majorsFullText(p)
                  return (
                    <tr key={p.id}>
                      <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                      <td>{p.code}</td>
                      <td>{p.name}</td>
                      <td>{majors}</td>
                      <td>{levelLabel(p.academic_level)}</td>
                      <td>{TRACK_LABELS[p.track_type] || p.track_type || '—'}</td>
                      <td>{p.duration_years ?? '—'}</td>
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
