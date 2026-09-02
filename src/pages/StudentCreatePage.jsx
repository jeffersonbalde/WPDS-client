import { useCallback, useEffect, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiEye, FiEyeOff, FiUserPlus } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import { apiErrorMessage } from '../utils/apiError'
import { wpConfirm, wpConfirmDiscard, wpSuccess } from '../utils/wpSwal'
import {
  defaultEducationalBackground,
  defaultParentsGuardian,
  normalizeEducationalBackground,
  normalizeParentsGuardian,
} from '../utils/studentProfile'
import './ProfilePage.css'
import './StudentCreatePage.css'

const TABS = [
  { key: 'info', label: 'Student Information' },
  { key: 'edu', label: 'Educational Background' },
  { key: 'parents', label: 'Parents/Guardian' },
]

const PARENT_ROLES = [
  { key: 'father', title: 'Father' },
  { key: 'mother', title: 'Mother' },
  { key: 'guardian', title: 'Guardian' },
]

function buildDefaultPassword(studentNo) {
  const clean = String(studentNo || '').trim().toUpperCase() || 'STUDENT'
  return `WPDS-${clean}`
}

function emptyForm() {
  return {
    student_no: '',
    academic_level: 'college',
    contact_email: '',
    portal_email: '',
    password: buildDefaultPassword(''),
    last_name: '',
    first_name: '',
    middle_name: '',
    date_of_birth: '',
    place_of_birth: '',
    gender: '',
    civil_status: '',
    address_line_1: '',
    address_line_2: '',
    mobile: '',
    telephone: '',
    ethnic_origin: '',
    religion: '',
    educational_background: defaultEducationalBackground(),
    parents_guardian: defaultParentsGuardian(),
  }
}

function required(value, message) {
  if (!String(value ?? '').trim()) return message
  return null
}

export default function StudentCreatePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('info')
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [generatingNo, setGeneratingNo] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordManual, setPasswordManual] = useState(false)
  const [portalEmailManual, setPortalEmailManual] = useState(false)
  const [studentNoManual, setStudentNoManual] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [allowLeave, setAllowLeave] = useState(false)

  const markDirty = useCallback(() => {
    setDirty(true)
  }, [])

  useEffect(() => {
    function onBeforeUnload(e) {
      if (!dirty || allowLeave) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, allowLeave])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty
      && !allowLeave
      && currentLocation.pathname !== nextLocation.pathname
      && nextLocation.pathname !== '/login',
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined
    let cancelled = false
    async function ask() {
      const ok = await wpConfirmDiscard(
        'You have unsaved progress. Leave this page and lose what you entered?',
      )
      if (cancelled) return
      if (ok) blocker.proceed()
      else blocker.reset()
    }
    ask()
    return () => { cancelled = true }
  }, [blocker])

  function goBackToStudents() {
    navigate('/students')
  }

  async function applyGeneratedStudentNo(level, { force = false } = {}) {
    setGeneratingNo(true)
    try {
      const { data } = await api.get('/students/next-number', {
        params: { academic_level: level || 'college' },
      })
      const nextNo = data.student_no
      setForm((prev) => {
        if (!force && studentNoManual && prev.student_no) return prev
        const next = { ...prev, student_no: nextNo }
        if (!passwordManual) next.password = buildDefaultPassword(nextNo)
        return next
      })
      if (force) setStudentNoManual(false)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to generate student number.'))
    } finally {
      setGeneratingNo(false)
    }
  }

  useEffect(() => {
    applyGeneratedStudentNo('college', { force: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearError(key) {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function checkEmailsAvailable({ contactEmail, portalEmail } = {}) {
    const contact = (contactEmail ?? form.contact_email).trim().toLowerCase()
    const portal = (portalEmail ?? form.portal_email).trim()
    const params = {}
    if (contact) params.contact_email = contact
    if (portal) params.email = portal.includes('@') ? portal.toLowerCase() : portal
    if (!params.contact_email && !params.email) return {}

    try {
      const { data } = await api.get('/students/check-email', { params })
      const apiErrors = data?.errors || {}
      const mapped = {}
      if (apiErrors.contact_email) mapped.contact_email = apiErrors.contact_email
      if (apiErrors.email) mapped.portal_email = apiErrors.email
      return mapped
    } catch {
      return {}
    }
  }

  async function onContactEmailBlur() {
    const value = form.contact_email.trim()
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return
    const dup = await checkEmailsAvailable({
      contactEmail: value,
      portalEmail: form.portal_email,
    })
    if (dup.contact_email) {
      setErrors((prev) => ({ ...prev, contact_email: dup.contact_email }))
    }
    if (dup.portal_email && form.portal_email.trim()) {
      setErrors((prev) => ({ ...prev, portal_email: dup.portal_email }))
    }
  }

  async function onPortalEmailBlur() {
    const value = form.portal_email.trim()
    if (!value) return
    if (value.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return
    if (!value.includes('@') && !/^[a-zA-Z0-9._-]{3,60}$/.test(value)) return
    const dup = await checkEmailsAvailable({
      contactEmail: form.contact_email,
      portalEmail: value,
    })
    if (dup.portal_email) {
      setErrors((prev) => ({ ...prev, portal_email: dup.portal_email }))
    }
    if (dup.contact_email && form.contact_email.trim()) {
      setErrors((prev) => ({ ...prev, contact_email: dup.contact_email }))
    }
  }

  function setField(key, value) {
    markDirty()
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'student_no' && !passwordManual) {
        next.password = buildDefaultPassword(value)
      }
      if (key === 'contact_email' && !portalEmailManual) {
        next.portal_email = value.trim().toLowerCase()
      }
      return next
    })
    clearError(key)
  }

  function setEdu(key, value) {
    markDirty()
    setForm((prev) => ({
      ...prev,
      educational_background: {
        ...normalizeEducationalBackground(prev.educational_background),
        [key]: value,
      },
    }))
    clearError(`edu_${key}`)
  }

  function setParent(role, key, value) {
    markDirty()
    setForm((prev) => {
      const parents = normalizeParentsGuardian(prev.parents_guardian)
      return {
        ...prev,
        parents_guardian: {
          ...parents,
          [role]: { ...parents[role], [key]: value },
        },
      }
    })
    clearError(`parents_${role}_${key}`)
  }

  function validateTab(tabKey) {
    const e = {}
    const msg = (label) => `${label} is required.`

    if (tabKey === 'info') {
      e.student_no = required(form.student_no, msg('Student number'))
      e.last_name = required(form.last_name, msg('Last name'))
      e.first_name = required(form.first_name, msg('First name'))
      e.middle_name = required(form.middle_name, msg('Middle name'))
      e.contact_email = required(form.contact_email, msg('Email'))
      if (!e.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
        e.contact_email = 'Enter a valid email address.'
      }

      e.portal_email = required(form.portal_email, 'Email or username is required.')
      if (!e.portal_email) {
        const login = form.portal_email.trim()
        if (login.includes('@')) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) {
            e.portal_email = 'Enter a valid email address or username.'
          }
        } else if (!/^[a-zA-Z0-9._-]{3,60}$/.test(login)) {
          e.portal_email = 'Username must be 3–60 characters (letters, numbers, . _ -).'
        }
      }

      if (!form.password || form.password.length < 6) {
        e.password = 'Password must be at least 6 characters.'
      }

      e.date_of_birth = required(form.date_of_birth, msg('Date of birth'))
      e.place_of_birth = required(form.place_of_birth, msg('Place of birth'))
      e.gender = required(form.gender, msg('Gender'))
      e.civil_status = required(form.civil_status, msg('Civil status'))
      e.address_line_1 = required(form.address_line_1, msg('Address line 1'))
      e.address_line_2 = required(form.address_line_2, msg('Address line 2'))
      e.mobile = required(form.mobile, msg('Mobile number'))
      e.telephone = required(form.telephone, msg('Telephone'))
      e.ethnic_origin = required(form.ethnic_origin, msg('Ethnic origin'))
      e.religion = required(form.religion, msg('Religion'))
    }

    if (tabKey === 'edu') {
      const eduData = normalizeEducationalBackground(form.educational_background)
      e.edu_primary_school = required(eduData.primary_school, msg('Primary school'))
      e.edu_junior_high_school = required(eduData.junior_high_school, msg('Junior high school'))
      e.edu_senior_high_school = required(eduData.senior_high_school, msg('Senior high school'))
      e.edu_transferred_from = required(eduData.transferred_from, msg('Transferred from'))
    }

    if (tabKey === 'parents') {
      const parentsData = normalizeParentsGuardian(form.parents_guardian)
      PARENT_ROLES.forEach(({ key, title }) => {
        const person = parentsData[key]
        e[`parents_${key}_name`] = required(person.name, msg(`Name of ${title}`))
        e[`parents_${key}_occupation`] = required(person.occupation, msg(`${title} occupation`))
        e[`parents_${key}_company`] = required(person.company, msg(`${title} company name`))
        e[`parents_${key}_contact`] = required(person.contact, msg(`${title} contact number`))
        e[`parents_${key}_email`] = required(person.email, msg(`${title} email`))
        if (!e[`parents_${key}_email`] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email.trim())) {
          e[`parents_${key}_email`] = 'Enter a valid email address.'
        }
      })
    }

    Object.keys(e).forEach((k) => {
      if (!e[k]) delete e[k]
    })
    return e
  }

  function validateAll() {
    return {
      ...validateTab('info'),
      ...validateTab('edu'),
      ...validateTab('parents'),
    }
  }

  function firstErrorTab(e) {
    const infoKeys = [
      'student_no', 'last_name', 'first_name', 'middle_name', 'contact_email',
      'portal_email', 'password', 'date_of_birth', 'place_of_birth', 'gender',
      'civil_status', 'address_line_1', 'address_line_2', 'mobile', 'telephone',
      'ethnic_origin', 'religion',
    ]
    if (infoKeys.some((k) => e[k])) return 'info'
    if (Object.keys(e).some((k) => k.startsWith('edu_'))) return 'edu'
    if (Object.keys(e).some((k) => k.startsWith('parents_'))) return 'parents'
    return 'info'
  }

  async function submit() {
    const e = validateAll()
    setErrors(e)
    if (Object.keys(e).length) {
      setTab(firstErrorTab(e))
      toast.error('Please complete all required fields.')
      return
    }

    const dup = await checkEmailsAvailable()
    if (Object.keys(dup).length) {
      setErrors(dup)
      setTab('info')
      toast.error(dup.contact_email || dup.portal_email || 'This email is already in use.')
      return
    }

    const confirmed = await wpConfirm({
      icon: 'question',
      title: 'Create student?',
      text: `Create ${form.last_name.trim()}, ${form.first_name.trim()} (${form.student_no.trim()}) and their portal account?`,
      confirmText: 'Create student',
      cancelText: 'Cancel',
      focusCancel: false,
    })
    if (!confirmed) return

    setSaving(true)
    try {
      const rawLogin = form.portal_email.trim()
      const portalLogin = rawLogin.includes('@') ? rawLogin.toLowerCase() : rawLogin
      const payload = {
        student_no: form.student_no.trim(),
        academic_level: form.academic_level,
        contact_email: form.contact_email.trim().toLowerCase(),
        email: portalLogin,
        password: form.password,
        last_name: form.last_name.trim(),
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        date_of_birth: form.date_of_birth,
        place_of_birth: form.place_of_birth.trim(),
        gender: form.gender,
        civil_status: form.civil_status,
        address_line_1: form.address_line_1.trim(),
        address_line_2: form.address_line_2.trim(),
        mobile: form.mobile.trim(),
        telephone: form.telephone.trim(),
        ethnic_origin: form.ethnic_origin.trim(),
        religion: form.religion.trim(),
        educational_background: normalizeEducationalBackground(form.educational_background),
        parents_guardian: normalizeParentsGuardian(form.parents_guardian),
      }

      const { data } = await api.post('/students', payload)
      const creds = data.portal_credentials || {
        login: payload.email,
        password: payload.password,
      }

      toast.success('Student created successfully.')
      setAllowLeave(true)
      setDirty(false)

      const loginSafe = String(creds.login || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      const passwordSafe = String(creds.password || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

      const result = await wpSuccess({
        title: 'Student created',
        html: `
          <p class="wp-swal__lead">
            Portal credentials are ready. You can enroll this student under <strong>Admissions</strong>.
          </p>
          <div class="wp-swal__creds">
            <div class="wp-swal__cred-row">
              <span class="wp-swal__cred-label">Email</span>
              <span class="wp-swal__cred-value">${loginSafe}</span>
            </div>
            <div class="wp-swal__cred-row">
              <span class="wp-swal__cred-label">Password</span>
              <span class="wp-swal__cred-value">${passwordSafe}</span>
            </div>
          </div>
        `,
        showCancel: true,
        confirmText: 'Create Admission',
        cancelText: 'Back to Students',
      })

      if (result.isConfirmed) navigate('/admissions-manage/new')
      else navigate('/students')
    } catch (err) {
      const data = err?.response?.data
      if (data?.errors) {
        const mapped = {}
        Object.entries(data.errors).forEach(([key, msgs]) => {
          let field = key
          if (key === 'email') field = 'portal_email'
          if (key.startsWith('educational_background.')) {
            field = `edu_${key.replace('educational_background.', '')}`
          }
          if (key.startsWith('parents_guardian.')) {
            field = `parents_${key.replace('parents_guardian.', '').replace('.', '_')}`
          }
          mapped[field] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setErrors(mapped)
        setTab(firstErrorTab(mapped))
      }
      toast.error(apiErrorMessage(err, 'Failed to create student.'))
    } finally {
      setSaving(false)
    }
  }

  const activeLabel = TABS.find((t) => t.key === tab)?.label || 'Add Student'
  const edu = form.educational_background
  const parents = form.parents_guardian

  return (
    <div className="wp-profile wp-create">
      <div className="wp-profile__header">
        <div>
          <button type="button" className="wp-create__back" onClick={goBackToStudents}>
            <FiArrowLeft /> Back to Students
          </button>
          <h1 className="wp-profile__title">Add Student</h1>
          <p className="wp-profile__sub">
            Fill in student details to create their record and portal account.
          </p>
          {dirty ? (
            <div className="wp-profile__badge-row">
              <span className="wp-profile__chip is-warn">Unsaved progress</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="wp-profile__layout">
        <nav className="wp-profile__tabs" aria-label="Add student sections">
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

          {tab === 'info' && (
            <>
              <div className="wp-create__grid">
                <Field label="Student number" error={errors.student_no} required>
                  <input
                    className={`form-control${errors.student_no ? ' is-invalid' : ''}`}
                    value={form.student_no}
                    onChange={(e) => {
                      setStudentNoManual(true)
                      setField('student_no', e.target.value)
                    }}
                    placeholder={generatingNo ? 'Generating…' : 'Auto-generated'}
                    disabled={generatingNo}
                  />
                </Field>
                <Field label="Academic level" required>
                  <select
                    className="form-select"
                    value={form.academic_level}
                    onChange={(e) => {
                      setField('academic_level', e.target.value)
                      if (!studentNoManual) applyGeneratedStudentNo(e.target.value, { force: true })
                    }}
                  >
                    <option value="college">College</option>
                    <option value="shs">Senior High School</option>
                  </select>
                </Field>
                <Field label="Last name" error={errors.last_name} required>
                  <input className={`form-control${errors.last_name ? ' is-invalid' : ''}`} value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} placeholder="Enter last name" />
                </Field>
                <Field label="First name" error={errors.first_name} required>
                  <input className={`form-control${errors.first_name ? ' is-invalid' : ''}`} value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} placeholder="Enter first name" />
                </Field>
                <Field label="Middle name" error={errors.middle_name} required>
                  <input className={`form-control${errors.middle_name ? ' is-invalid' : ''}`} value={form.middle_name} onChange={(e) => setField('middle_name', e.target.value)} placeholder="Enter middle name" />
                </Field>
                <Field label="Email" error={errors.contact_email} required>
                  <input
                    type="email"
                    className={`form-control${errors.contact_email ? ' is-invalid' : ''}`}
                    value={form.contact_email}
                    onChange={(e) => setField('contact_email', e.target.value)}
                    onBlur={onContactEmailBlur}
                    placeholder="Enter email"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Date of birth" error={errors.date_of_birth} required>
                  <input type="date" className={`form-control${errors.date_of_birth ? ' is-invalid' : ''}`} value={form.date_of_birth} onChange={(e) => setField('date_of_birth', e.target.value)} />
                </Field>
                <Field label="Place of birth" error={errors.place_of_birth} required>
                  <input className={`form-control${errors.place_of_birth ? ' is-invalid' : ''}`} value={form.place_of_birth} onChange={(e) => setField('place_of_birth', e.target.value)} placeholder="Enter place of birth" />
                </Field>
                <Field label="Gender" error={errors.gender} required>
                  <select className={`form-select${errors.gender ? ' is-invalid' : ''}`} value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </Field>
                <Field label="Civil status" error={errors.civil_status} required>
                  <select className={`form-select${errors.civil_status ? ' is-invalid' : ''}`} value={form.civil_status} onChange={(e) => setField('civil_status', e.target.value)}>
                    <option value="">Select civil status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </Field>
                <Field label="Address line 1" error={errors.address_line_1} required>
                  <input className={`form-control${errors.address_line_1 ? ' is-invalid' : ''}`} value={form.address_line_1} onChange={(e) => setField('address_line_1', e.target.value)} placeholder="Enter address" />
                </Field>
                <Field label="Address line 2" error={errors.address_line_2} required>
                  <input className={`form-control${errors.address_line_2 ? ' is-invalid' : ''}`} value={form.address_line_2} onChange={(e) => setField('address_line_2', e.target.value)} placeholder="Enter address line 2" />
                </Field>
                <Field label="Mobile number" error={errors.mobile} required>
                  <input className={`form-control${errors.mobile ? ' is-invalid' : ''}`} value={form.mobile} onChange={(e) => setField('mobile', e.target.value)} placeholder="Enter mobile number" />
                </Field>
                <Field label="Telephone" error={errors.telephone} required>
                  <input className={`form-control${errors.telephone ? ' is-invalid' : ''}`} value={form.telephone} onChange={(e) => setField('telephone', e.target.value)} placeholder="Enter telephone" />
                </Field>
                <Field label="Ethnic origin" error={errors.ethnic_origin} required>
                  <input className={`form-control${errors.ethnic_origin ? ' is-invalid' : ''}`} value={form.ethnic_origin} onChange={(e) => setField('ethnic_origin', e.target.value)} placeholder="Enter ethnic origin" />
                </Field>
                <Field label="Religion" error={errors.religion} required>
                  <input className={`form-control${errors.religion ? ' is-invalid' : ''}`} value={form.religion} onChange={(e) => setField('religion', e.target.value)} placeholder="Enter religion" />
                </Field>
              </div>

              <div className="wp-create__creds">
                <div className="wp-create__creds-title">Portal account</div>
                <div className="wp-create__grid">
                  <Field label="Email or username" error={errors.portal_email} hint="Used as portal login." required>
                    <input
                      type="text"
                      className={`form-control${errors.portal_email ? ' is-invalid' : ''}`}
                      value={form.portal_email}
                      onChange={(e) => {
                        setPortalEmailManual(true)
                        setField('portal_email', e.target.value)
                      }}
                      onBlur={onPortalEmailBlur}
                      placeholder="Enter email or username"
                      autoComplete="username"
                    />
                  </Field>
                  <Field label="Password" error={errors.password} hint="Auto-filled and can be changed." required>
                    <div className="wp-create__password-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`form-control${errors.password ? ' is-invalid' : ''}`}
                        value={form.password}
                        onChange={(e) => {
                          setPasswordManual(true)
                          setField('password', e.target.value)
                        }}
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        className="wp-create__password-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                  </Field>
                </div>
              </div>
            </>
          )}

          {tab === 'edu' && (
            <div className="wp-create__grid wp-create__grid--single">
              <Field label="Primary school" error={errors.edu_primary_school} required>
                <input className={`form-control${errors.edu_primary_school ? ' is-invalid' : ''}`} value={edu.primary_school} onChange={(e) => setEdu('primary_school', e.target.value)} placeholder="Enter primary school" />
              </Field>
              <Field label="Junior high school" error={errors.edu_junior_high_school} required>
                <input className={`form-control${errors.edu_junior_high_school ? ' is-invalid' : ''}`} value={edu.junior_high_school} onChange={(e) => setEdu('junior_high_school', e.target.value)} placeholder="Enter junior high school" />
              </Field>
              <Field label="Senior high school" error={errors.edu_senior_high_school} required>
                <input className={`form-control${errors.edu_senior_high_school ? ' is-invalid' : ''}`} value={edu.senior_high_school} onChange={(e) => setEdu('senior_high_school', e.target.value)} placeholder="Enter senior high school" />
              </Field>
              <Field label="Transferred from" error={errors.edu_transferred_from} hint="Enter N/A if not applicable." required>
                <input className={`form-control${errors.edu_transferred_from ? ' is-invalid' : ''}`} value={edu.transferred_from} onChange={(e) => setEdu('transferred_from', e.target.value)} placeholder="Enter previous school or N/A" />
              </Field>
            </div>
          )}

          {tab === 'parents' && (
            <div className="wp-create__parents">
              {PARENT_ROLES.map(({ key, title }) => (
                <section key={key} className="wp-create__parent-card">
                  <h3>{title}</h3>
                  <Field label={`Name of ${title}`} error={errors[`parents_${key}_name`]} required>
                    <input className={`form-control${errors[`parents_${key}_name`] ? ' is-invalid' : ''}`} value={parents[key].name} onChange={(e) => setParent(key, 'name', e.target.value)} placeholder={`Enter name of ${title.toLowerCase()}`} />
                  </Field>
                  <Field label="Occupation" error={errors[`parents_${key}_occupation`]} required>
                    <input className={`form-control${errors[`parents_${key}_occupation`] ? ' is-invalid' : ''}`} value={parents[key].occupation} onChange={(e) => setParent(key, 'occupation', e.target.value)} placeholder="Enter occupation" />
                  </Field>
                  <Field label="Company name" error={errors[`parents_${key}_company`]} required>
                    <input className={`form-control${errors[`parents_${key}_company`] ? ' is-invalid' : ''}`} value={parents[key].company} onChange={(e) => setParent(key, 'company', e.target.value)} placeholder="Enter company name" />
                  </Field>
                  <Field label="Contact number" error={errors[`parents_${key}_contact`]} required>
                    <input className={`form-control${errors[`parents_${key}_contact`] ? ' is-invalid' : ''}`} value={parents[key].contact} onChange={(e) => setParent(key, 'contact', e.target.value)} placeholder="Enter contact number" />
                  </Field>
                  <Field label="Email" error={errors[`parents_${key}_email`]} required>
                    <input type="email" className={`form-control${errors[`parents_${key}_email`] ? ' is-invalid' : ''}`} value={parents[key].email} onChange={(e) => setParent(key, 'email', e.target.value)} placeholder="Enter email" />
                  </Field>
                </section>
              ))}
            </div>
          )}

          <div className="wp-create__panel-actions">
            <button
              type="button"
              className="wp-profile__btn wp-profile__btn--ghost"
              onClick={goBackToStudents}
              disabled={saving}
            >
              Cancel
            </button>

            <div className="wp-create__panel-actions-right">
              <button
                type="button"
                className="wp-profile__btn wp-profile__btn--primary"
                onClick={submit}
                disabled={saving || generatingNo}
              >
                <FiUserPlus />
                {saving ? 'Creating…' : 'Create Student'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, error, hint, required: isRequired, children }) {
  return (
    <label className="wp-create__field">
      <span className="wp-create__label">
        {label}
        {isRequired ? <span className="wp-create__req" aria-hidden> *</span> : null}
      </span>
      {children}
      {error ? <span className="wp-create__error">{error}</span> : null}
      {!error && hint ? <span className="wp-create__field-hint">{hint}</span> : null}
    </label>
  )
}
