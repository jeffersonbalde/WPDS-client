import { useCallback, useEffect, useState } from 'react'
import { FiRefreshCw, FiDownload, FiEye } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatSearchSelect from '../components/common/FlatSearchSelect'
import PageLoadingRow from '../components/common/PageLoadingRow'
import GradeSubmissionsListModal from '../components/reports/GradeSubmissionsListModal'
import GradeChangeRequestsListModal from '../components/reports/GradeChangeRequestsListModal'
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

export default function ReportsGradeOperationsPage() {
  const [terms, setTerms] = useState([])
  const [loadingTerms, setLoadingTerms] = useState(true)
  const [termFilter, setTermFilter] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [submissionsModal, setSubmissionsModal] = useState(null)
  const [changeRequestsModal, setChangeRequestsModal] = useState(null)

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
      const { data: payload } = await api.get('/reports/grade-operations', { params })
      setData(payload)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load the grade operations report.'))
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
        url: '/reports/grade-operations/export',
        params: termFilter ? { school_term_id: termFilter } : {},
        fallbackFilename: `grade-operations-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Grade operations report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export the report.'))
    } finally {
      setExporting(false)
    }
  }

  const subs = data?.submissions_by_status || {}
  const changes = data?.change_requests_by_status || {}
  const byTeacher = data?.submissions_by_teacher || []
  const resolvedTermId = data?.term?.id
  const termLabel = data?.term?.name || 'Active term'

  function viewSubmissions(status, teacher) {
    if (!resolvedTermId) return
    setSubmissionsModal({
      title: teacher ? `Submissions — ${teacher.name}` : 'Grade Submissions',
      contextLine: termLabel,
      initialStatus: status,
      baseParams: {
        school_term_id: resolvedTermId,
        ...(teacher ? { teacher_id: teacher.id } : {}),
      },
    })
  }

  function viewChangeRequests(status) {
    if (!resolvedTermId) return
    setChangeRequestsModal({
      title: 'Grade Change Requests',
      contextLine: termLabel,
      initialStatus: status,
      baseParams: { school_term_id: resolvedTermId },
    })
  }

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Grade Operations Report</h1>
          <p className="wp-flat__sub">
            Grade submissions and change requests for the selected term.
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

      <section className="wp-reports__section">
        <h2 className="wp-reports__section-title">Grade Submissions</h2>
        <div className="wp-flat__stats">
          <button
            type="button"
            className="wp-flat__stat wp-reports__stat-btn"
            style={{ borderLeftColor: '#997404' }}
            onClick={() => viewSubmissions('pending')}
            disabled={!resolvedTermId}
          >
            <span className="wp-flat__stat-label">Pending Review</span>
            <span className="wp-flat__stat-value">{subs.pending ?? 0}</span>
          </button>
          <button
            type="button"
            className="wp-flat__stat wp-flat__stat--teal wp-reports__stat-btn"
            onClick={() => viewSubmissions('released')}
            disabled={!resolvedTermId}
          >
            <span className="wp-flat__stat-label">Released</span>
            <span className="wp-flat__stat-value">{subs.released ?? 0}</span>
          </button>
          <button
            type="button"
            className="wp-flat__stat wp-reports__stat-btn"
            style={{ borderLeftColor: '#dc3545' }}
            onClick={() => viewSubmissions('returned')}
            disabled={!resolvedTermId}
          >
            <span className="wp-flat__stat-label">Returned</span>
            <span className="wp-flat__stat-value">{subs.returned ?? 0}</span>
          </button>
        </div>
      </section>

      <section className="wp-reports__section">
        <h2 className="wp-reports__section-title">Grade Change Requests</h2>
        <div className="wp-flat__stats">
          <button
            type="button"
            className="wp-flat__stat wp-reports__stat-btn"
            style={{ borderLeftColor: '#997404' }}
            onClick={() => viewChangeRequests('pending')}
            disabled={!resolvedTermId}
          >
            <span className="wp-flat__stat-label">Pending</span>
            <span className="wp-flat__stat-value">{changes.pending ?? 0}</span>
          </button>
          <button
            type="button"
            className="wp-flat__stat wp-flat__stat--teal wp-reports__stat-btn"
            onClick={() => viewChangeRequests('approved')}
            disabled={!resolvedTermId}
          >
            <span className="wp-flat__stat-label">Approved</span>
            <span className="wp-flat__stat-value">{changes.approved ?? 0}</span>
          </button>
          <button
            type="button"
            className="wp-flat__stat wp-reports__stat-btn"
            style={{ borderLeftColor: '#dc3545' }}
            onClick={() => viewChangeRequests('rejected')}
            disabled={!resolvedTermId}
          >
            <span className="wp-flat__stat-label">Rejected</span>
            <span className="wp-flat__stat-value">{changes.rejected ?? 0}</span>
          </button>
        </div>
      </section>

      <section className="wp-reports__section">
        <h2 className="wp-reports__section-title">Submissions by Teacher</h2>
        <div className="wp-flat__panel">
          <div className="table-responsive">
            <table className="wp-flat__table">
              <thead>
                <tr><th>Teacher</th><th>Pending</th><th>Returned</th><th>Released</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <PageLoadingRow colSpan={5} message="Loading…" />
                ) : byTeacher.length === 0 ? (
                  <tr><td colSpan={5} className="wp-flat__empty">No submissions for this term.</td></tr>
                ) : (
                  byTeacher.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td><td>{r.pending}</td><td>{r.returned}</td><td>{r.released}</td>
                      <td>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => viewSubmissions('all', r)}
                        >
                          <FiEye size={13} />
                          View
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

      {submissionsModal ? (
        <GradeSubmissionsListModal
          title={submissionsModal.title}
          contextLine={submissionsModal.contextLine}
          baseParams={submissionsModal.baseParams}
          initialStatus={submissionsModal.initialStatus}
          onClose={() => setSubmissionsModal(null)}
        />
      ) : null}

      {changeRequestsModal ? (
        <GradeChangeRequestsListModal
          title={changeRequestsModal.title}
          contextLine={changeRequestsModal.contextLine}
          baseParams={changeRequestsModal.baseParams}
          initialStatus={changeRequestsModal.initialStatus}
          onClose={() => setChangeRequestsModal(null)}
        />
      ) : null}
    </div>
  )
}
