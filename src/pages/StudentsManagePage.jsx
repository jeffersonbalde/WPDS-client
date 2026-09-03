import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiPlus, FiRefreshCw, FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight, FiDownload } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import PageLoadingRow from '../components/common/PageLoadingRow'
import StudentRecordModal from '../components/students/StudentRecordModal'
import { apiErrorMessage } from '../utils/apiError'
import { majorLabel } from '../utils/program'
import { wpAlert, wpConfirm, wpWithLoading } from '../utils/wpSwal'
import './StudentsManagePage.css'

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function studentUsageHtml(intro, usage) {
  const admissions = Number(usage?.admissions || 0)
  const grades = Number(usage?.grades || 0)
  const chips = []
  if (admissions) chips.push(`Admissions ${admissions}`)
  if (grades) chips.push(`Grades ${grades}`)
  const chipsHtml = chips.length
    ? `<div class="wp-swal__counts">${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}</div>`
    : ''
  return `<p>${intro}</p>${chipsHtml}`
}

export default function StudentsManagePage() {
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
  const [deletingId, setDeletingId] = useState(null)

  const closeRecordModal = useCallback(() => {
    setViewStudentId(null)
  }, [])

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
      const params = {
        page,
        per_page: perPage,
        ...buildFilterParams(),
      }

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
      const params = buildFilterParams()
      const response = await api.get('/students/export', {
        params,
        responseType: 'blob',
      })

      const disposition = response.headers['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || `students-export-${new Date().toISOString().slice(0, 10)}.xlsx`

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

      toast.success('Student report exported to Excel.')
    } catch (err) {
      let message = 'Failed to export students.'
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

  async function deleteStudent(student) {
    if (deletingId != null) return
    const label = `<strong>${escapeHtml(displayName(student) || 'this student')}</strong>${
      student.student_no ? ` (${escapeHtml(student.student_no)})` : ''
    }`

    let usage = {
      can_delete: student.can_delete !== false && Number(student.admissions_count || 0) === 0,
      admissions: Number(student.admissions_count || 0),
      grades: 0,
    }

    try {
      usage = await wpWithLoading(
        async () => {
          const { data } = await api.get(`/students/${student.id}/usage`)
          return data
        },
        { title: 'Checking student…', text: 'Looking up admission and grade records.' },
      )
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to check whether this student can be deleted.'))
      return
    }

    if (!usage.can_delete || usage.in_use) {
      await wpAlert({
        icon: 'error',
        title: 'This student cannot be deleted',
        html: studentUsageHtml(
          `${label} already has admission or grade records. Use Edit Profile to correct details instead.`,
          usage
        ),
        confirmText: 'OK',
      })
      return
    }

    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Delete this student?',
      html: studentUsageHtml(
        `${label} has no admission or grade records. The student profile and portal account will be permanently removed. This cannot be undone.`,
        usage
      ),
      confirmText: 'Delete student',
      danger: true,
    })
    if (!ok) return

    setDeletingId(student.id)
    try {
      await api.delete(`/students/${student.id}`)
      toast.success('Student deleted.')
      if (viewStudentId === student.id) setViewStudentId(null)
      if (rows.length === 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1))
      } else {
        await load()
      }
    } catch (err) {
      const usageFromError = err?.response?.data?.usage
      if (usageFromError && (usageFromError.in_use || usageFromError.can_delete === false)) {
        await wpAlert({
          icon: 'error',
          title: 'This student cannot be deleted',
          html: studentUsageHtml(
            `${label} already has admission or grade records. Use Edit Profile to correct details instead.`,
            usageFromError
          ),
          confirmText: 'OK',
        })
      } else {
        toast.error(apiErrorMessage(err, 'Failed to delete student.'))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const filteredPrograms = programs.filter((p) => {
    if (levelFilter === 'all') return true
    return levelValue(p.academic_level) === levelFilter
  })

  const pageItems = (() => {
    const total = meta.last_page || 1
    const current = meta.current_page || 1
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
  })()

  const atFirst = meta.current_page <= 1
  const atLast = meta.current_page >= meta.last_page
  const pagerDisabled = loading

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Students</h1>
          <p className="wp-flat__sub">
            Browse student records, check portal accounts, and update profiles as needed.
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
          <Link to="/students/new" className="wp-flat__btn wp-flat__btn--primary">
            <FiPlus size={16} />
            Add Student
          </Link>
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
        <select
          className="form-select wp-flat__control"
          value={programFilter}
          onChange={(e) => {
            setProgramFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by program"
        >
          <option value="all">All programs</option>
          {filteredPrograms.map((p) => (
            <option key={p.id} value={p.id}>{p.code}</option>
          ))}
        </select>
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
                        <div className="wp-flat__actions">
                          <button
                            type="button"
                            className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                            onClick={() => setViewStudentId(s.id)}
                          >
                            View Record
                          </button>
                          <Link to={`/students/${s.id}/edit`} className="wp-flat__btn wp-flat__btn--edit wp-flat__btn--sm">
                            Edit Profile
                          </Link>
                          <button
                            type="button"
                            className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                            onClick={() => deleteStudent(s)}
                            disabled={deletingId === s.id || loading}
                          >
                            {deletingId === s.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
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
                const active = item === meta.current_page
                return (
                  <button
                    key={item}
                    type="button"
                    className={`wp-flat__pager-num${active ? ' is-active' : ''}`}
                    onClick={() => setPage(item)}
                    disabled={pagerDisabled}
                    aria-label={`Page ${item}`}
                    aria-current={active ? 'page' : undefined}
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

      {viewStudentId ? (
        <StudentRecordModal
          studentId={viewStudentId}
          onClose={closeRecordModal}
        />
      ) : null}
    </div>
  )
}
