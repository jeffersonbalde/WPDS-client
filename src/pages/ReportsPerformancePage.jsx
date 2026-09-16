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
import './ReportsPerformancePage.css'

function filterTermBySearch(term, query) {
  const name = String(term.name || '').toLowerCase()
  const year = String(term.school_year || '').toLowerCase()
  return name.includes(query) || year.includes(query)
}

function fmtAvg(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}

const PERFORMANCE_STUDENT_COLUMNS = [
  { key: 'student_no', label: 'Student No.' },
  { key: 'name', label: 'Name' },
  { key: 'program_code', label: 'Program' },
  { key: 'subject_code', label: 'Subject' },
  { key: 'final_grade', label: 'Final Grade', render: (value) => fmtAvg(value) },
  { key: 'remarks', label: 'Remarks' },
]

export default function ReportsPerformancePage() {
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
      const { data: payload } = await api.get('/reports/performance', { params })
      setData(payload)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load the performance report.'))
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
        url: '/reports/performance/export',
        params: termFilter ? { school_term_id: termFilter } : {},
        fallbackFilename: `performance-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Performance report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export the report.'))
    } finally {
      setExporting(false)
    }
  }

  const byProgram = data?.by_program || []
  const bySubject = data?.by_subject || []
  const byTeacher = data?.by_teacher || []
  const atRisk = data?.at_risk || []
  const resolvedTermId = data?.term?.id

  function viewStudents({ title, contextLine, dimension }) {
    if (!resolvedTermId) return
    setStudentsModal({
      title,
      contextLine,
      baseParams: { school_term_id: resolvedTermId, ...dimension },
    })
  }

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Academic Performance Report</h1>
          <p className="wp-flat__sub">
            Pass/fail counts and average final grade for all recorded grades in the selected term.
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
          <span className="wp-flat__stat-label">Graded</span>
          <span className="wp-flat__stat-value">{data?.total_graded ?? 0}</span>
        </div>
        <div className="wp-flat__stat wp-flat__stat--teal">
          <span className="wp-flat__stat-label">Passed</span>
          <span className="wp-flat__stat-value">{data?.passed ?? 0}</span>
        </div>
        <div className="wp-flat__stat" style={{ borderLeftColor: '#dc3545' }}>
          <span className="wp-flat__stat-label">Failed</span>
          <span className="wp-flat__stat-value">{data?.failed ?? 0}</span>
        </div>
      </div>

      <section className="wp-reports__section">
        <h2 className="wp-reports__section-title">By Program</h2>
        <div className="wp-flat__panel">
          <div className="table-responsive">
            <table className="wp-flat__table">
              <thead>
                <tr><th>Code</th><th>Program</th><th>Graded</th><th>Passed</th><th>Failed</th><th>Average</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <PageLoadingRow colSpan={7} message="Loading…" />
                ) : byProgram.length === 0 ? (
                  <tr><td colSpan={7} className="wp-flat__empty">No grades recorded for this term.</td></tr>
                ) : (
                  byProgram.map((r, i) => (
                    <tr key={i}>
                      <td>{r.program_code}</td><td>{r.program_name}</td><td>{r.total}</td>
                      <td>{r.passed}</td><td>{r.failed}</td><td>{fmtAvg(r.average)}</td>
                      <td>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => viewStudents({
                            title: 'Students',
                            contextLine: `${r.program_code} — ${r.program_name} · ${data?.term?.name || 'Active term'}`,
                            dimension: { program_id: r.program_id },
                          })}
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
      </section>

      <section className="wp-reports__section">
        <h2 className="wp-reports__section-title">By Subject</h2>
        <div className="wp-flat__panel">
          <div className="table-responsive">
            <table className="wp-flat__table">
              <thead>
                <tr><th>Code</th><th>Subject</th><th>Graded</th><th>Passed</th><th>Failed</th><th>Average</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <PageLoadingRow colSpan={7} message="Loading…" />
                ) : bySubject.length === 0 ? (
                  <tr><td colSpan={7} className="wp-flat__empty">No grades recorded for this term.</td></tr>
                ) : (
                  bySubject.map((r, i) => (
                    <tr key={i}>
                      <td>{r.subject_code}</td><td>{r.subject_title}</td><td>{r.total}</td>
                      <td>{r.passed}</td><td>{r.failed}</td><td>{fmtAvg(r.average)}</td>
                      <td>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => viewStudents({
                            title: 'Students',
                            contextLine: `${r.subject_code} — ${r.subject_title} · ${data?.term?.name || 'Active term'}`,
                            dimension: { subject_id: r.subject_id },
                          })}
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
      </section>

      <section className="wp-reports__section">
        <h2 className="wp-reports__section-title">By Teacher</h2>
        <div className="wp-flat__panel">
          <div className="table-responsive">
            <table className="wp-flat__table">
              <thead>
                <tr><th>Teacher</th><th>Graded</th><th>Passed</th><th>Failed</th><th>Average</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <PageLoadingRow colSpan={6} message="Loading…" />
                ) : byTeacher.length === 0 ? (
                  <tr><td colSpan={6} className="wp-flat__empty">No grades recorded for this term.</td></tr>
                ) : (
                  byTeacher.map((r, i) => (
                    <tr key={i}>
                      <td>{r.teacher_name}</td><td>{r.total}</td>
                      <td>{r.passed}</td><td>{r.failed}</td><td>{fmtAvg(r.average)}</td>
                      <td>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => viewStudents({
                            title: 'Students',
                            contextLine: `${r.teacher_name} · ${data?.term?.name || 'Active term'}`,
                            dimension: { teacher_id: r.teacher_id },
                          })}
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
      </section>

      <section className="wp-reports__section">
        <div className="wp-reports__section-head">
          <h2 className="wp-reports__section-title">
            At-Risk Students (Failed){data?.at_risk_total ? ` — ${data.at_risk_total}` : ''}
          </h2>
          {data?.at_risk_total ? (
            <button
              type="button"
              className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
              onClick={() => viewStudents({
                title: 'At-Risk Students (Failed)',
                contextLine: data?.term?.name || 'Active term',
                dimension: { status: 'failed' },
              })}
            >
              <FiUsers size={13} />
              View All
            </button>
          ) : null}
        </div>
        <div className="wp-flat__panel">
          <div className="table-responsive">
            <table className="wp-flat__table">
              <thead>
                <tr><th>Student No.</th><th>Name</th><th>Subject</th><th>Final Grade</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <PageLoadingRow colSpan={4} message="Loading…" />
                ) : atRisk.length === 0 ? (
                  <tr><td colSpan={4} className="wp-flat__empty">No failing grades for this term.</td></tr>
                ) : (
                  atRisk.map((r, i) => (
                    <tr key={i}>
                      <td>{r.student_no || '—'}</td><td>{r.name || '—'}</td>
                      <td>{r.subject_code || '—'}</td><td>{fmtAvg(r.final_grade)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {studentsModal ? (
        <StudentListModal
          title={studentsModal.title}
          contextLine={studentsModal.contextLine}
          fetchUrl="/reports/performance/students"
          baseParams={studentsModal.baseParams}
          columns={PERFORMANCE_STUDENT_COLUMNS}
          onClose={() => setStudentsModal(null)}
        />
      ) : null}
    </div>
  )
}
