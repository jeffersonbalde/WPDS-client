import { useCallback, useEffect, useState } from 'react'
import { FiPlus, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import PageLoadingRow from '../components/common/PageLoadingRow'
import AnnouncementFormModal from '../components/announcements/AnnouncementFormModal'
import { apiErrorMessage } from '../utils/apiError'
import { wpConfirm } from '../utils/wpSwal'
import './StudentsManagePage.css'
import './AnnouncementsPage.css'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AnnouncementsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [summary, setSummary] = useState({ total: 0, published: 0, draft: 0 })
  const [summaryReady, setSummaryReady] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalAnnouncement, setModalAnnouncement] = useState(null)
  const [busyId, setBusyId] = useState(null)

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
      const { data } = await api.get('/announcements', { params })
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
      toast.error(apiErrorMessage(err, 'Failed to load announcements.'))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, buildFilterParams])

  useEffect(() => {
    load()
  }, [load])

  function openAddModal() {
    setModalAnnouncement(null)
    setModalOpen(true)
  }

  function openEditModal(row) {
    setModalAnnouncement(row)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setModalAnnouncement(null)
  }

  function setStatus(next) {
    if (next === 'all') {
      setStatusFilter('all')
    } else {
      setStatusFilter((prev) => (prev === next ? 'all' : next))
    }
    setPage(1)
  }

  async function deleteAnnouncement(row) {
    if (busyId != null) return

    const label = `<strong>${escapeHtml(row.title || 'Announcement')}</strong>`
    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Delete this announcement?',
      html: `<p>${label} will be permanently removed. If it is published, it will disappear from the student dashboard.</p>`,
      confirmText: 'Delete announcement',
      danger: true,
    })
    if (!ok) return

    setBusyId(row.id)
    try {
      await api.delete(`/announcements/${row.id}`)
      toast.success('Announcement deleted.')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete announcement.'))
    } finally {
      setBusyId(null)
    }
  }

  const pagerDisabled = loading || busyId != null

  return (
    <div className="wp-flat wp-ann">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Announcements</h1>
          <p className="wp-flat__sub">
            Post updates that appear on the student dashboard. Drafts stay hidden until published.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
          <button type="button" className="wp-flat__btn wp-flat__btn--primary" onClick={openAddModal}>
            <FiPlus size={16} />
            New Announcement
          </button>
        </div>
      </div>

      <div className="wp-flat__stats" aria-label="Announcement counts">
        <button
          type="button"
          className={`wp-flat__stat${statusFilter === 'all' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show all announcements"
          onClick={() => setStatus('all')}
        >
          <span className="wp-flat__stat-label">All announcements</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.total}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--blue${statusFilter === 'published' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show published announcements"
          onClick={() => setStatus('published')}
        >
          <span className="wp-flat__stat-label">Published</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.published}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--teal${statusFilter === 'draft' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show draft announcements"
          onClick={() => setStatus('draft')}
        >
          <span className="wp-flat__stat-label">Drafts</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.draft}</span>
          )}
        </button>
      </div>

      <div className="wp-flat__toolbar">
        <select
          className="form-select wp-flat__control"
          value={statusFilter}
          disabled={pagerDisabled}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <input
          type="search"
          className="form-control wp-flat__search"
          placeholder="Search title or message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search announcements"
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
                <th>Title</th>
                <th>Status</th>
                <th>Posted</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={6} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wp-flat__empty">
                    No announcements yet. Click “New Announcement” to post one.
                  </td>
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
                            onClick={() => deleteAnnouncement(row)}
                            disabled={busy || busyId != null}
                          >
                            {busy ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className="wp-ann__title-cell">{row.title || '—'}</span>
                        {row.body ? <span className="wp-ann__preview">{row.body}</span> : null}
                      </td>
                      <td>
                        <span className={`wp-ann__pill ${row.is_published ? 'wp-ann__pill--published' : 'wp-ann__pill--draft'}`}>
                          {row.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td>{row.is_published ? formatDateTime(row.published_at) : '—'}</td>
                      <td>{row.author?.name || '—'}</td>
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
              ? `Showing ${meta.from}–${meta.to} of ${meta.total} announcement${meta.total === 1 ? '' : 's'}`
              : '0 announcements'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={pagerDisabled} onPageChange={setPage} />
        </div>
      </div>

      {modalOpen ? (
        <AnnouncementFormModal
          announcement={modalAnnouncement}
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
