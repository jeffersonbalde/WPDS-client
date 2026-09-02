import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiDownload, FiLoader, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatPager from '../components/common/FlatPager'
import PageLoadingRow from '../components/common/PageLoadingRow'
import ProgramSearchSelect from '../components/common/ProgramSearchSelect'
import CurriculumAddModal from '../components/curriculum/CurriculumAddModal'
import { apiErrorMessage } from '../utils/apiError'
import { downloadExcelExport, excelExportError } from '../utils/excelExport'
import { curriculumRemoveDialogHtml } from '../utils/subjectUsage'
import { wpConfirm } from '../utils/wpSwal'
import './StudentsManagePage.css'
import './CurriculumManagePage.css'

const SEMESTER_LABELS = {
  1: '1st Semester',
  2: '2nd Semester',
  3: 'Summer',
}

function levelValue(level) {
  if (level && typeof level === 'object' && level.value) return String(level.value)
  return String(level || '')
}

function levelLabel(level) {
  const v = levelValue(level)
  if (v === 'college') return 'College'
  if (v === 'shs') return 'Senior High'
  return v || '—'
}

function groupKey(year, semester) {
  return `${year}-${semester}`
}

function groupLabel(year, semester) {
  return `Year ${year} · ${SEMESTER_LABELS[semester] || `Sem ${semester}`}`
}

export default function CurriculumManagePage() {
  const [programs, setPrograms] = useState([])
  const [subjects, setSubjects] = useState([])
  const [programId, setProgramId] = useState('')
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState({ total: 0, years: 0, units: 0 })
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [loadingPrograms, setLoadingPrograms] = useState(true)
  const [loading, setLoading] = useState(false)
  const [summaryReady, setSummaryReady] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalPrefill, setModalPrefill] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const selected = useMemo(
    () => programs.find((p) => String(p.id) === String(programId)) || selectedProgram,
    [programs, programId, selectedProgram],
  )

  const programLevel = levelValue(selected?.academic_level)

  const groups = useMemo(() => {
    const map = new Map()
    items.forEach((row) => {
      const key = groupKey(row.year_level, row.semester)
      if (!map.has(key)) {
        map.set(key, {
          year: Number(row.year_level),
          semester: Number(row.semester),
          rows: [],
          units: 0,
        })
      }
      const group = map.get(key)
      group.rows.push(row)
      group.units += Number(row.subject?.units) || 0
    })
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.semester - b.semester
    })
  }, [items])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const yearDiff = Number(a.year_level) - Number(b.year_level)
      if (yearDiff !== 0) return yearDiff
      const semDiff = Number(a.semester) - Number(b.semester)
      if (semDiff !== 0) return semDiff
      return String(a.subject?.code || '').localeCompare(String(b.subject?.code || ''))
    })
  }, [items])

  const listMeta = useMemo(() => {
    const total = sortedItems.length
    const lastPage = Math.max(1, Math.ceil(total / perPage) || 1)
    const currentPage = Math.min(page, lastPage)
    const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1
    const to = Math.min(total, currentPage * perPage)
    return {
      current_page: currentPage,
      last_page: lastPage,
      total,
      from,
      to,
    }
  }, [sortedItems, page, perPage])

  const paginatedItems = useMemo(() => {
    const start = (listMeta.current_page - 1) * perPage
    return sortedItems.slice(start, start + perPage)
  }, [sortedItems, listMeta.current_page, perPage])

  const groupStats = useMemo(() => {
    const map = new Map()
    groups.forEach((group) => map.set(groupKey(group.year, group.semester), group))
    return map
  }, [groups])

  const loadPrograms = useCallback(async () => {
    setLoadingPrograms(true)
    try {
      const { data } = await api.get('/programs')
      const list = Array.isArray(data) ? data : (data?.data || [])
      const active = list.filter((p) => p.is_active !== false)
      setPrograms(active)
      setProgramId((current) => {
        if (current && active.some((p) => String(p.id) === String(current))) return current
        return active.length ? String(active[0].id) : ''
      })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load programs.'))
    } finally {
      setLoadingPrograms(false)
    }
  }, [])

  const loadSubjects = useCallback(async () => {
    if (!programLevel) {
      setSubjects([])
      return
    }
    try {
      const { data } = await api.get('/subjects', {
        params: { academic_level: programLevel, status: 'active' },
      })
      setSubjects(Array.isArray(data) ? data : (data?.data || []))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load subjects.'))
    }
  }, [programLevel])

  const loadCurriculum = useCallback(async () => {
    if (!programId) {
      setItems([])
      setSummary({ total: 0, years: 0, units: 0 })
      setSelectedProgram(null)
      setSummaryReady(false)
      return
    }
    setLoading(true)
    setSummaryReady(false)
    try {
      const { data } = await api.get('/curriculum', { params: { program_id: programId } })
      setItems(Array.isArray(data?.items) ? data.items : [])
      setSummary(data?.summary || { total: 0, years: 0, units: 0 })
      setSelectedProgram(data?.program || null)
      setSummaryReady(true)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load curriculum.'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    loadPrograms()
  }, [loadPrograms])

  useEffect(() => {
    loadSubjects()
  }, [loadSubjects])

  useEffect(() => {
    loadCurriculum()
  }, [loadCurriculum])

  useEffect(() => {
    setModalOpen(false)
    setModalPrefill(null)
    setPage(1)
  }, [programId])

  function openAddModal(prefill = null) {
    if (!programId) return
    setModalPrefill(prefill)
    setModalOpen(true)
  }

  async function removeItem(row) {
    const label = `${row.subject?.code || 'Subject'} — ${row.subject?.title || ''}`.trim()
    let usage = null
    try {
      const { data } = await api.get(`/curriculum/${row.id}/usage`)
      usage = data
    } catch {
      usage = null
    }

    const lead = `${label} will be removed from ${groupLabel(row.year_level, row.semester)}.`
    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Remove from curriculum?',
      html: curriculumRemoveDialogHtml(lead, usage),
      confirmText: 'Remove',
      danger: true,
      wide: Boolean(usage?.has_enrolled_students),
      focusCancel: Boolean(usage?.has_enrolled_students),
    })
    if (!ok) return

    setRemovingId(row.id)
    try {
      await api.delete(`/curriculum/${row.id}`)
      toast.success('Curriculum item removed.')
      await loadCurriculum()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to remove curriculum item.'))
    } finally {
      setRemovingId(null)
    }
  }

  const durationYears = selected?.duration_years || (programLevel === 'shs' ? 2 : 4)

  async function downloadExport(params, setBusy, successMessage) {
    setBusy(true)
    try {
      await downloadExcelExport({
        api,
        url: '/curriculum/export',
        params,
      })
      toast.success(successMessage)
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export curriculum.'))
    } finally {
      setBusy(false)
    }
  }

  function exportProgram() {
    if (!programId) return
    downloadExport(
      { program_id: programId },
      setExporting,
      `Curriculum exported for ${selected?.code || 'program'}.`,
    )
  }

  function exportAllPrograms() {
    downloadExport(
      { scope: 'all' },
      setExportingAll,
      'Curriculum exported for all programs.',
    )
  }

  return (
    <div className="wp-flat wp-curr">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Curriculum</h1>
          <p className="wp-flat__sub">
            View subjects assigned to each program by year and semester.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--secondary"
            onClick={() => {
              loadPrograms()
              loadSubjects()
              loadCurriculum()
            }}
            disabled={loading || loadingPrograms || exporting || exportingAll}
          >
            <FiRefreshCw className={loading || loadingPrograms ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--export"
            onClick={exportProgram}
            disabled={!programId || loading || exporting || exportingAll}
          >
            <FiDownload size={15} />
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--export"
            onClick={exportAllPrograms}
            disabled={loadingPrograms || exporting || exportingAll}
            title="Export curriculum for all active programs"
          >
            <FiDownload size={15} />
            {exportingAll ? 'Exporting…' : 'Export All'}
          </button>
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--primary"
            onClick={() => openAddModal()}
            disabled={!programId || loadingPrograms || exporting || exportingAll}
          >
            <FiPlus size={16} />
            Add Subject
          </button>
        </div>
      </div>

      <div className="wp-flat__stats" aria-label="Curriculum counts">
        <div className={`wp-flat__stat${!summaryReady || loading ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Subjects</span>
          {!summaryReady || loading ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.total}</span>
          )}
        </div>
        <div className={`wp-flat__stat wp-flat__stat--blue${!summaryReady || loading ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Years used</span>
          {!summaryReady || loading ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.years}</span>
          )}
        </div>
        <div className={`wp-flat__stat wp-flat__stat--teal${!summaryReady || loading ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Total units</span>
          {!summaryReady || loading ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{summary.units}</span>
          )}
        </div>
      </div>

      <div className="wp-flat__toolbar wp-curr__toolbar">
        <ProgramSearchSelect
          programs={programs}
          value={programId}
          onChange={setProgramId}
          disabled={loadingPrograms}
          loading={loadingPrograms}
        />
        {selected ? (
          <span className="wp-curr__toolbar-meta">
            {levelLabel(selected.academic_level)} · {durationYears} year{durationYears === 1 ? '' : 's'}
          </span>
        ) : null}
        {programId && items.length > 0 ? (
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
        ) : null}
      </div>

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table">
            <thead>
              <tr>
                <th className="wp-flat__num">#</th>
                <th>Code</th>
                <th>Title</th>
                <th>Units</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!programId ? (
                <tr><td colSpan={5} className="wp-flat__empty">Select a program to view its curriculum.</td></tr>
              ) : loading ? (
                <PageLoadingRow colSpan={5} message="Loading…" />
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wp-flat__empty">
                    No subjects assigned yet. Click <strong>Add Subject</strong> to assign catalog subjects.
                  </td>
                </tr>
              ) : (
                (() => {
                  let lastGroup = null
                  let rowCounter = listMeta.from - 1
                  return paginatedItems.flatMap((row) => {
                    const key = groupKey(row.year_level, row.semester)
                    const group = groupStats.get(key)
                    const out = []
                    if (key !== lastGroup) {
                      lastGroup = key
                      out.push(
                        <tr key={`head-${key}`} className="wp-curr__group-row">
                          <td colSpan={5}>
                            <div className="wp-curr__group-bar">
                              <span className="wp-curr__group-label">{groupLabel(row.year_level, row.semester)}</span>
                              <span className="wp-curr__group-count">
                                {group?.rows.length || 0} subject{(group?.rows.length || 0) === 1 ? '' : 's'} · {(group?.units || 0).toFixed(0)} units
                              </span>
                              <button
                                type="button"
                                className="wp-flat__btn wp-flat__btn--sm wp-flat__btn--edit"
                                onClick={() => openAddModal({ year_level: row.year_level, semester: row.semester })}
                              >
                                <FiPlus size={13} />
                                Add here
                              </button>
                            </div>
                          </td>
                        </tr>,
                      )
                    }
                    rowCounter += 1
                    const busy = removingId === row.id
                    out.push(
                      <tr key={row.id} className={busy ? 'is-removing' : ''}>
                        <td className="wp-flat__num">{rowCounter}</td>
                        <td>{row.subject?.code || '—'}</td>
                        <td>{row.subject?.title || '—'}</td>
                        <td>{row.subject?.units != null ? Number(row.subject.units).toFixed(2) : '—'}</td>
                        <td>
                          <div className="wp-flat__actions">
                            <button
                              type="button"
                              className="wp-flat__btn wp-flat__btn--sm wp-flat__btn--danger"
                              onClick={() => removeItem(row)}
                              disabled={busy}
                            >
                              {busy ? <FiLoader size={14} className="is-spin" /> : <FiTrash2 size={14} />}
                              {busy ? 'Removing…' : 'Remove'}
                            </button>
                          </div>
                        </td>
                      </tr>,
                    )
                    return out
                  })
                })()
              )}
            </tbody>
          </table>
        </div>

        <div className="wp-flat__footer">
          <span className="wp-flat__footer-meta">
            {selected
              ? `${selected.code} — ${selected.name} · ${summary.total} subject${summary.total === 1 ? '' : 's'} · ${summary.units} units`
              : 'No program selected'}
            {listMeta.total > 0
              ? ` · Showing ${listMeta.from}–${listMeta.to} of ${listMeta.total}`
              : ''}
            {listMeta.last_page > 1 ? ` · Page ${listMeta.current_page} of ${listMeta.last_page}` : ''}
          </span>
          <FlatPager meta={listMeta} disabled={loading} onPageChange={setPage} />
        </div>
      </div>

      {modalOpen ? (
        <CurriculumAddModal
          program={selected}
          programId={programId}
          items={items}
          subjects={subjects}
          initial={modalPrefill || undefined}
          onClose={() => {
            setModalOpen(false)
            setModalPrefill(null)
          }}
          onSaved={() => {
            setModalOpen(false)
            setModalPrefill(null)
            loadCurriculum()
          }}
        />
      ) : null}
    </div>
  )
}
