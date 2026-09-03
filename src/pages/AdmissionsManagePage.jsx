import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiDownload, FiPlus, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatSearchSelect from '../components/common/FlatSearchSelect'
import '../components/common/FlatSearchSelect.css'
import FlatPager from '../components/common/FlatPager'
import PageLoadingRow from '../components/common/PageLoadingRow'
import AdmissionStatusModal from '../components/admissions/AdmissionStatusModal'
import AdmissionViewModal from '../components/admissions/AdmissionViewModal'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import { majorLabel } from '../utils/program'
import { wpAlert, wpConfirm } from '../utils/wpSwal'
import './StudentsManagePage.css'
import './AdmissionsManagePage.css'

function statusLabel(value) {
  if (!value) return '—'
  const s = String(value)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function filterTermBySearch(term, query) {
  const name = String(term.name || '').toLowerCase()
  const year = String(term.school_year || '').toLowerCase()
  return name.includes(query) || year.includes(query)
}

function admissionLabelHtml(admission) {
  const number = escapeHtml(admission?.admission_number || '—')
  const profile = admission?.student_profile
  const name = profile
    ? escapeHtml(`${profile.last_name || ''}, ${profile.first_name || ''}`.trim())
    : '—'
  const studentNo = profile?.student_no ? ` · ${escapeHtml(profile.student_no)}` : ''
  return `<strong>${number}</strong> — ${name}${studentNo}`
}

export default function AdmissionsManagePage() {
  const [terms, setTerms] = useState([])
  const [loadingTerms, setLoadingTerms] = useState(true)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [termFilter, setTermFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [summary, setSummary] = useState({ total: 0, enrolled: 0, withdrawn: 0, completed: 0 })
  const [summaryReady, setSummaryReady] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [statusAdmission, setStatusAdmission] = useState(null)
  const [viewAdmissionId, setViewAdmissionId] = useState(null)

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
    if (termFilter !== 'all') params.school_term_id = termFilter
    if (statusFilter !== 'all') params.status = statusFilter
    return params
  }, [debouncedSearch, termFilter, statusFilter])

  const loadSummary = useCallback(async () => {
    try {
      const [allRes, enrolledRes, withdrawnRes, completedRes] = await Promise.all([
        api.get('/admissions', { params: { per_page: 1 } }),
        api.get('/admissions', { params: { per_page: 1, status: 'enrolled' } }),
        api.get('/admissions', { params: { per_page: 1, status: 'withdrawn' } }),
        api.get('/admissions', { params: { per_page: 1, status: 'completed' } }),
      ])
      setSummary({
        total: allRes.data?.total ?? 0,
        enrolled: enrolledRes.data?.total ?? 0,
        withdrawn: withdrawnRes.data?.total ?? 0,
        completed: completedRes.data?.total ?? 0,
      })
      setSummaryReady(true)
    } catch {
      setSummaryReady(true)
    }
  }, [])

  const loadTerms = useCallback(async () => {
    setLoadingTerms(true)
    try {
      const { data } = await api.get('/school-terms')
      const list = Array.isArray(data) ? data : (data?.data || [])
      setTerms(list)
    } catch {
      setTerms([])
    } finally {
      setLoadingTerms(false)
    }
  }, [])

  const termFilterOptions = useMemo(() => terms, [terms])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        per_page: perPage,
        ...buildFilterParams(),
      }
      const { data } = await api.get('/admissions', { params })
      const list = data.data || data || []
      setRows(Array.isArray(list) ? list : [])
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total ?? list.length,
        from: data.from || (list.length ? 1 : 0),
        to: data.to || list.length,
      })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load admissions.'))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, buildFilterParams])

  useEffect(() => {
    loadTerms()
    loadSummary()
  }, [loadTerms, loadSummary])

  useEffect(() => {
    load()
  }, [load])

  function refreshAll() {
    loadSummary()
    load()
  }

  async function exportExcel() {
    setExporting(true)
    try {
      await downloadExcelExport({
        api,
        url: '/admissions/export',
        params: buildFilterParams(),
        fallbackFilename: `admissions-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Admissions report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export admissions.'))
    } finally {
      setExporting(false)
    }
  }

  async function deleteAdmission(admission) {
    if (!admission?.id || deletingId) return

    const label = admissionLabelHtml(admission)
    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Delete this admission?',
      html: `
        <div class="wp-swal__detail">
          <p class="wp-swal__detail-lead">${label} will be permanently removed, including any enrolled subjects with no grades yet.</p>
          <p class="wp-swal__detail-note">If grades were already encoded, deletion will be blocked — use Status → Withdrawn instead.</p>
        </div>
      `,
      confirmText: 'Delete admission',
      danger: true,
    })
    if (!ok) return

    setDeletingId(admission.id)
    try {
      await api.delete(`/admissions/${admission.id}`)
      toast.success('Admission deleted.')
      refreshAll()
    } catch (err) {
      const usage = err?.response?.data?.usage
      if (usage && usage.can_delete === false) {
        await wpAlert({
          icon: 'error',
          title: 'This admission cannot be deleted',
          html: `
            <div class="wp-swal__detail">
              <p class="wp-swal__detail-lead">${label} already has recorded grades. Academic history must stay intact.</p>
              <p class="wp-swal__detail-note">Use <strong>Status → Withdrawn</strong> instead of deleting.</p>
            </div>
          `,
          confirmText: 'OK',
        })
      } else {
        toast.error(apiErrorMessage(err, 'Failed to delete admission.'))
      }
    } finally {
      setDeletingId(null)
    }
  }

  function setStatus(next) {
    if (next === 'all') {
      setStatusFilter('all')
    } else {
      setStatusFilter((prev) => (prev === next ? 'all' : next))
    }
    setPage(1)
  }

  const pagerDisabled = loading || exporting || Boolean(deletingId) || Boolean(statusAdmission) || Boolean(viewAdmissionId)

  return (
    <div className="wp-flat wp-adm">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Admissions</h1>
          <p className="wp-flat__sub">
            View and manage student admissions by school term.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--secondary"
            onClick={refreshAll}
            disabled={loading || exporting}
          >
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
          <Link to="/admissions-manage/new" className="wp-flat__btn wp-flat__btn--primary">
            <FiPlus size={16} />
            Create Admission
          </Link>
        </div>
      </div>

      <div className="wp-flat__stats" aria-label="Admission counts">
        <button
          type="button"
          className={`wp-flat__stat${statusFilter === 'all' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show all admissions"
          onClick={() => setStatus('all')}
        >
          <span className="wp-flat__stat-label">All admissions</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.total}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--blue${statusFilter === 'enrolled' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show enrolled admissions"
          onClick={() => setStatus('enrolled')}
        >
          <span className="wp-flat__stat-label">Enrolled</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.enrolled}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--teal${statusFilter === 'withdrawn' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show withdrawn admissions"
          onClick={() => setStatus('withdrawn')}
        >
          <span className="wp-flat__stat-label">Withdrawn</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.withdrawn}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--slate${statusFilter === 'completed' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show completed admissions"
          onClick={() => setStatus('completed')}
        >
          <span className="wp-flat__stat-label">Completed</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.completed}</span>
          )}
        </button>
      </div>

      <div className="wp-flat__toolbar">
        <div className="wp-adm__term-filter">
          <FlatSearchSelect
            allowEmpty
            emptyOptionLabel="All terms"
            loading={loadingTerms}
            options={termFilterOptions}
            value={termFilter === 'all' ? '' : termFilter}
            onChange={(v) => {
              setTermFilter(v || 'all')
              setPage(1)
            }}
            disabled={pagerDisabled}
            placeholder="All terms"
            searchPlaceholder="Search term or school year"
            overlayPanel
            getValue={(t) => t.id}
            getLabel={(t) => t.name}
            getMeta={(t) => t.school_year}
            filterBySearch={filterTermBySearch}
            countLabel="term"
          />
        </div>
        <select
          className="form-select wp-flat__control wp-adm__status-filter"
          value={statusFilter}
          disabled={pagerDisabled}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="enrolled">Enrolled</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="completed">Completed</option>
        </select>
        <input
          type="search"
          className="form-control wp-flat__search"
          placeholder="Search admission no., student, or program…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search admissions"
        />
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
                <th>Admission #</th>
                <th>Student</th>
                <th>Term</th>
                <th>Program</th>
                <th>Major</th>
                <th>Year</th>
                <th>Section</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={10} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="wp-flat__empty">
                    No admissions found. Add a student first, then create an admission.
                  </td>
                </tr>
              ) : (
                rows.map((a, idx) => (
                  <tr key={a.id}>
                    <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                    <td>
                      <div className="wp-flat__actions">
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--edit wp-flat__btn--sm"
                          onClick={() => setStatusAdmission(a)}
                          disabled={Boolean(deletingId)}
                        >
                          Status
                        </button>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => setViewAdmissionId(a.id)}
                          disabled={Boolean(deletingId)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                          onClick={() => deleteAdmission(a)}
                          disabled={Boolean(deletingId)}
                        >
                          {deletingId === a.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                    <td>{a.admission_number || '—'}</td>
                    <td>
                      {a.student_profile
                        ? `${a.student_profile.last_name}, ${a.student_profile.first_name}`
                        : '—'}
                      {a.student_profile?.student_no ? (
                        <span className="wp-flat__subline">{a.student_profile.student_no}</span>
                      ) : null}
                    </td>
                    <td>{a.school_term?.name || '—'}</td>
                    <td>{a.program?.code || '—'}</td>
                    <td>{majorLabel(a.program_major)}</td>
                    <td>{a.year_level ?? '—'}</td>
                    <td>{a.section || '—'}</td>
                    <td>
                      <span className="wp-flat__status">
                        {statusLabel(a.status)}
                      </span>
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
              ? `Showing ${meta.from}–${meta.to} of ${meta.total} admission${meta.total === 1 ? '' : 's'}`
              : '0 admissions'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={pagerDisabled} onPageChange={setPage} />
        </div>
      </div>

      {statusAdmission ? (
        <AdmissionStatusModal
          admission={statusAdmission}
          onSaved={() => {
            setStatusAdmission(null)
            refreshAll()
          }}
          onClose={() => setStatusAdmission(null)}
        />
      ) : null}

      {viewAdmissionId ? (
        <AdmissionViewModal
          admissionId={viewAdmissionId}
          onClose={() => setViewAdmissionId(null)}
        />
      ) : null}
    </div>
  )
}
