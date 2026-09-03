import { useCallback, useEffect, useState } from 'react'
import { FiDownload, FiPlus, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import PageLoadingRow from '../components/common/PageLoadingRow'
import SchoolTermFormModal from '../components/school-terms/SchoolTermFormModal'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import { wpAlert, wpConfirm, wpWithLoading } from '../utils/wpSwal'
import './StudentsManagePage.css'
import './TermsPage.css'

const TERM_TYPE_LABELS = {
  first_semester: 'First Semester',
  second_semester: 'Second Semester',
  summer: 'Summer',
}

function termTypeLabel(value) {
  return TERM_TYPE_LABELS[value] || value || '—'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function termUsageDialogHtml(lead, usage) {
  const items = []
  if (usage?.admissions_count > 0) {
    items.push(`${usage.admissions_count} admission${usage.admissions_count === 1 ? '' : 's'}`)
  }
  if (usage?.class_sections_count > 0) {
    items.push(`${usage.class_sections_count} class section${usage.class_sections_count === 1 ? '' : 's'}`)
  }
  const list = items.length
    ? `<ul class="wp-term-usage__list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p class="wp-term-usage__empty">No linked records.</p>'
  return `<p class="wp-term-usage__lead">${lead}</p>${list}`
}

export default function TermsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 })
  const [summaryReady, setSummaryReady] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTerm, setModalTerm] = useState(null)
  const [busyId, setBusyId] = useState(null)
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
    if (typeFilter !== 'all') params.term_type = typeFilter
    if (statusFilter === 'active') params.status = 'active'
    if (statusFilter === 'inactive') params.status = 'inactive'
    return params
  }, [debouncedSearch, typeFilter, statusFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        per_page: perPage,
        ...buildFilterParams(),
      }
      const { data } = await api.get('/school-terms', { params })
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
      toast.error(apiErrorMessage(err, 'Failed to load school terms.'))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, buildFilterParams])

  useEffect(() => {
    load()
  }, [load])

  function openAddModal() {
    setModalTerm(null)
    setModalOpen(true)
  }

  function openEditModal(row) {
    setModalTerm(row)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setModalTerm(null)
  }

  function setStatus(next) {
    if (next === 'all') {
      setStatusFilter('all')
    } else {
      setStatusFilter((prev) => (prev === next ? 'all' : next))
    }
    setPage(1)
  }

  async function loadUsage(term) {
    const { data } = await api.get(`/school-terms/${term.id}/usage`)
    return data
  }

  async function deleteTerm(term) {
    if (busyId != null) return

    let usage = {
      in_use: false,
      can_delete: true,
      admissions_count: 0,
      class_sections_count: 0,
    }
    try {
      usage = await wpWithLoading(
        () => loadUsage(term),
        { title: 'Checking school term…', text: 'Looking up linked admissions and class sections.' },
      )
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to check school term usage.'))
      return
    }

    const label = `<strong>${escapeHtml(term.name || 'School term')}</strong>`

    if (usage.in_use || usage.can_delete === false) {
      await wpAlert({
        icon: 'error',
        title: 'This school term cannot be deleted',
        html: termUsageDialogHtml(
          `${label} is already used by the records below. Set it to inactive instead so existing records stay intact.`,
          usage,
        ),
        confirmText: 'OK',
        wide: true,
      })
      return
    }

    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Delete this school term?',
      html: termUsageDialogHtml(
        `${label} has no linked admissions or class sections. It will be permanently removed. This cannot be undone.`,
        usage,
      ),
      confirmText: 'Delete term',
      danger: true,
    })
    if (!ok) return

    setBusyId(term.id)
    try {
      await api.delete(`/school-terms/${term.id}`)
      toast.success('School term deleted.')
      await load()
    } catch (err) {
      const usageFromError = err?.response?.data?.usage
      if (usageFromError?.in_use) {
        await wpAlert({
          icon: 'error',
          title: 'This school term cannot be deleted',
          html: termUsageDialogHtml(
            `${label} is already used by the records below. Set it to inactive instead so existing records stay intact.`,
            usageFromError,
          ),
          confirmText: 'OK',
          wide: true,
        })
      } else {
        toast.error(apiErrorMessage(err, 'Failed to delete school term.'))
      }
    } finally {
      setBusyId(null)
    }
  }

  async function exportExcel() {
    setExporting(true)
    try {
      await downloadExcelExport({
        api,
        url: '/school-terms/export',
        params: buildFilterParams(),
        fallbackFilename: `school-terms-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('School terms report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export school terms.'))
    } finally {
      setExporting(false)
    }
  }

  const pagerDisabled = loading || busyId != null || exporting

  return (
    <div className="wp-flat wp-terms">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">School Terms</h1>
          <p className="wp-flat__sub">
            Manage school terms and semesters used across admissions and class sections.
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
          <button type="button" className="wp-flat__btn wp-flat__btn--primary" onClick={openAddModal}>
            <FiPlus size={16} />
            Add Term
          </button>
        </div>
      </div>

      <div className="wp-flat__stats" aria-label="School term counts">
        <button
          type="button"
          className={`wp-flat__stat${statusFilter === 'all' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show all school terms"
          onClick={() => {
            setStatusFilter('all')
            setPage(1)
          }}
        >
          <span className="wp-flat__stat-label">All terms</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.total}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--blue${statusFilter === 'active' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show active school terms"
          onClick={() => setStatus('active')}
        >
          <span className="wp-flat__stat-label">Active</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.active}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--teal${statusFilter === 'inactive' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show inactive school terms"
          onClick={() => setStatus('inactive')}
        >
          <span className="wp-flat__stat-label">Inactive</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.inactive}</span>
          )}
        </button>
      </div>

      <div className="wp-flat__toolbar">
        <select
          className="form-select wp-flat__control wp-terms__type-filter"
          value={typeFilter}
          disabled={pagerDisabled}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by term type"
        >
          <option value="all">All types</option>
          <option value="first_semester">First Semester</option>
          <option value="second_semester">Second Semester</option>
          <option value="summer">Summer</option>
        </select>
        <input
          type="search"
          className="form-control wp-flat__search"
          placeholder="Search term name or school year…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search school terms"
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
                <th>Name</th>
                <th>Type</th>
                <th>School Year</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={6} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wp-flat__empty">No school terms found.</td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const busy = busyId === row.id
                  return (
                  <tr key={row.id}>
                    <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                    <td>
                      <div className="wp-flat__actions">
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--edit wp-flat__btn--sm"
                          onClick={() => openEditModal(row)}
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--sm wp-flat__btn--danger"
                          onClick={() => deleteTerm(row)}
                          disabled={busy || busyId != null}
                        >
                          {busy ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                    <td>{row.name || '—'}</td>
                    <td>{termTypeLabel(row.term_type)}</td>
                    <td>{row.school_year || '—'}</td>
                    <td>{row.is_active ? 'Yes' : 'No'}</td>
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
              ? `Showing ${meta.from}–${meta.to} of ${meta.total} terms`
              : '0 terms'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={pagerDisabled} onPageChange={setPage} />
        </div>
      </div>

      {modalOpen ? (
        <SchoolTermFormModal
          term={modalTerm}
          onClose={closeModal}
          onSaved={() => {
            closeModal()
            load()
          }}
        />
      ) : null}
    </div>
  )
}
