import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiRefreshCw, FiDownload } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import FlatSearchSelect from '../components/common/FlatSearchSelect'
import PageLoadingRow from '../components/common/PageLoadingRow'
import StudentRecordModal from '../components/students/StudentRecordModal'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import { majorLabel } from '../utils/program'
import '../components/common/FlatSearchSelect.css'
import './StudentsManagePage.css'

function filterProgramBySearch(program, query) {
  const code = String(program.code || '').toLowerCase()
  const name = String(program.name || '').toLowerCase()
  return code.includes(query) || name.includes(query)
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

function displayName(s) {
  const last = s.last_name || ''
  const first = s.first_name || ''
  const middle = s.middle_name ? ` ${s.middle_name}` : ''
  return `${last}, ${first}${middle}`.trim()
}

export default function MonitorStudentsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [programFilter, setProgramFilter] = useState('all')
  const [programs, setPrograms] = useState([])
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [summary, setSummary] = useState({ total: 0, college: 0, shs: 0 })
  const [summaryReady, setSummaryReady] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [viewStudentId, setViewStudentId] = useState(null)

  const buildFilterParams = useCallback(() => {
    const params = {}
    if (debouncedSearch) params.search = debouncedSearch
    if (levelFilter !== 'all') params.academic_level = levelFilter
    if (programFilter !== 'all') params.program_id = programFilter
    return params
  }, [debouncedSearch, levelFilter, programFilter])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    async function loadPrograms() {
      try {
        const { data } = await api.get('/programs')
        if (!cancelled) setPrograms(Array.isArray(data) ? data : data?.data || [])
      } catch {
        /* optional */
      }
    }
    loadPrograms()
    return () => { cancelled = true }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: perPage, ...buildFilterParams() }
      const { data } = await api.get('/students', { params })
      setRows(data.data || [])
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total || 0,
        from: data.from || 0,
        to: data.to || 0,
      })
      if (data.summary) {
        setSummary(data.summary)
        setSummaryReady(true)
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load students.'))
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
        url: '/students/export',
        params: buildFilterParams(),
        fallbackFilename: `students-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Student report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export students.'))
    } finally {
      setExporting(false)
    }
  }

  const filteredPrograms = useMemo(() => {
    if (levelFilter === 'all') return programs
    return programs.filter((p) => levelValue(p.academic_level) === levelFilter)
  }, [programs, levelFilter])

  useEffect(() => {
    if (programFilter === 'all') return
    const stillVisible = filteredPrograms.some((p) => String(p.id) === String(programFilter))
    if (!stillVisible) {
      setProgramFilter('all')
      setPage(1)
    }
  }, [filteredPrograms, programFilter])

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Directory — Students</h1>
          <p className="wp-flat__sub">
            Browse student records and view details.
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

      <div className="wp-flat__stats" aria-label="Student counts">
        <div className={`wp-flat__stat${!summaryReady ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Total</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.total}</span>
          )}
        </div>
        <div className={`wp-flat__stat wp-flat__stat--blue${!summaryReady ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">College</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.college}</span>
          )}
        </div>
        <div className={`wp-flat__stat wp-flat__stat--teal${!summaryReady ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Senior High</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.shs}</span>
          )}
        </div>
      </div>

      <div className="wp-flat__toolbar">
        <select
          className="form-select wp-flat__control"
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by level"
        >
          <option value="all">All levels</option>
          <option value="college">College</option>
          <option value="shs">Senior High</option>
        </select>
        <div className="wp-students__program-filter">
          <FlatSearchSelect
            allowEmpty
            emptyOptionLabel="All programs"
            options={filteredPrograms}
            value={programFilter === 'all' ? '' : programFilter}
            onChange={(v) => {
              setProgramFilter(v || 'all')
              setPage(1)
            }}
            disabled={loading}
            placeholder="All programs"
            searchPlaceholder="Search code or name…"
            overlayPanel
            getValue={(p) => p.id}
            getLabel={(p) => p.code}
            getMeta={(p) => p.name}
            filterBySearch={filterProgramBySearch}
            countLabel="program"
            className="wp-students__program-select"
          />
        </div>
        <input
          type="search"
          className="form-control wp-flat__search"
          placeholder="Search student no., name, or email…"
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
                <th>Actions</th>
                <th>Student No.</th>
                <th>Name</th>
                <th>Level</th>
                <th>Program</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={7} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="wp-flat__empty">No students found.</td></tr>
              ) : (
                rows.map((s, idx) => {
                  const programLabel = s.program?.code
                    ? (s.program.name ? `${s.program.code} — ${s.program.name}` : s.program.code)
                    : '—'
                  return (
                    <tr key={s.id}>
                      <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                      <td>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => setViewStudentId(s.id)}
                        >
                          View Record
                        </button>
                      </td>
                      <td>{s.student_no || '—'}</td>
                      <td>{displayName(s) || '—'}</td>
                      <td>{levelLabel(s.academic_level)}</td>
                      <td title={programLabel !== '—' ? programLabel : undefined}>
                        {s.program?.code || '—'}
                        {s.program_major ? (
                          <span className="wp-flat__subline">{majorLabel(s.program_major)}</span>
                        ) : null}
                      </td>
                      <td>{s.contact_email || '—'}</td>
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

      {viewStudentId ? (
        <StudentRecordModal studentId={viewStudentId} onClose={() => setViewStudentId(null)} />
      ) : null}
    </div>
  )
}
