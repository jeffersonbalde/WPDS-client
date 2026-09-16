import { useCallback, useEffect, useState } from 'react'
import { FiRefreshCw, FiDownload } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import StaffUserViewModal from '../components/users/StaffUserViewModal'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import { initialsOf } from '../utils/avatar'
import './StudentsManagePage.css'
import './UsersPage.css'

export default function MonitorTeachersPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 })
  const [summaryReady, setSummaryReady] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [viewTeacherId, setViewTeacherId] = useState(null)

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
    if (statusFilter !== 'all') params.status = statusFilter
    return params
  }, [debouncedSearch, statusFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: perPage, ...buildFilterParams() }
      const { data } = await api.get('/teacher-directory', { params })
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
      toast.error(apiErrorMessage(err, 'Failed to load teachers.'))
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
        url: '/teacher-directory/export',
        params: buildFilterParams(),
        fallbackFilename: `teachers-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Teacher directory exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export teachers.'))
    } finally {
      setExporting(false)
    }
  }

  function onStatClick(next) {
    setStatusFilter((prev) => (prev === next ? 'all' : next))
    setPage(1)
  }

  return (
    <div className="wp-flat wp-users wp-teachers-dir">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Directory — Teachers</h1>
          <p className="wp-flat__sub">
            Browse teacher accounts and contact details.
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

      <div className="wp-flat__stats" aria-label="Teacher counts">
        <div className={`wp-flat__stat${!summaryReady ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Total Teachers</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.total}</span>
          )}
        </div>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--teal${statusFilter === 'active' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          onClick={() => onStatClick('active')}
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
          className={`wp-flat__stat${statusFilter === 'inactive' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          onClick={() => onStatClick('inactive')}
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
          placeholder="Search name, email, or employee no…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search teachers"
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

      <div className="wp-flat__panel wp-users__panel">
        {loading ? (
          <div className="wp-users__grid">
            {Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
              <div key={i} className="wp-users__card wp-users__card--skeleton" aria-hidden>
                <div className="wp-users__card-avatar wp-users__skeleton-avatar" />
                <div className="wp-users__skeleton-bar wp-users__skeleton-bar--wide" />
                <div className="wp-users__skeleton-bar wp-users__skeleton-bar--pill" />
                <div className="wp-users__skeleton-bar" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="wp-flat__empty">No teachers match your filters.</div>
        ) : (
          <div className="wp-users__grid">
            {rows.map((t) => {
              const subId = t.staff_profile?.employee_no ? `Emp: ${t.staff_profile.employee_no}` : null
              const sections = t.class_sections_count ?? 0

              return (
                <article key={t.id} className="wp-users__card wp-users__card--teacher">
                  <div className="wp-users__card-avatar-wrap">
                    <div className="wp-users__card-avatar">
                      {t.avatar_url ? (
                        <img src={t.avatar_url} alt="" />
                      ) : (
                        <span>{initialsOf(t.name)}</span>
                      )}
                    </div>
                  </div>

                  <h3 className="wp-users__card-name" title={t.name}>{t.name}</h3>
                  <span className="wp-users__role-pill">Teacher</span>
                  <p className="wp-users__card-email" title={t.email}>{t.email}</p>
                  {subId ? <p className="wp-users__card-meta">{subId}</p> : null}
                  <p className="wp-users__card-meta">{sections} class section{sections === 1 ? '' : 's'}</p>
                  <span className={`wp-users__status-pill${t.is_active ? ' is-active' : ' is-inactive'}`}>
                    <span className="wp-users__status-dot" aria-hidden />
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>

                  <div className="wp-users__card-actions">
                    <button
                      type="button"
                      className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                      onClick={() => setViewTeacherId(t.id)}
                    >
                      View
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="wp-flat__footer">
          <span className="wp-flat__footer-meta">
            {meta.total > 0
              ? `Showing ${meta.from}–${meta.to} of ${meta.total} teacher${meta.total === 1 ? '' : 's'}`
              : '0 teachers'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={loading} onPageChange={setPage} />
        </div>
      </div>

      {viewTeacherId ? (
        <StaffUserViewModal
          userId={viewTeacherId}
          baseUrl="/teacher-directory"
          onClose={() => setViewTeacherId(null)}
        />
      ) : null}
    </div>
  )
}
