import { useCallback, useEffect, useState } from 'react'
import { FiDownload, FiPlus, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import PageLoadingRow from '../components/common/PageLoadingRow'
import SubjectFormModal from '../components/subjects/SubjectFormModal'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import {
  emptySubjectUsage,
  subjectUsageDialogHtml,
  subjectUsageHasRecords,
} from '../utils/subjectUsage'
import { wpAlert, wpConfirm } from '../utils/wpSwal'
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function SubjectsPage() {
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
  const [modalSubject, setModalSubject] = useState(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
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
      const params = {
        page,
        per_page: perPage,
        ...buildFilterParams(),
      }

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

  function openAddModal() {
    setModalSubject(null)
    setModalOpen(true)
  }

  function openEditModal(subject) {
    setModalSubject(subject)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setModalSubject(undefined)
  }

  async function loadUsage(subject) {
    try {
      const { data } = await api.get(`/subjects/${subject.id}/usage`)
      return data
    } catch {
      return emptySubjectUsage(subject)
    }
  }

  async function toggleActive(subject) {
    const active = subject.is_active !== false
    const usage = await loadUsage(subject)
    const label = `<strong>${escapeHtml(subject.code)}</strong> — ${escapeHtml(subject.title)}`
    const lead = active
      ? subjectUsageHasRecords(usage)
        ? `${label} will be hidden from new curriculum assignments. Existing records stay unchanged.`
        : `${label} has no linked curriculum, class sections, or enrollments yet. It will be hidden from new assignments.`
      : `${label} will be available again when building curriculum or class sections.`

    const ok = await wpConfirm({
      icon: 'question',
      title: active ? 'Deactivate this subject?' : 'Activate this subject?',
      html: subjectUsageDialogHtml(lead, usage),
      confirmText: active ? 'Deactivate' : 'Activate',
      danger: active,
      wide: subjectUsageHasRecords(usage),
    })
    if (!ok) return

    setTogglingId(subject.id)
    try {
      await api.put(`/subjects/${subject.id}`, { is_active: !active })
      toast.success(active ? 'Subject deactivated.' : 'Subject activated.')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update subject status.'))
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteSubject(subject) {
    const usage = await loadUsage(subject)
    const label = `<strong>${escapeHtml(subject.code)}</strong> — ${escapeHtml(subject.title)}`

    if (usage.in_use || usage.can_delete === false) {
      await wpAlert({
        icon: 'error',
        title: 'This subject cannot be deleted',
        html: subjectUsageDialogHtml(
          `${label} is already used by the records below. Deactivate it instead so existing student records stay intact.`,
          usage
        ),
        confirmText: 'OK',
        wide: true,
      })
      return
    }

    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Delete this subject?',
      html: subjectUsageDialogHtml(
        `${label} has no linked curriculum, class sections, or enrollments. It will be permanently removed. This cannot be undone.`,
        usage
      ),
      confirmText: 'Delete subject',
      danger: true,
    })
    if (!ok) return

    setTogglingId(subject.id)
    try {
      await api.delete(`/subjects/${subject.id}`)
      toast.success('Subject deleted.')
      await load()
    } catch (err) {
      const usageFromError = err?.response?.data?.usage
      if (usageFromError?.in_use) {
        await wpAlert({
          icon: 'error',
          title: 'This subject cannot be deleted',
          html: subjectUsageDialogHtml(
            `${label} is already used by the records below. Deactivate it instead so existing student records stay intact.`,
            usageFromError
          ),
          confirmText: 'OK',
          wide: true,
        })
      } else {
        toast.error(apiErrorMessage(err, 'Failed to delete subject.'))
      }
    } finally {
      setTogglingId(null)
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
          <h1 className="wp-flat__title">Subjects</h1>
          <p className="wp-flat__sub">
            Maintain the subject catalog used across programs and curriculum.
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
            Add Subject
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
                <th>Actions</th>
                <th>Code</th>
                <th>Title</th>
                <th>Units</th>
                <th>Level</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={7} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="wp-flat__empty">No subjects found.</td></tr>
              ) : (
                rows.map((s, idx) => {
                  const active = s.is_active !== false
                  const busy = togglingId === s.id
                  return (
                    <tr key={s.id}>
                      <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                      <td>
                        <div className="wp-flat__actions">
                          <button
                            type="button"
                            className="wp-flat__btn wp-flat__btn--edit wp-flat__btn--sm"
                            onClick={() => openEditModal(s)}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`wp-flat__btn wp-flat__btn--sm ${active ? 'wp-flat__btn--danger' : 'wp-flat__btn--success'}`}
                            onClick={() => toggleActive(s)}
                            disabled={busy}
                          >
                            {busy ? 'Saving…' : (active ? 'Deactivate' : 'Activate')}
                          </button>
                          <button
                            type="button"
                            className="wp-flat__btn wp-flat__btn--sm wp-flat__btn--danger"
                            onClick={() => deleteSubject(s)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                      <td>{s.code}</td>
                      <td>{s.title}</td>
                      <td>{s.units != null ? Number(s.units).toFixed(2) : '—'}</td>
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
            {summaryReady && summary.active != null
              ? ` · ${summary.active} active`
              : ''}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={loading} onPageChange={setPage} />
        </div>
      </div>

      {modalOpen ? (
        <SubjectFormModal
          subject={modalSubject}
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
