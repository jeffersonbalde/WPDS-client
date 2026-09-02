import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FiDownload, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import FlatPager from '../common/FlatPager'
import WestPrimeLoader from '../common/WestPrimeLoader'
import { apiErrorMessage } from '../../utils/apiError'
import { downloadExcelExport, excelExportError } from '../../utils/excelExport'
import { admissionYearLabel, levelLabel } from '../../utils/level'
import '../students/StudentRecordModal.css'
import '../../pages/StudentsManagePage.css'
import './ClassSectionStudentsModal.css'

const ANIM_MS = 220

function studentName(profile) {
  if (!profile) return '—'
  const middle = profile.middle_name ? ` ${profile.middle_name}` : ''
  return `${profile.last_name || ''}, ${profile.first_name || ''}${middle}`.trim() || '—'
}

function programLabel(admission) {
  const program = admission?.program
  if (!program) return '—'
  const code = String(program.code || '').trim()
  const name = String(program.name || '').trim()
  if (code && name && code.toUpperCase() !== name.toUpperCase()) return `${code} — ${name}`
  return code || name || '—'
}

function yearLevelLabel(admission) {
  return admissionYearLabel(admission)
}

function sortEnrollments(list) {
  return [...list].sort((a, b) => {
    const aSp = a.admission?.student_profile
    const bSp = b.admission?.student_profile
    const aKey = `${aSp?.last_name || ''}${aSp?.first_name || ''}`.toLowerCase()
    const bKey = `${bSp?.last_name || ''}${bSp?.first_name || ''}`.toLowerCase()
    return aKey.localeCompare(bKey)
  })
}

function sectionContext(section, sectionRow) {
  const code = section?.subject?.code || sectionRow.subject?.code || '—'
  const title = section?.subject?.title || sectionRow.subject?.title || ''
  const sectionLabel = section?.section || sectionRow.section || '—'
  const term = section?.school_term?.name || sectionRow.school_term?.name || '—'
  const level = levelLabel(section?.subject?.academic_level || sectionRow.subject?.academic_level)
  const subject = title ? `${code} — ${title}` : code
  return `${subject} · ${level} · Sec. ${sectionLabel} · ${term}`
}

export default function ClassSectionStudentsModal({ sectionRow, onClose }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const [anim, setAnim] = useState('enter')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [section, setSection] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const beginLeave = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnim('leave')
  }, [])

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    beginLeave()
  }, [beginLeave])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnim('open'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (anim !== 'leave') return undefined
    const timer = window.setTimeout(() => onClose?.(), ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [anim, onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [requestClose])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get(`/class-sections/${sectionRow.id}`)
        if (!cancelled) setSection(data)
      } catch (err) {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, 'Failed to load enrolled students.'))
          beginLeave()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [sectionRow.id, beginLeave])

  useEffect(() => {
    setPage(1)
  }, [search, perPage])

  const enrollments = useMemo(
    () => sortEnrollments(section?.enrollment_subjects || []),
    [section],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return enrollments
    return enrollments.filter((e) => {
      const sp = e.admission?.student_profile
      const admission = e.admission
      const haystack = [
        sp?.student_no,
        sp?.last_name,
        sp?.first_name,
        sp?.middle_name,
        programLabel(admission),
        yearLevelLabel(admission),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [enrollments, search])

  const total = filtered.length
  const lastPage = Math.max(1, Math.ceil(total / perPage) || 1)
  const safePage = Math.min(page, lastPage)
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const to = Math.min(safePage * perPage, total)
  const pageRows = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const meta = {
    current_page: safePage,
    last_page: lastPage,
    total,
    from,
    to,
  }

  useEffect(() => {
    if (page > lastPage) setPage(lastPage)
  }, [page, lastPage])

  async function exportExcel() {
    setExporting(true)
    try {
      const code = section?.subject?.code || sectionRow.subject?.code || 'section'
      await downloadExcelExport({
        api,
        url: `/class-sections/${sectionRow.id}/students/export`,
        fallbackFilename: `enrolled-students-${code}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      })
      toast.success('Enrolled students report exported to Excel.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to export enrolled students.'))
    } finally {
      setExporting(false)
    }
  }

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''
  const contextLine = sectionContext(section, sectionRow)

  return (
    <div
      className={`wp-srm wp-cs-students-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <div className="wp-cs-students-modal__head">
            <h2 id={titleId} className="wp-srm__title">
              Enrolled Students
            </h2>
            <p className="wp-cs-students-modal__context">{contextLine}</p>
          </div>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="wp-srm__body">
          {!loading && enrollments.length > 0 ? (
            <div className="wp-flat__toolbar wp-cs-students-modal__toolbar">
              <input
                type="search"
                className="form-control wp-flat__search"
                placeholder="Search student no., name, program…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search enrolled students"
              />
              <label className="wp-flat__records">
                Records
                <select
                  className="form-select wp-flat__control"
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  aria-label="Rows per page"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>
          ) : null}

          <div className="wp-cs-students-modal__content">
            {loading ? (
              <div className="wp-cs-students-modal__state">
                <WestPrimeLoader variant="inline" message="Loading students…" label="Loading" />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="wp-cs-students-modal__state wp-cs-students-modal__empty">
                <p>No students enrolled in this section yet.</p>
              </div>
            ) : (
              <div className="wp-flat__panel wp-cs-students-modal__panel">
                <div className="table-responsive wp-cs-students-modal__table-scroll">
                  <table className="wp-flat__table">
                    <thead>
                      <tr>
                        <th className="wp-flat__num">#</th>
                        <th>Student No.</th>
                        <th>Name</th>
                        <th>Program</th>
                        <th>Year Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="wp-flat__empty">No students match your search.</td>
                        </tr>
                      ) : (
                        pageRows.map((e, idx) => {
                          const sp = e.admission?.student_profile
                          return (
                            <tr key={e.id}>
                              <td className="wp-flat__num">{from + idx}</td>
                              <td>{sp?.student_no || '—'}</td>
                              <td>{studentName(sp)}</td>
                              <td>{programLabel(e.admission)}</td>
                              <td>{yearLevelLabel(e.admission)}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="wp-flat__footer wp-cs-students-modal__panel-footer">
                  <span className="wp-flat__footer-meta">
                    {total > 0
                      ? `Showing ${from}–${to} of ${total} students`
                      : '0 students'}
                    {lastPage > 1 ? ` · Page ${safePage} of ${lastPage}` : ''}
                  </span>
                  <FlatPager meta={meta} disabled={loading} onPageChange={setPage} />
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="wp-srm__footer wp-cs-students-modal__footer">
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--export"
            onClick={exportExcel}
            disabled={loading || exporting || enrollments.length === 0}
          >
            <FiDownload size={15} />
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={requestClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
