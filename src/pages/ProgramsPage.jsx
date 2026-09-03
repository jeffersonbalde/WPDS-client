import { useCallback, useEffect, useState } from 'react'
import {
  FiPlus,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiDownload,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import PageLoadingRow from '../components/common/PageLoadingRow'
import ProgramFormModal from '../components/programs/ProgramFormModal'
import { apiErrorMessage } from '../utils/apiError'
import { majorsFullText } from '../utils/program'
import { wpAlert, wpConfirm, wpWithLoading } from '../utils/wpSwal'
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function emptyUsage(program) {
  return {
    code: program?.code || '',
    name: program?.name || '',
    in_use: Boolean(program?.in_use),
    can_delete: !program?.in_use,
    students: { total: 0, preview: [] },
    admissions: { total: 0, preview: [] },
    curriculum: { total: 0, preview: [] },
  }
}

function usageHasRecords(usage) {
  return Boolean(
    usage?.students?.total || usage?.admissions?.total || usage?.curriculum?.total
  )
}

function studentLine(row) {
  const bits = [row.student_no, row.name].filter(Boolean).join(' — ')
  const extra = [row.year_level ? `Year ${row.year_level}` : '', row.section].filter(Boolean).join(' · ')
  return escapeHtml(extra ? `${bits} · ${extra}` : bits)
}

function admissionLine(row) {
  const who = [row.student_no, row.name].filter(Boolean).join(' — ')
  const bits = [row.admission_number, who, row.term].filter(Boolean).join(' · ')
  return escapeHtml(bits)
}

function curriculumLine(row) {
  const subject = [row.code, row.title].filter(Boolean).join(' — ')
  const extra = [row.year_level ? `Year ${row.year_level}` : '', row.semester ? `Sem ${row.semester}` : '']
    .filter(Boolean)
    .join(' · ')
  return escapeHtml(extra ? `${subject} · ${extra}` : subject)
}

function usageRecordsHtml(usage) {
  const students = usage?.students?.total || 0
  const admissions = usage?.admissions?.total || 0
  const curriculum = usage?.curriculum?.total || 0
  const chips = [
    students ? `Students ${students}` : '',
    admissions ? `Admissions ${admissions}` : '',
    curriculum ? `Curriculum ${curriculum}` : '',
  ].filter(Boolean)

  let preview = { items: [], total: 0, format: studentLine, noun: 'records' }
  if (students) {
    preview = { items: usage.students.preview || [], total: students, format: studentLine, noun: 'students' }
  } else if (admissions) {
    preview = { items: usage.admissions.preview || [], total: admissions, format: admissionLine, noun: 'admissions' }
  } else if (curriculum) {
    preview = { items: usage.curriculum.preview || [], total: curriculum, format: curriculumLine, noun: 'subjects' }
  }

  const shown = preview.items.slice(0, 4)
  const extra = preview.total > shown.length
    ? `<li class="wp-swal__list-more">and ${preview.total - shown.length} more ${preview.noun}</li>`
    : ''

  return `
    <div class="wp-swal__counts">
      ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}
    </div>
    <ul class="wp-swal__list">
      ${shown.map((item) => `<li>${preview.format(item)}</li>`).join('')}
      ${extra}
    </ul>
  `
}

function usageDialogHtml(lead, usage) {
  return `
    <div class="wp-swal__detail">
      <p class="wp-swal__detail-lead">${lead}</p>
      ${usageHasRecords(usage) ? usageRecordsHtml(usage) : ''}
    </div>
  `
}

function pageItemsFor(lastPage, currentPage) {
  const total = lastPage || 1
  const current = currentPage || 1
  if (total <= 1) return [1]
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const items = []
  const pushRange = (from, to) => {
    for (let i = from; i <= to; i += 1) items.push(i)
  }

  items.push(1)
  if (current <= 4) {
    pushRange(2, 5)
    items.push('ellipsis-right')
    items.push(total)
    return items
  }
  if (current >= total - 3) {
    items.push('ellipsis-left')
    pushRange(total - 4, total)
    return items
  }
  items.push('ellipsis-left')
  pushRange(current - 1, current + 1)
  items.push('ellipsis-right')
  items.push(total)
  return items
}

export default function ProgramsPage() {
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
  const [modalProgram, setModalProgram] = useState(undefined)
  const [togglingId, setTogglingId] = useState(null)
  const [exporting, setExporting] = useState(false)

  const modalOpen = modalProgram !== undefined

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        per_page: perPage,
      }
      if (debouncedSearch) params.search = debouncedSearch
      if (levelFilter !== 'all') params.academic_level = levelFilter
      if (trackFilter !== 'all') params.track_type = trackFilter
      if (statusFilter !== 'all') params.status = statusFilter

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
  }, [page, perPage, debouncedSearch, levelFilter, trackFilter, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  function buildFilterParams() {
    const params = {}
    if (debouncedSearch) params.search = debouncedSearch
    if (levelFilter !== 'all') params.academic_level = levelFilter
    if (trackFilter !== 'all') params.track_type = trackFilter
    if (statusFilter !== 'all') params.status = statusFilter
    return params
  }

  async function exportExcel() {
    setExporting(true)
    try {
      const response = await api.get('/programs/export', {
        params: buildFilterParams(),
        responseType: 'blob',
      })

      const disposition = response.headers['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || `programs-export-${new Date().toISOString().slice(0, 10)}.xlsx`

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('Program report exported to Excel.')
    } catch (err) {
      let message = 'Failed to export programs.'
      const data = err?.response?.data
      if (data instanceof Blob) {
        try {
          const text = await data.text()
          const json = JSON.parse(text)
          message = json.message || message
        } catch {
          /* keep default */
        }
      } else {
        message = apiErrorMessage(err, message)
      }
      toast.error(message)
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

  async function loadUsage(program) {
    try {
      return await wpWithLoading(
        async () => {
          const { data } = await api.get(`/programs/${program.id}/usage`)
          return data
        },
        { title: 'Checking program…', text: 'Looking up linked student and curriculum records.' },
      )
    } catch {
      return emptyUsage(program)
    }
  }

  async function toggleActive(program) {
    if (togglingId != null) return
    const active = program.is_active !== false
    const usage = await loadUsage(program)
    const label = `<strong>${escapeHtml(program.code)}</strong> — ${escapeHtml(program.name)}`
    const lead = active
      ? usageHasRecords(usage)
        ? `${label} will be hidden from new enrollments. Existing records stay unchanged.`
        : `${label} has no linked student, admission, or curriculum records yet. It will be hidden from new enrollments.`
      : `${label} will be available again when enrolling students.`

    const ok = await wpConfirm({
      icon: 'question',
      title: active ? 'Deactivate this program?' : 'Activate this program?',
      html: usageDialogHtml(lead, usage),
      confirmText: active ? 'Deactivate' : 'Activate',
      danger: active,
    })
    if (!ok) return

    setTogglingId(program.id)
    try {
      await api.put(`/programs/${program.id}`, { is_active: !active })
      toast.success(active ? 'Program deactivated.' : 'Program activated.')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update program status.'))
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteProgram(program) {
    if (togglingId != null) return
    const usage = await loadUsage(program)
    const label = `<strong>${escapeHtml(program.code)}</strong> — ${escapeHtml(program.name)}`

    if (usage.in_use || usage.can_delete === false) {
      await wpAlert({
        icon: 'error',
        title: 'This program cannot be deleted',
        html: usageDialogHtml(
          `${label} is already used by the records below. Deactivate it instead so existing student records stay intact.`,
          usage
        ),
        confirmText: 'OK',
      })
      return
    }

    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Delete this program?',
      html: usageDialogHtml(
        `${label} has no linked student, admission, or curriculum records. It will be permanently removed. This cannot be undone.`,
        usage
      ),
      confirmText: 'Delete program',
      danger: true,
    })
    if (!ok) return

    setTogglingId(program.id)
    try {
      await api.delete(`/programs/${program.id}`)
      toast.success('Program deleted.')
      await load()
    } catch (err) {
      const usageFromError = err?.response?.data?.usage
      if (usageFromError?.in_use) {
        await wpAlert({
          icon: 'error',
          title: 'This program cannot be deleted',
          html: usageDialogHtml(
            `${label} is already used by the records below. Deactivate it instead so existing student records stay intact.`,
            usageFromError
          ),
          confirmText: 'OK',
        })
      } else {
        toast.error(apiErrorMessage(err, 'Failed to delete program.'))
      }
    } finally {
      setTogglingId(null)
    }
  }

  const pageItems = pageItemsFor(meta.last_page, meta.current_page)
  const atFirst = meta.current_page <= 1
  const atLast = meta.current_page >= meta.last_page
  const pagerDisabled = loading
  const trackOptions = levelFilter === 'shs'
    ? [['academic', 'Academic'], ['tvl', 'TVL']]
    : levelFilter === 'college'
      ? [['degree', 'Degree'], ['associate', 'Associate']]
      : [['degree', 'Degree'], ['associate', 'Associate'], ['academic', 'Academic'], ['tvl', 'TVL']]

  return (
    <div className="wp-flat wp-prog">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Programs</h1>
          <p className="wp-flat__sub">
            Browse academic programs and update records as needed.
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
          <button type="button" className="wp-flat__btn wp-flat__btn--primary" onClick={() => setModalProgram(null)}>
            <FiPlus size={16} />
            Add Program
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
                <th>Actions</th>
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
                <PageLoadingRow colSpan={9} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="wp-flat__empty">No programs found.</td></tr>
              ) : (
                rows.map((p, idx) => {
                  const active = p.is_active !== false
                  const busy = togglingId === p.id
                  const majors = majorsFullText(p)
                  return (
                    <tr key={p.id}>
                      <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                      <td>
                        <div className="wp-flat__actions">
                          <button
                            type="button"
                            className="wp-flat__btn wp-flat__btn--edit wp-flat__btn--sm"
                            onClick={() => setModalProgram(p)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`wp-flat__btn wp-flat__btn--sm ${active ? 'wp-flat__btn--danger' : 'wp-flat__btn--success'}`}
                            onClick={() => toggleActive(p)}
                            disabled={busy}
                          >
                            {busy ? 'Saving…' : (active ? 'Deactivate' : 'Activate')}
                          </button>
                          <button
                            type="button"
                            className="wp-flat__btn wp-flat__btn--sm wp-flat__btn--danger"
                            onClick={() => deleteProgram(p)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
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
          <nav className="wp-flat__pager" aria-label="Pagination">
            <button
              type="button"
              className="wp-flat__pager-btn"
              disabled={atFirst || pagerDisabled}
              onClick={() => setPage(1)}
              aria-label="First page"
              title="First page"
            >
              <FiChevronsLeft size={16} />
              <span className="wp-flat__pager-label">First</span>
            </button>
            <button
              type="button"
              className="wp-flat__pager-btn"
              disabled={atFirst || pagerDisabled}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              title="Previous page"
            >
              <FiChevronLeft size={16} />
              <span className="wp-flat__pager-label">Prev</span>
            </button>

            <div className="wp-flat__pager-pages">
              {pageItems.map((item, idx) => {
                if (typeof item === 'string') {
                  return (
                    <span key={`${item}-${idx}`} className="wp-flat__pager-ellipsis" aria-hidden>
                      …
                    </span>
                  )
                }
                const current = item === meta.current_page
                return (
                  <button
                    key={item}
                    type="button"
                    className={`wp-flat__pager-num${current ? ' is-active' : ''}`}
                    onClick={() => setPage(item)}
                    disabled={pagerDisabled}
                    aria-label={`Page ${item}`}
                    aria-current={current ? 'page' : undefined}
                  >
                    {item}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="wp-flat__pager-btn"
              disabled={atLast || pagerDisabled}
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              aria-label="Next page"
              title="Next page"
            >
              <span className="wp-flat__pager-label">Next</span>
              <FiChevronRight size={16} />
            </button>
            <button
              type="button"
              className="wp-flat__pager-btn"
              disabled={atLast || pagerDisabled}
              onClick={() => setPage(meta.last_page)}
              aria-label="Last page"
              title="Last page"
            >
              <span className="wp-flat__pager-label">Last</span>
              <FiChevronsRight size={16} />
            </button>
          </nav>
        </div>
      </div>

      {modalOpen ? (
        <ProgramFormModal
          program={modalProgram}
          onClose={() => setModalProgram(undefined)}
          onSaved={() => {
            setModalProgram(undefined)
            load()
          }}
          onUpdated={load}
        />
      ) : null}
    </div>
  )
}
