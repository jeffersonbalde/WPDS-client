import { useCallback, useEffect, useState } from 'react'
import { FiRefreshCw, FiDownload, FiUsers } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatSearchSelect from '../components/common/FlatSearchSelect'
import PageLoadingRow from '../components/common/PageLoadingRow'
import StudentListModal from '../components/reports/StudentListModal'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import '../components/common/FlatSearchSelect.css'
import './StudentsManagePage.css'

function filterTermBySearch(term, query) {
  const name = String(term.name || '').toLowerCase()
  const year = String(term.school_year || '').toLowerCase()
  return name.includes(query) || year.includes(query)
}

const POPULATION_STUDENT_COLUMNS = [
  { key: 'student_no', label: 'Student No.' },
  { key: 'name', label: 'Name' },
  { key: 'year_level', label: 'Year Level' },
  { key: 'status', label: 'Status', render: (value) => String(value || '—').toUpperCase() },
  { key: 'email', label: 'Email' },
]

export default function ReportsPopulationPage() {
  const [terms, setTerms] = useState([])
  const [loadingTerms, setLoadingTerms] = useState(true)
  const [termFilter, setTermFilter] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [studentsModal, setStudentsModal] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoadingTerms(true)
    api.get('/school-terms').then(({ data: rows }) => {
      if (!cancelled) setTerms(Array.isArray(rows) ? rows : [])
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingTerms(false)
    })
    return () => { cancelled = true }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = termFilter ? { school_term_id: termFilter } : {}
      const { data: payload } = await api.get('/reports/population', { params })
      setData(payload)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load the population report.'))
    } finally {
      setLoading(false)
    }
  }, [termFilter])

  useEffect(() => {
    load()
  }, [load])

  async function exportExcel() {
    setExporting(true)
    try {
      await downloadExcelExport({
        api,
        url: '/reports/population/export',
        params: termFilter ? { school_term_id: termFilter } : {},
        fallbackFilename: `population-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Population report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export the report.'))
    } finally {
      setExporting(false)
    }
  }

  const rows = data?.breakdown || []
  const byStatus = data?.by_status || {}
  const resolvedTermId = data?.term?.id

  function viewStudents(row) {
    if (!resolvedTermId) return
    setStudentsModal({
      title: 'Enrolled Students',
      contextLine: `${row.program_code} — ${row.program_name} · Year ${row.year_level} · ${data?.term?.name || 'Active term'}`,
      baseParams: {
        school_term_id: resolvedTermId,
        program_id: row.program_id,
        year_level: row.year_level,
      },
    })
  }

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Student Population Report</h1>
          <p className="wp-flat__sub">
            Admissions by program, level, and year for the selected term.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
          <button type="button" className="wp-flat__btn wp-flat__btn--export" onClick={exportExcel} disabled={exporting || loading}>
            <FiDownload size={15} />
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
        </div>
      </div>

      <div className="wp-flat__toolbar">
        <FlatSearchSelect
          allowEmpty
          emptyOptionLabel={data?.term ? `Active term (${data.term.name})` : 'Active term'}
          options={terms}
          value={termFilter}
          onChange={(v) => setTermFilter(v || '')}
          disabled={loading}
          loading={loadingTerms}
          placeholder="Active term"
          searchPlaceholder="Search term or school year"
          overlayPanel
          getValue={(t) => String(t.id)}
          getLabel={(t) => (t.is_active ? `${t.name} (active)` : t.name)}
          getMeta={(t) => t.school_year}
          filterBySearch={filterTermBySearch}
          countLabel="term"
        />
      </div>

      <div className="wp-flat__stats">
        <div className="wp-flat__stat wp-flat__stat--blue">
          <span className="wp-flat__stat-label">Total Admissions</span>
          <span className="wp-flat__stat-value">{data?.total ?? 0}</span>
        </div>
        <div className="wp-flat__stat wp-flat__stat--teal">
          <span className="wp-flat__stat-label">Active Accounts</span>
          <span className="wp-flat__stat-value">{data?.active_accounts ?? 0}</span>
        </div>
        <div className="wp-flat__stat">
          <span className="wp-flat__stat-label">Inactive Accounts</span>
          <span className="wp-flat__stat-value">{data?.inactive_accounts ?? 0}</span>
        </div>
      </div>

      <div className="wp-flat__stats">
        <div className="wp-flat__stat wp-flat__stat--blue">
          <span className="wp-flat__stat-label">Enrolled</span>
          <span className="wp-flat__stat-value">{byStatus.enrolled ?? 0}</span>
        </div>
        <div className="wp-flat__stat">
          <span className="wp-flat__stat-label">Completed</span>
          <span className="wp-flat__stat-value">{byStatus.completed ?? 0}</span>
        </div>
        <div className="wp-flat__stat">
          <span className="wp-flat__stat-label">Withdrawn</span>
          <span className="wp-flat__stat-value">{byStatus.withdrawn ?? 0}</span>
        </div>
      </div>

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Program Code</th>
                <th>Program Name</th>
                <th>Year Level</th>
                <th>Students</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={6} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="wp-flat__empty">No admissions for this term.</td></tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.level}</td>
                    <td>{row.program_code}</td>
                    <td>{row.program_name}</td>
                    <td>{row.year_level}</td>
                    <td>{row.total}</td>
                    <td>
                      <button
                        type="button"
                        className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                        onClick={() => viewStudents(row)}
                      >
                        <FiUsers size={13} />
                        View Students
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {studentsModal ? (
        <StudentListModal
          title={studentsModal.title}
          contextLine={studentsModal.contextLine}
          fetchUrl="/reports/population/students"
          baseParams={studentsModal.baseParams}
          columns={POPULATION_STUDENT_COLUMNS}
          onClose={() => setStudentsModal(null)}
        />
      ) : null}
    </div>
  )
}
