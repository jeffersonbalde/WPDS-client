import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiClipboard } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import FlatSearchSelect from '../components/common/FlatSearchSelect'
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard'
import { apiErrorMessage } from '../utils/apiError'
import { levelLabel, levelValue } from '../utils/level'
import { activeMajors, majorLabel } from '../utils/program'
import { wpConfirm } from '../utils/wpSwal'
import '../components/common/FlatSearchSelect.css'
import './ProfilePage.css'
import './AdmissionCreatePage.css'

const TABS = [
  { key: 'enrollment', label: 'Student & Term' },
  { key: 'placement', label: 'Placement' },
  { key: 'subjects', label: 'Subjects' },
]

function emptyForm() {
  return {
    student_profile_id: '',
    school_term_id: '',
    program_id: '',
    program_major_id: '',
    year_level: '',
    section: '',
    class_section_ids: [],
  }
}

function studentLabel(student) {
  return `${student.student_no} — ${student.last_name}, ${student.first_name}`
}

function programLabel(program) {
  return `${program.code} — ${program.name}`
}

function filterTermBySearch(term, query) {
  const name = String(term.name || '').toLowerCase()
  const year = String(term.school_year || '').toLowerCase()
  return name.includes(query) || year.includes(query)
}

function filterProgramBySearch(program, query) {
  const code = String(program.code || '').toLowerCase()
  const name = String(program.name || '').toLowerCase()
  return code.includes(query) || name.includes(query)
}

function filterMajorBySearch(major, query) {
  return String(majorLabel(major) || '').toLowerCase().includes(query)
}

function firstErrorTab(errors) {
  if (errors.student_profile_id || errors.school_term_id) return 'enrollment'
  if (errors.program_id || errors.program_major_id || errors.year_level || errors.section) return 'placement'
  return 'subjects'
}

function programMatchesStudent(program, student) {
  if (!program || !student) return false
  return levelValue(program.academic_level) === levelValue(student.academic_level)
}

export default function AdmissionCreatePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('enrollment')
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [allowLeave, setAllowLeave] = useState(false)

  const { confirmLeave, markSaved } = useUnsavedChangesGuard(dirty, allowLeave)

  const [terms, setTerms] = useState([])
  const [programs, setPrograms] = useState([])
  const [studentOptions, setStudentOptions] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [classSections, setClassSections] = useState([])
  const [loadingSections, setLoadingSections] = useState(false)
  const studentSearchSeq = useRef(0)

  const markDirty = useCallback(() => setDirty(true), [])

  useEffect(() => {
    let cancelled = false

    async function loadCatalog() {
      setLoadingRefs(true)
      try {
        const [termsRes, programsRes] = await Promise.all([
          api.get('/school-terms', { params: { status: 'active' } }),
          api.get('/programs'),
        ])
        if (cancelled) return
        const termList = Array.isArray(termsRes.data) ? termsRes.data : (termsRes.data?.data || [])
        const programList = Array.isArray(programsRes.data) ? programsRes.data : (programsRes.data?.data || [])
        setTerms(termList.filter((t) => t.is_active !== false))
        setPrograms(programList.filter((p) => p.is_active !== false))
      } catch (err) {
        if (!cancelled) toast.error(apiErrorMessage(err, 'Failed to load form options.'))
      } finally {
        if (!cancelled) setLoadingRefs(false)
      }
    }

    async function loadStudents() {
      setLoadingStudents(true)
      try {
        const { data } = await api.get('/students', {
          params: { per_page: 25, picker: 1 },
        })
        if (cancelled) return
        setStudentOptions(data.data || data || [])
      } catch (err) {
        if (!cancelled) toast.error(apiErrorMessage(err, 'Failed to load students.'))
      } finally {
        if (!cancelled) setLoadingStudents(false)
      }
    }

    loadCatalog()
    loadStudents()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!form.school_term_id) {
      setClassSections([])
      return undefined
    }

    let cancelled = false
    async function loadSections() {
      setLoadingSections(true)
      try {
        const { data } = await api.get('/class-sections', {
          params: { school_term_id: form.school_term_id, per_page: 100 },
        })
        if (!cancelled) setClassSections(data.data || data || [])
      } catch (err) {
        if (!cancelled) {
          setClassSections([])
          toast.error(apiErrorMessage(err, 'Failed to load class sections.'))
        }
      } finally {
        if (!cancelled) setLoadingSections(false)
      }
    }
    loadSections()
    return () => { cancelled = true }
  }, [form.school_term_id])

  const fetchStudents = useCallback(async (query) => {
    const requestId = ++studentSearchSeq.current
    setLoadingStudents(true)
    try {
      const { data } = await api.get('/students', {
        params: { search: query || undefined, per_page: 25, picker: 1 },
      })
      if (requestId !== studentSearchSeq.current) return
      setStudentOptions(data.data || data || [])
    } catch (err) {
      if (requestId !== studentSearchSeq.current) return
      setStudentOptions([])
      toast.error(apiErrorMessage(err, 'Failed to search students.'))
    } finally {
      if (requestId === studentSearchSeq.current) setLoadingStudents(false)
    }
  }, [])

  const filteredPrograms = useMemo(() => {
    if (!selectedStudent) return []
    const studentLevel = levelValue(selectedStudent.academic_level)
    return programs.filter((p) => levelValue(p.academic_level) === studentLevel)
  }, [programs, selectedStudent])

  const selectedProgram = useMemo(
    () => filteredPrograms.find((p) => String(p.id) === String(form.program_id))
      || programs.find((p) => String(p.id) === String(form.program_id))
      || null,
    [filteredPrograms, programs, form.program_id],
  )

  const programMajors = useMemo(() => {
    if (!selectedProgram) return []
    const list = activeMajors(selectedProgram)
    if (form.program_major_id && !list.some((m) => String(m.id) === String(form.program_major_id))) {
      const extra = (selectedProgram.majors || []).find((m) => String(m.id) === String(form.program_major_id))
      if (extra) return [...list, extra]
    }
    return list
  }, [selectedProgram, form.program_major_id])

  const maxYearLevel = useMemo(() => {
    const studentLevel = levelValue(selectedStudent?.academic_level)
    if (studentLevel === 'shs') return 2
    if (selectedProgram?.duration_years) return Number(selectedProgram.duration_years)
    return 4
  }, [selectedStudent, selectedProgram])

  async function goBackToList() {
    const ok = await confirmLeave()
    if (!ok) return
    navigate('/admissions-manage')
  }

  function setField(key, value) {
    markDirty()
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'program_id') next.program_major_id = ''
      return next
    })
    setErrors((prev) => {
      if (!prev[key]) return prev
      const nextErr = { ...prev }
      delete nextErr[key]
      return nextErr
    })
  }

  function clearPlacementFields() {
    return {
      program_id: '',
      program_major_id: '',
      year_level: '',
      section: '',
      class_section_ids: [],
    }
  }

  function pickTerm(id) {
    markDirty()
    setForm((prev) => ({
      ...prev,
      school_term_id: id ? String(id) : '',
      ...clearPlacementFields(),
    }))
    setErrors((prev) => {
      const nextErr = { ...prev }
      delete nextErr.school_term_id
      delete nextErr.program_id
      delete nextErr.program_major_id
      delete nextErr.year_level
      delete nextErr.section
      delete nextErr.class_section_ids
      return nextErr
    })
  }

  function pickStudent(id) {
    markDirty()
    const student = studentOptions.find((s) => String(s.id) === String(id)) || null
    setSelectedStudent(student)
    setForm((prev) => ({
      ...prev,
      student_profile_id: id ? String(id) : '',
      ...clearPlacementFields(),
    }))
    setErrors((prev) => {
      const nextErr = { ...prev }
      delete nextErr.student_profile_id
      delete nextErr.program_id
      delete nextErr.program_major_id
      delete nextErr.year_level
      delete nextErr.section
      return nextErr
    })
  }

  function toggleClassSection(id) {
    markDirty()
    setForm((prev) => {
      const exists = prev.class_section_ids.includes(id)
      return {
        ...prev,
        class_section_ids: exists
          ? prev.class_section_ids.filter((x) => x !== id)
          : [...prev.class_section_ids, id],
      }
    })
    setErrors((prev) => {
      if (!prev.class_section_ids) return prev
      const nextErr = { ...prev }
      delete nextErr.class_section_ids
      return nextErr
    })
  }

  function validateAll() {
    const next = {}
    if (!form.student_profile_id) next.student_profile_id = 'Student is required.'
    if (!form.school_term_id) next.school_term_id = 'School term is required.'
    if (!form.program_id) next.program_id = 'Program is required.'
    if (!String(form.year_level ?? '').trim()) next.year_level = 'Year level is required.'
    const year = Number(form.year_level)
    if (String(form.year_level ?? '').trim() && (Number.isNaN(year) || year < 1 || year > maxYearLevel)) {
      next.year_level = `Year level must be between 1 and ${maxYearLevel}.`
    }
    if (selectedProgram && !programMatchesStudent(selectedProgram, selectedStudent)) {
      next.program_id = 'Program must match the student\'s academic level.'
    }
    if (!String(form.section ?? '').trim()) next.section = 'Section is required.'
    if (selectedProgram && programMajors.length > 0 && !form.program_major_id) {
      next.program_major_id = 'Select a major for this program.'
    }
    if (!form.school_term_id) {
      next.class_section_ids = 'Select a school term first.'
    } else if (!loadingSections && classSections.length === 0) {
      next.class_section_ids = 'No class sections available for this term.'
    } else if (!form.class_section_ids.length) {
      next.class_section_ids = 'Select at least one class section.'
    }
    return next
  }

  async function submit(e) {
    e.preventDefault()
    const next = validateAll()
    setErrors(next)
    if (Object.keys(next).length) {
      setTab(firstErrorTab(next))
      return
    }

    const studentName = selectedStudent
      ? `${selectedStudent.last_name}, ${selectedStudent.first_name}`
      : 'the student'
    const term = terms.find((t) => String(t.id) === String(form.school_term_id))
    const program = selectedProgram
    const termLabel = term?.name || 'selected term'
    const programLabelText = program ? `${program.code} — ${program.name}` : 'selected program'

    const confirmed = await wpConfirm({
      icon: 'question',
      title: 'Create this admission?',
      text: `Enroll ${studentName} for ${termLabel} in ${programLabelText}?`,
      confirmText: 'Create admission',
      focusCancel: false,
    })
    if (!confirmed) return

    setSaving(true)
    try {
      await api.post('/admissions', {
        student_profile_id: Number(form.student_profile_id),
        school_term_id: Number(form.school_term_id),
        program_id: Number(form.program_id),
        program_major_id: form.program_major_id ? Number(form.program_major_id) : null,
        year_level: Number(form.year_level),
        section: form.section.trim() || null,
        class_section_ids: form.class_section_ids.map(Number),
      })
      toast.success('Admission created. Student placement updated.')
      markSaved()
      setDirty(false)
      setAllowLeave(true)
      navigate('/admissions-manage', { replace: true })
    } catch (err) {
      const data = err?.response?.data
      if (data?.errors) {
        const mapped = {}
        Object.entries(data.errors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setErrors(mapped)
        setTab(firstErrorTab(mapped))
      } else {
        toast.error(apiErrorMessage(err, 'Failed to create admission.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const activeLabel = TABS.find((t) => t.key === tab)?.label || 'Create Admission'
  const formSaving = saving

  return (
    <div className="wp-profile wp-adm-create">
      <div className="wp-profile__header">
        <div>
          <button type="button" className="wp-adm-create__back" onClick={goBackToList}>
            <FiArrowLeft /> Back to Admissions
          </button>
          <h1 className="wp-profile__title">Create Admission</h1>
          <p className="wp-profile__sub">
            Enroll a student for the selected term.
          </p>
          {dirty ? (
            <div className="wp-profile__badge-row">
              <span className="wp-profile__chip is-warn">Unsaved progress</span>
            </div>
          ) : null}
        </div>
      </div>

      <form className="wp-profile__layout" onSubmit={submit} noValidate autoComplete="off">
        <nav className="wp-profile__tabs" aria-label="Create admission sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`wp-profile__tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="wp-profile__panel">
          <h2 className="wp-profile__panel-title">{activeLabel}</h2>

          {tab === 'enrollment' ? (
            <div className="wp-adm-create__grid">
              <div className="wp-adm-create__field wp-adm-create__field--full">
                <FlatSearchSelect
                  label="Student"
                  required
                  embedded
                  serverSearch
                  loading={loadingStudents}
                  options={studentOptions}
                  selectedOption={selectedStudent}
                  value={form.student_profile_id}
                  onChange={pickStudent}
                  onSearchQueryChange={fetchStudents}
                  disabled={formSaving}
                  placeholder="Select student"
                  searchPlaceholder="Search student no. or name"
                  getValue={(s) => s.id}
                  getLabel={studentLabel}
                  getMeta={(s) => levelLabel(s.academic_level)}
                  countLabel="student"
                  invalid={Boolean(errors.student_profile_id)}
                />
                {errors.student_profile_id ? <span className="wp-adm-create__error">{errors.student_profile_id}</span> : null}
              </div>

              <div className="wp-adm-create__field wp-adm-create__field--full">
                <FlatSearchSelect
                  label="School term"
                  required
                  embedded
                  loading={loadingRefs}
                  options={terms}
                  value={form.school_term_id}
                  onChange={pickTerm}
                  disabled={formSaving}
                  placeholder="Select term"
                  searchPlaceholder="Search term or school year"
                  getValue={(t) => t.id}
                  getLabel={(t) => t.name}
                  getMeta={(t) => t.school_year}
                  filterBySearch={filterTermBySearch}
                  countLabel="term"
                  invalid={Boolean(errors.school_term_id)}
                />
                {errors.school_term_id ? <span className="wp-adm-create__error">{errors.school_term_id}</span> : null}
              </div>
            </div>
          ) : null}

          {tab === 'placement' ? (
            !form.student_profile_id || !form.school_term_id ? (
              <p className="wp-adm-create__empty">Select student and school term first.</p>
            ) : (
            <div className="wp-adm-create__grid" key={`placement-${form.student_profile_id}-${form.school_term_id}`}>
              <div className="wp-adm-create__field wp-adm-create__field--full">
                <FlatSearchSelect
                  label="Program"
                  required
                  embedded
                  loading={loadingRefs}
                  options={filteredPrograms}
                  value={form.program_id}
                  onChange={(v) => setField('program_id', v)}
                  disabled={formSaving}
                  placeholder="Select program"
                  searchPlaceholder="Search code or program name"
                  getValue={(p) => p.id}
                  getLabel={programLabel}
                  getMeta={(p) => levelLabel(p.academic_level)}
                  filterBySearch={filterProgramBySearch}
                  countLabel="program"
                  invalid={Boolean(errors.program_id)}
                />
                {errors.program_id ? <span className="wp-adm-create__error">{errors.program_id}</span> : null}
              </div>

              {programMajors.length > 0 ? (
                <div className="wp-adm-create__field wp-adm-create__field--full">
                  <FlatSearchSelect
                    label="Major"
                    required
                    embedded
                    options={programMajors}
                    value={form.program_major_id}
                    onChange={(v) => setField('program_major_id', v)}
                    disabled={formSaving || !form.program_id}
                    placeholder="Select major"
                    searchPlaceholder="Search major"
                    getValue={(m) => m.id}
                    getLabel={majorLabel}
                    filterBySearch={filterMajorBySearch}
                    countLabel="major"
                    invalid={Boolean(errors.program_major_id)}
                  />
                  {errors.program_major_id ? <span className="wp-adm-create__error">{errors.program_major_id}</span> : null}
                </div>
              ) : null}

              <label className="wp-adm-create__field">
                <span className="wp-adm-create__label">Year level <span className="wp-adm-create__req">*</span></span>
                <input
                  type="number"
                  min={1}
                  max={maxYearLevel}
                  className={`form-control${errors.year_level ? ' is-invalid' : ''}`}
                  value={form.year_level}
                  onChange={(e) => setField('year_level', e.target.value)}
                  placeholder="Enter year level"
                  autoComplete="off"
                  disabled={formSaving}
                />
                {errors.year_level ? <span className="wp-adm-create__error">{errors.year_level}</span> : null}
              </label>

              <label className="wp-adm-create__field">
                <span className="wp-adm-create__label">Section <span className="wp-adm-create__req">*</span></span>
                <input
                  className={`form-control${errors.section ? ' is-invalid' : ''}`}
                  value={form.section}
                  onChange={(e) => setField('section', e.target.value)}
                  placeholder="Enter section"
                  autoComplete="off"
                  disabled={formSaving}
                />
                {errors.section ? <span className="wp-adm-create__error">{errors.section}</span> : null}
              </label>
            </div>
            )
          ) : null}

          {tab === 'subjects' ? (
            <div className="wp-adm-create__subjects">
              {!form.school_term_id ? (
                <p className="wp-adm-create__empty">Select a school term first.</p>
              ) : loadingSections ? (
                <p className="wp-adm-create__empty wp-adm-create__empty--loading">
                  <span className="wp-adm-create__spinner" aria-hidden />
                  Loading class sections…
                </p>
              ) : classSections.length === 0 ? (
                <p className="wp-adm-create__empty">No class sections for this term.</p>
              ) : (
                <div className="wp-adm-create__sections">
                  {classSections.map((section) => (
                    <label key={section.id} className="wp-adm-create__section-item">
                      <input
                        type="checkbox"
                        checked={form.class_section_ids.includes(section.id)}
                        onChange={() => toggleClassSection(section.id)}
                        disabled={formSaving}
                      />
                      <span className="wp-adm-create__section-text">
                        <strong>{section.subject?.code || 'Subject'}</strong>
                        {section.subject?.title ? ` — ${section.subject.title}` : ''}
                        {section.section ? ` · Sec ${section.section}` : ''}
                        {section.teacher?.name ? ` · ${section.teacher.name}` : ''}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {errors.class_section_ids ? (
                <span className="wp-adm-create__error wp-adm-create__error--block">{errors.class_section_ids}</span>
              ) : null}
            </div>
          ) : null}

          <div className="wp-adm-create__panel-foot">
            <button type="button" className="wp-profile__btn wp-profile__btn--ghost" onClick={goBackToList} disabled={formSaving}>
              Cancel
            </button>
            <button type="submit" className="wp-profile__btn wp-profile__btn--primary" disabled={formSaving || loadingRefs}>
              <FiClipboard />
              {saving ? 'Creating…' : 'Create Admission'}
            </button>
          </div>
        </section>
      </form>
    </div>
  )
}
