import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiLoader, FiPlus, FiTrash2, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { apiErrorMessage } from '../../utils/apiError'
import { isSameProgramCode, isSameProgramName, normalizeProgramName, programLevel } from '../../utils/program'
import { wpAlert, wpConfirm, wpConfirmDiscard, wpWithLoading } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'

const ANIM_MS = 220

const TRACKS = {
  college: [
    { value: 'degree', label: 'Degree' },
    { value: 'associate', label: 'Associate' },
  ],
  shs: [
    { value: 'academic', label: 'Academic' },
    { value: 'tvl', label: 'TVL' },
  ],
}

function newMajorRow() {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id: null,
    code: '',
    name: '',
    is_active: true,
  }
}

function majorsFromProgram(program) {
  const list = Array.isArray(program?.majors) ? program.majors : []
  return list.map((m) => ({
    key: `id-${m.id}`,
    id: m.id,
    code: m.code || '',
    name: m.name || '',
    is_active: m.is_active !== false,
  }))
}

function emptyForm() {
  return {
    code: '',
    name: '',
    academic_level: 'college',
    track_type: 'degree',
    duration_years: 4,
    is_active: true,
    majors: [],
  }
}

function formFromProgram(program) {
  if (!program) return emptyForm()
  const level = programLevel(program.academic_level) === 'shs' ? 'shs' : 'college'
  return {
    code: program.code || '',
    name: program.name || '',
    academic_level: level,
    track_type: program.track_type || (level === 'shs' ? 'academic' : 'degree'),
    duration_years: program.duration_years ?? (level === 'shs' ? 2 : 4),
    is_active: program.is_active !== false,
    majors: majorsFromProgram(program),
  }
}

function snapshot(form) {
  return JSON.stringify({
    code: String(form.code || '').trim().toUpperCase(),
    name: String(form.name || '').trim().replace(/\s+/g, ' '),
    academic_level: form.academic_level,
    track_type: form.track_type,
    duration_years: Number(form.duration_years) || '',
    is_active: Boolean(form.is_active),
    majors: (form.majors || []).map((m) => ({
      id: m.id || null,
      code: String(m.code || '').trim().toUpperCase(),
      name: String(m.name || '').trim(),
      is_active: m.is_active !== false,
    })),
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function majorUsageHtml(lead, usage) {
  const students = usage?.students?.total || 0
  const admissions = usage?.admissions?.total || 0
  const chips = [
    students ? `Students ${students}` : '',
    admissions ? `Admissions ${admissions}` : '',
  ].filter(Boolean)
  const preview = (usage?.students?.preview || []).slice(0, 4)
  const extra = students > preview.length
    ? `<li class="wp-swal__list-more">and ${students - preview.length} more students</li>`
    : ''
  const rows = preview.map((row) => {
    const bits = [row.student_no, row.name].filter(Boolean).join(' — ')
    return `<li>${escapeHtml(bits)}</li>`
  }).join('')

  return `
    <div class="wp-swal__detail">
      <p class="wp-swal__detail-lead">${lead}</p>
      ${chips.length ? `<div class="wp-swal__counts">${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}</div>` : ''}
      ${rows ? `<ul class="wp-swal__list">${rows}${extra}</ul>` : ''}
    </div>
  `
}

export default function ProgramFormModal({ program, onClose, onSaved, onUpdated }) {
  const titleId = useId()
  const firstFieldRef = useRef(null)
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const editing = Boolean(program?.id)
  const [anim, setAnim] = useState('enter')
  const [form, setForm] = useState(() => formFromProgram(program))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [removingMajorKey, setRemovingMajorKey] = useState(null)
  const [existing, setExisting] = useState([])
  const [savedSnap, setSavedSnap] = useState(() => snapshot(formFromProgram(program)))
  const dirty = snapshot(form) !== savedSnap
  const isCollege = form.academic_level === 'college'
  const tracks = TRACKS[form.academic_level] || TRACKS.college
  const trackLabel = isCollege ? 'Type' : 'Track'

  const beginLeave = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnim('leave')
  }, [])

  const requestClose = useCallback(async () => {
    if (saving || removingMajorKey || closingRef.current) return
    if (dirty) {
      const ok = await wpConfirmDiscard('You have unsaved program changes. Close this form and lose your progress?')
      if (!ok || closingRef.current) return
    }
    beginLeave()
  }, [saving, removingMajorKey, dirty, beginLeave])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnim('open'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (anim !== 'leave') return undefined
    const timer = window.setTimeout(() => {
      if (savedRef.current) onSaved?.()
      else onClose?.()
    }, ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [anim, onClose, onSaved])

  useEffect(() => {
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    api.get('/programs')
      .then(({ data }) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : (data?.data || [])
        setExisting(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function changeLevel(academic_level) {
    setForm((prev) => ({
      ...prev,
      academic_level,
      track_type: academic_level === 'shs' ? 'academic' : 'degree',
      duration_years: academic_level === 'shs' ? 2 : 4,
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.academic_level
      delete next.track_type
      delete next.duration_years
      return next
    })
  }

  function setMajor(index, key, value) {
    setForm((prev) => ({
      ...prev,
      majors: prev.majors.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.majors
      delete next[`majors.${index}.${key}`]
      delete next[`majors.${index}.name`]
      delete next[`majors.${index}.code`]
      return next
    })
  }

  function addMajor() {
    setForm((prev) => ({ ...prev, majors: [...prev.majors, newMajorRow()] }))
    setErrors((prev) => {
      if (!prev.majors) return prev
      const next = { ...prev }
      delete next.majors
      return next
    })
  }

  function dropMajorRow(index, markSaved = false) {
    const next = { ...form, majors: form.majors.filter((_, i) => i !== index) }
    setForm(next)
    if (markSaved) setSavedSnap(snapshot(next))
    setErrors((prev) => {
      const nextErrors = { ...prev }
      delete nextErrors.majors
      return nextErrors
    })
  }

  async function removeMajor(index) {
    if (saving || removingMajorKey || closingRef.current) return
    const row = form.majors[index]
    if (!row) return

    const label = [String(row.code || '').trim(), String(row.name || '').trim()].filter(Boolean).join(' — ')
      || 'this major'

    if (!editing || !row.id) {
      const ok = await wpConfirm({
        icon: 'question',
        title: 'Remove this major?',
        text: `${label} will be removed from the form.`,
        confirmText: 'Remove',
        danger: true,
      })
      if (!ok || closingRef.current) return
      dropMajorRow(index)
      return
    }

    setRemovingMajorKey(row.key)
    try {
      let usage = null
      try {
        usage = await wpWithLoading(
          async () => {
            const { data } = await api.get(`/programs/${program.id}/majors/${row.id}/usage`)
            return data
          },
          { title: 'Checking major…', text: 'Looking up linked student and admission records.' },
        )
      } catch {
        usage = null
      }

      if (usage?.in_use) {
        await wpAlert({
          icon: 'error',
          title: 'This major cannot be deleted',
          html: majorUsageHtml(
            `<strong>${escapeHtml(label)}</strong> is already used by the records below. Existing student records must stay intact.`,
            usage
          ),
          confirmText: 'OK',
        })
        return
      }

      const ok = await wpConfirm({
        icon: 'warning',
        title: 'Delete this major?',
        text: `${label} will be deleted now. This cannot be undone.`,
        confirmText: 'Delete major',
        danger: true,
      })
      if (!ok || closingRef.current) return

      await api.delete(`/programs/${program.id}/majors/${row.id}`)
      dropMajorRow(index, true)
      toast.success('Major deleted.')
      onUpdated?.()
    } catch (err) {
      const usage = err?.response?.data?.usage
      if (usage?.in_use) {
        await wpAlert({
          icon: 'error',
          title: 'This major cannot be deleted',
          html: majorUsageHtml(
            `<strong>${escapeHtml(label)}</strong> is already used by the records below. Existing student records must stay intact.`,
            usage
          ),
          confirmText: 'OK',
        })
      } else {
        toast.error(apiErrorMessage(err, 'Failed to delete major.'))
      }
    } finally {
      setRemovingMajorKey(null)
    }
  }

  function filledMajors() {
    return (form.majors || [])
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => String(row.name || '').trim() || String(row.code || '').trim())
  }

  function validate() {
    const next = {}
    const code = String(form.code || '').trim().toUpperCase()
    const name = normalizeProgramName(form.name)
    if (!code) next.code = 'Program code is required.'
    if (!name) next.name = 'Program name is required.'
    if (!form.academic_level) next.academic_level = 'Academic level is required.'
    if (!form.track_type) next.track_type = 'Track type is required.'
    const years = Number(form.duration_years)
    if (!years || years < 1 || years > 6) next.duration_years = 'Duration must be between 1 and 6 years.'

    const others = existing.filter((p) => p.id !== program?.id)
    if (code && others.some((p) => isSameProgramCode(p.code, code))) {
      next.code = 'This program code is already in use.'
    }
    if (name && others.some((p) => isSameProgramName(p.name, name))) {
      next.name = 'This program name is already in use.'
    }

    const filled = filledMajors()
    const names = {}
    const codes = {}
    filled.forEach(({ row, index }) => {
      const name = String(row.name || '').trim()
      const code = String(row.code || '').trim().toUpperCase()
      if (!name) next[`majors.${index}.name`] = 'Major name is required.'
      const nameKey = name.toLowerCase()
      if (name && names[nameKey] !== undefined) {
        next[`majors.${index}.name`] = 'Each major name must be unique in this program.'
      }
      if (name) names[nameKey] = index
      if (code) {
        if (codes[code] !== undefined) next[`majors.${index}.code`] = 'Each major code must be unique in this program.'
        codes[code] = index
      }
    })
    return next
  }

  async function submit(e) {
    e.preventDefault()
    if (saving || removingMajorKey || closingRef.current) return
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) return

    const code = String(form.code).trim().toUpperCase()
    const name = normalizeProgramName(form.name)
    const majorCount = isCollege ? filledMajors().length : 0
    const majorNote = majorCount
      ? ` with ${majorCount} major${majorCount === 1 ? '' : 's'}`
      : ''

    const confirmed = await wpConfirm({
      icon: 'question',
      title: editing ? 'Save program changes?' : 'Add this program?',
      text: editing
        ? `Save changes to ${code} — ${name}${majorNote}?`
        : `Add ${code} — ${name}${majorNote} to the program list?`,
      confirmText: editing ? 'Save changes' : 'Add Program',
      cancelText: 'Cancel',
      focusCancel: false,
    })
    if (!confirmed || closingRef.current) return

    setSaving(true)
    const payload = {
      code,
      name,
      academic_level: form.academic_level,
      track_type: form.track_type,
      duration_years: Number(form.duration_years),
    }

    if (!editing) {
      payload.is_active = true
    }

    if (isCollege) {
      payload.majors = filledMajors().map(({ row }) => ({
        ...(row.id ? { id: row.id } : {}),
        code: String(row.code || '').trim().toUpperCase() || null,
        name: String(row.name || '').trim(),
        is_active: row.is_active !== false,
      }))
    }

    try {
      if (editing) {
        await api.put(`/programs/${program.id}`, payload)
        toast.success('Program updated.')
      } else {
        await api.post('/programs', payload)
        toast.success('Program added.')
      }
      savedRef.current = true
      beginLeave()
    } catch (err) {
      const data = err?.response?.data
      if (data?.errors && typeof data.errors === 'object') {
        const mapped = {}
        Object.entries(data.errors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setErrors(mapped)
      }
      toast.error(apiErrorMessage(err, editing ? 'Failed to update program.' : 'Failed to add program.'))
    } finally {
      setSaving(false)
    }
  }

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-prog-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        className="wp-srm__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="wp-srm__header">
          <h2 id={titleId} className="wp-srm__title">
            {editing ? 'Edit Program' : 'Add Program'}
          </h2>
          <button
            type="button"
            className="wp-srm__icon-btn"
            onClick={requestClose}
            aria-label="Close"
            disabled={saving}
          >
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-prog-form" onSubmit={submit} noValidate>
          <div className="wp-srm__body">
            <div className="wp-prog-form__grid">
              <label className="wp-prog-form__field wp-prog-form__field--code">
                <span>Code</span>
                <input
                  ref={firstFieldRef}
                  className={errors.code ? 'is-invalid' : ''}
                  value={form.code}
                  onChange={(e) => setField('code', e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  maxLength={32}
                  autoComplete="off"
                />
                {errors.code ? <small>{errors.code}</small> : null}
              </label>

              <label className="wp-prog-form__field wp-prog-form__field--name">
                <span>Program name</span>
                <input
                  className={errors.name ? 'is-invalid' : ''}
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Enter program name"
                  maxLength={255}
                />
                {errors.name ? <small>{errors.name}</small> : null}
              </label>

              <label className="wp-prog-form__field">
                <span>Level</span>
                <select
                  className={errors.academic_level ? 'is-invalid' : ''}
                  value={form.academic_level}
                  onChange={(e) => changeLevel(e.target.value)}
                >
                  <option value="college">College</option>
                  <option value="shs">Senior High</option>
                </select>
                {errors.academic_level ? <small>{errors.academic_level}</small> : null}
              </label>

              <label className="wp-prog-form__field">
                <span>{trackLabel}</span>
                <select
                  className={errors.track_type ? 'is-invalid' : ''}
                  value={form.track_type}
                  onChange={(e) => setField('track_type', e.target.value)}
                >
                  {tracks.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.track_type ? <small>{errors.track_type}</small> : null}
              </label>

              <label className="wp-prog-form__field">
                <span>Years</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  className={errors.duration_years ? 'is-invalid' : ''}
                  value={form.duration_years}
                  onChange={(e) => setField('duration_years', e.target.value)}
                />
                {errors.duration_years ? <small>{errors.duration_years}</small> : null}
              </label>
            </div>

            {isCollege ? (
              <div className="wp-prog-form__majors">
                <div className="wp-prog-form__majors-head">
                  <span>Majors</span>
                  <button type="button" className="wp-prog-form__add" onClick={addMajor}>
                    <FiPlus size={14} />
                    Add
                  </button>
                </div>
                {errors.majors ? <small className="wp-prog-form__error">{errors.majors}</small> : null}
                {form.majors.length > 0 ? (
                  <div className="wp-prog-form__major-list">
                    {form.majors.map((row, index) => {
                      const removing = removingMajorKey === row.key
                      return (
                      <div key={row.key} className={`wp-prog-form__major-row${removing ? ' is-removing' : ''}`}>
                        <input
                          className={errors[`majors.${index}.code`] ? 'is-invalid' : ''}
                          value={row.code}
                          onChange={(e) => setMajor(index, 'code', e.target.value.toUpperCase())}
                          placeholder="Enter code"
                          maxLength={32}
                          aria-label="Major code"
                          disabled={saving || Boolean(removingMajorKey)}
                        />
                        <input
                          className={errors[`majors.${index}.name`] ? 'is-invalid' : ''}
                          value={row.name}
                          onChange={(e) => setMajor(index, 'name', e.target.value)}
                          placeholder="Enter major name"
                          maxLength={255}
                          aria-label="Major name"
                          disabled={saving || Boolean(removingMajorKey)}
                        />
                        <div className="wp-prog-form__major-actions">
                          <button
                            type="button"
                            className="wp-srm__icon-btn"
                            onClick={() => removeMajor(index)}
                            aria-label={removing ? 'Deleting major' : 'Remove major'}
                            title={removing ? 'Deleting…' : 'Remove'}
                            disabled={saving || Boolean(removingMajorKey)}
                            aria-busy={removing}
                          >
                            {removing ? <FiLoader className="is-spin" size={15} /> : <FiTrash2 size={15} />}
                          </button>
                        </div>
                        {errors[`majors.${index}.code`] || errors[`majors.${index}.name`] ? (
                          <small className="wp-prog-form__error">
                            {errors[`majors.${index}.name`] || errors[`majors.${index}.code`]}
                          </small>
                        ) : null}
                      </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <footer className="wp-srm__footer">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="wp-srm__btn wp-srm__btn--primary" disabled={saving}>
              {saving ? 'Saving…' : (editing ? 'Save changes' : 'Add Program')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
