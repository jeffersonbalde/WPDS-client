import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiDownload, FiPlus, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import ClassSectionFormModal from '../components/class-sections/ClassSectionFormModal'
import ClassSectionStudentsModal from '../components/class-sections/ClassSectionStudentsModal'
import FlatSearchSelect from '../components/common/FlatSearchSelect'
import '../components/common/FlatSearchSelect.css'
import FlatPager from '../components/common/FlatPager'
import PageLoadingRow from '../components/common/PageLoadingRow'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import { levelLabel } from '../utils/level'
import { wpAlert, wpConfirm } from '../utils/wpSwal'
import './StudentsManagePage.css'
import './ClassSectionsManagePage.css'

function scheduleText(row) {
  const parts = [row.schedule_day, row.schedule_time].filter(Boolean)
  if (!parts.length && !row.room) return '—'
  const schedule = parts.join(' · ')
  return row.room ? `${schedule}${schedule ? ' · ' : ''}${row.room}` : schedule
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sectionLabelHtml(row) {
  const code = escapeHtml(row?.subject?.code || '—')
  const title = escapeHtml(row?.subject?.title || '')
  const section = escapeHtml(row?.section || '—')
  const term = escapeHtml(row?.school_term?.name || '—')
  const subject = title ? `${code} — ${title}` : code
  return `<strong>${subject}</strong> · Sec. ${section} · ${term}`
}

function filterTermBySearch(term, query) {
  const name = String(term.name || '').toLowerCase()
  const year = String(term.school_year || '').toLowerCase()
  return name.includes(query) || year.includes(query)
}

export default function ClassSectionsManagePage() {
  const [rows, setRows] = useState([])
  const [terms, setTerms] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [termFilter, setTermFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [enrollmentFilter, setEnrollmentFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [summary, setSummary] = useState({ total: 0, college: 0, shs: 0, with_students: 0, empty: 0 })
  const [summaryReady, setSummaryReady] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSection, setModalSection] = useState(null)
  const [studentsModalSection, setStudentsModalSection] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const termFilterOptions = useMemo(
    () => terms,
    [terms],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadLookups = useCallback(async () => {
    try {
      const [termsRes, subjectsRes, teachersRes] = await Promise.all([
        api.get('/school-terms'),
        api.get('/subjects'),
        api.get('/teachers'),
      ])
      setTerms(Array.isArray(termsRes.data) ? termsRes.data : [])
      setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : subjectsRes.data?.data || [])
      setTeachers(Array.isArray(teachersRes.data) ? teachersRes.data : [])
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load form options.'))
    }
  }, [])

  useEffect(() => {
    loadLookups()
  }, [loadLookups])

  const buildFilterParams = useCallback(() => {
    const params = {}
    if (debouncedSearch) params.search = debouncedSearch
    if (termFilter !== 'all') params.school_term_id = termFilter
    if (levelFilter !== 'all') params.academic_level = levelFilter
    if (enrollmentFilter === 'with_students') params.enrollment_status = 'with_students'
    if (enrollmentFilter === 'empty') params.enrollment_status = 'empty'
    return params
  }, [debouncedSearch, termFilter, levelFilter, enrollmentFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        per_page: perPage,
        ...buildFilterParams(),
      }
      const { data } = await api.get('/class-sections', { params })
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
      toast.error(apiErrorMessage(err, 'Failed to load class sections.'))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, buildFilterParams])

  useEffect(() => {
    load()
  }, [load])

  function openAddModal() {
    setModalSection(null)
    setModalOpen(true)
  }

  function openEditModal(row) {
    setModalSection(row)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setModalSection(null)
  }

  function openStudentsModal(row) {
    setStudentsModalSection(row)
  }

  function closeStudentsModal() {
    setStudentsModalSection(null)
  }

  function setEnrollmentStatus(next) {
    if (next === 'all') {
      setEnrollmentFilter('all')
    } else {
      setEnrollmentFilter((prev) => (prev === next ? 'all' : next))
    }
    setPage(1)
  }

  async function exportExcel() {
    setExporting(true)
    try {
      await downloadExcelExport({
        api,
        url: '/class-sections/export',
        params: buildFilterParams(),
        fallbackFilename: `class-sections-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Class sections report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export class sections.'))
    } finally {
      setExporting(false)
    }
  }

  async function deleteSection(row) {
    if (!row?.id || deletingId) return

    const enrolled = Number(row.enrollment_subjects_count || 0)
    const label = sectionLabelHtml(row)

    if (enrolled > 0) {
      await wpAlert({
        icon: 'error',
        title: 'This class section cannot be deleted',
        html: `
          <div class="wp-swal__detail">
            <p class="wp-swal__detail-lead">${label} already has <strong>${enrolled}</strong> enrolled student${enrolled === 1 ? '' : 's'}.</p>
            <p class="wp-swal__detail-note">Edit the section instead so student enrollment records stay intact.</p>
          </div>
        `,
        confirmText: 'OK',
      })
      return
    }

    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Delete this class section?',
      html: `
        <div class="wp-swal__detail">
          <p class="wp-swal__detail-lead">${label} has no enrolled students and will be permanently removed.</p>
          <p class="wp-swal__detail-note">This cannot be undone.</p>
        </div>
      `,
      confirmText: 'Delete section',
      danger: true,
    })
    if (!ok) return

    setDeletingId(row.id)
    try {
      await api.delete(`/class-sections/${row.id}`)
      toast.success('Class section deleted.')
      await load()
    } catch (err) {
      const usage = err?.response?.data?.usage
      if (usage && usage.can_delete === false) {
        const count = Number(usage.enrolled_students || 0)
        await wpAlert({
          icon: 'error',
          title: 'This class section cannot be deleted',
          html: `
            <div class="wp-swal__detail">
              <p class="wp-swal__detail-lead">${label} already has <strong>${count}</strong> enrolled student${count === 1 ? '' : 's'}.</p>
              <p class="wp-swal__detail-note">Edit the section instead so student enrollment records stay intact.</p>
            </div>
          `,
          confirmText: 'OK',
        })
      } else {
        toast.error(apiErrorMessage(err, 'Failed to delete class section.'))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const pagerDisabled = loading || exporting || Boolean(deletingId) || modalOpen || Boolean(studentsModalSection)

  return (
    <div className="wp-flat wp-cs">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Class Sections</h1>
          <p className="wp-flat__sub">
            Create sections, assign teachers, and manage schedules per school term.
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
            Add Section
          </button>
        </div>
      </div>

      <div className="wp-flat__stats" aria-label="Section counts by enrollment">
        <button
          type="button"
          className={`wp-flat__stat${enrollmentFilter === 'all' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Show all class sections"
          onClick={() => {
            setEnrollmentFilter('all')
            setPage(1)
          }}
        >
          <span className="wp-flat__stat-label">All sections</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.total}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--blue${enrollmentFilter === 'with_students' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Sections that already have at least one enrolled student"
          onClick={() => setEnrollmentStatus('with_students')}
        >
          <span className="wp-flat__stat-label">With enrollment</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.with_students}</span>
          )}
        </button>
        <button
          type="button"
          className={`wp-flat__stat wp-flat__stat--teal${enrollmentFilter === 'empty' ? ' is-selected' : ''}${!summaryReady ? ' is-loading' : ''}`}
          title="Sections with no enrolled students yet"
          onClick={() => setEnrollmentStatus('empty')}
        >
          <span className="wp-flat__stat-label">No enrollment yet</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.empty}</span>
          )}
        </button>
      </div>

      <div className="wp-flat__toolbar">
        <div className="wp-cs__term-filter">
          <FlatSearchSelect
            allowEmpty
            emptyOptionLabel="All terms"
            options={termFilterOptions}
            value={termFilter === 'all' ? '' : termFilter}
            onChange={(v) => {
              setTermFilter(v || 'all')
              setPage(1)
            }}
            disabled={loading}
            placeholder="All terms"
            searchPlaceholder="Search term or year"
            overlayPanel
            getValue={(t) => t.id}
            getLabel={(t) => t.name}
            getMeta={(t) => t.school_year}
            filterBySearch={filterTermBySearch}
            countLabel="term"
            className="wp-cs__term-select"
          />
        </div>
        <input
          type="search"
          className="form-control wp-flat__search"
          placeholder="Search subject, section, teacher, room…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search class sections"
        />
        <label className="wp-flat__records wp-cs__level-filter">
          Level
          <select
            className="form-select wp-flat__control"
            value={levelFilter}
            disabled={pagerDisabled}
            onChange={(e) => {
              setLevelFilter(e.target.value)
              setPage(1)
            }}
            aria-label="Filter by academic level"
          >
            <option value="all">All levels</option>
            <option value="college">College</option>
            <option value="shs">Senior High</option>
          </select>
        </label>
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
                <th>Subject</th>
                <th>Level</th>
                <th>Term</th>
                <th>Section</th>
                <th>Schedule</th>
                <th>Teacher</th>
                <th>Students</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={9} message="Loading…" />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="wp-flat__empty">No class sections found.</td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="wp-flat__num">{(meta.from || 1) + idx}</td>
                    <td>
                      <div className="wp-flat__actions">
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--edit wp-flat__btn--sm"
                          onClick={() => openEditModal(row)}
                          disabled={Boolean(deletingId)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                          onClick={() => openStudentsModal(row)}
                          title="View enrolled students"
                          disabled={Boolean(deletingId)}
                        >
                          View Students
                        </button>
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                          onClick={() => deleteSection(row)}
                          disabled={Boolean(deletingId)}
                        >
                          {deletingId === row.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className="wp-cs__code">{row.subject?.code || '—'}</span>
                      <span className="wp-cs__title">{row.subject?.title || ''}</span>
                    </td>
                    <td>{levelLabel(row.subject?.academic_level)}</td>
                    <td>{row.school_term?.name || '—'}</td>
                    <td>{row.section || '—'}</td>
                    <td>{scheduleText(row)}</td>
                    <td>{row.teacher?.name || '—'}</td>
                    <td>{row.enrollment_subjects_count ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="wp-flat__footer">
          <span className="wp-flat__footer-meta">
            {meta.total > 0
              ? `Showing ${meta.from}–${meta.to} of ${meta.total} sections`
              : '0 sections'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={pagerDisabled} onPageChange={setPage} />
        </div>
      </div>

      {studentsModalSection ? (
        <ClassSectionStudentsModal
          sectionRow={studentsModalSection}
          onClose={closeStudentsModal}
        />
      ) : null}

      {modalOpen ? (
        <ClassSectionFormModal
          section={modalSection}
          terms={terms}
          subjects={subjects.filter((s) => {
            if (s.is_active !== false) return true
            const editSubjectId = modalSection?.subject_id || modalSection?.subject?.id
            return editSubjectId != null && String(s.id) === String(editSubjectId)
          })}
          teachers={teachers}
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
