import { useEffect, useMemo, useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import PageLoadingRow from '../components/common/PageLoadingRow'
import { apiErrorMessage } from '../utils/apiError'
import './StudentsManagePage.css'
import './CurriculumPage.css'

function semesterLabel(value) {
  const n = Number(value)
  if (n === 1) return '1st Sem'
  if (n === 2) return '2nd Sem'
  if (n === 3) return 'Summer'
  return value ?? '—'
}

function remarkTone(remarks) {
  const r = String(remarks || '').toUpperCase()
  if (r.includes('PASS')) return 'pass'
  if (r.includes('FAIL') || r === 'INC' || r.includes('DROP')) return 'fail'
  return 'muted'
}

export default function CurriculumPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [programId, setProgramId] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = {}
        if (programId) params.program_id = programId
        const { data: payload } = await api.get('/my/curriculum', { params })
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) toast.error(apiErrorMessage(err, 'Failed to load curriculum.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [programId, reloadTick])

  const programs = data?.programs || []
  const items = useMemo(() => data?.items || [], [data])
  const summaryReady = !loading && data != null
  const selectedProgramId = programId ?? data?.selected_program_id ?? ''
  const viewingProgram = programs.find((p) => String(p.id) === String(selectedProgramId))
  const viewingNonCurrent = viewingProgram && !viewingProgram.is_current

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const code = String(item.subject?.code || '').toLowerCase()
      const title = String(item.subject?.title || '').toLowerCase()
      const term = String(item.taken?.term_name || '').toLowerCase()
      return code.includes(q) || title.includes(q) || term.includes(q)
    })
  }, [items, search])

  return (
    <div className="wp-flat wp-curr">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Course Curriculum</h1>
          <p className="wp-flat__sub">
            Reference view of your program curriculum with the terms and grades on record.
            Contact the Registrar for official confirmation.
          </p>
        </div>
      </div>

      <div className="wp-flat__stats" aria-label="Program summary">
        <div className={`wp-flat__stat wp-flat__stat--blue${!summaryReady ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Program</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value" style={{ fontSize: '1.05rem' }}>
              {data?.program?.code || '—'}
            </span>
          )}
        </div>
        <div className={`wp-flat__stat${!summaryReady ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Name</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {data?.program?.name || '—'}
              {data?.program_major
                ? ` · ${data.program_major.label || data.program_major.name}`
                : ''}
            </span>
          )}
        </div>
        <div className={`wp-flat__stat wp-flat__stat--teal${!summaryReady ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Subjects</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{data?.summary?.total ?? items.length}</span>
          )}
        </div>
        <div className={`wp-flat__stat wp-flat__stat--slate${!summaryReady ? ' is-loading' : ''}`}>
          <span className="wp-flat__stat-label">Total Units</span>
          {!summaryReady ? (
            <span className="wp-flat__stat-skeleton" aria-hidden />
          ) : (
            <span className="wp-flat__stat-value">{data?.summary?.units ?? '—'}</span>
          )}
        </div>
      </div>

      <div className="wp-flat__toolbar">
        <label className="wp-curr__course-picker">
          <span>Course</span>
          <select
            className="form-select wp-flat__control"
            value={selectedProgramId}
            disabled={loading}
            onChange={(e) => setProgramId(Number(e.target.value))}
            aria-label="Select course"
          >
            {programs.length === 0 ? (
              <option value="">—</option>
            ) : (
              programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}{p.is_current ? ' (current)' : ''}
                </option>
              ))
            )}
          </select>
        </label>
        <input
          type="search"
          className="form-control wp-flat__search"
          placeholder="Search course code, title, or term…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search curriculum"
        />
        <button
          type="button"
          className="wp-flat__btn wp-flat__btn--secondary"
          onClick={() => setReloadTick((t) => t + 1)}
          disabled={loading}
          title="Reload"
        >
          <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
          Refresh
        </button>
      </div>

      {viewingNonCurrent ? (
        <div className="wp-curr__note">
          You are viewing a previous program’s curriculum. Your current program is{' '}
          <strong>{programs.find((p) => p.is_current)?.code || '—'}</strong>.
        </div>
      ) : null}

      <div className="wp-flat__panel">
        <div className="table-responsive">
          <table className="wp-flat__table wp-curr__table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Semester</th>
                <th>Course Code</th>
                <th>Descriptive Title</th>
                <th>Units</th>
                <th>Term / Semester Taken</th>
                <th>Course</th>
                <th>Year</th>
                <th>Final Grade</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={10} message="Loading…" />
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="wp-flat__empty">
                    {items.length === 0 ? 'No curriculum items.' : 'No subjects match your search.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const taken = item.taken
                  return (
                    <tr key={item.id}>
                      <td>{item.year_level}</td>
                      <td>{semesterLabel(item.semester)}</td>
                      <td className="wp-curr__code">{item.subject?.code || '—'}</td>
                      <td>{item.subject?.title || '—'}</td>
                      <td>{item.subject?.units ?? '—'}</td>
                      <td className="wp-curr__taken">{taken?.term_name || '—'}</td>
                      <td className="wp-curr__taken">{taken?.program_code || '—'}</td>
                      <td className="wp-curr__taken">{taken?.year_level ?? '—'}</td>
                      <td className="wp-curr__grade">{taken?.final_grade ?? '—'}</td>
                      <td>
                        {taken?.remarks ? (
                          <span className={`wp-curr__pill wp-curr__pill--${remarkTone(taken.remarks)}`}>
                            {taken.remarks}
                          </span>
                        ) : (
                          '—'
                        )}
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
            {filteredItems.length === items.length
              ? `${items.length} subject${items.length === 1 ? '' : 's'}`
              : `Showing ${filteredItems.length} of ${items.length} subjects`}
          </span>
        </div>
      </div>
    </div>
  )
}
