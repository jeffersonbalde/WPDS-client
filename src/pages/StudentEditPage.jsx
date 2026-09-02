import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiSave } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import WestPrimeLoader from '../components/common/WestPrimeLoader'
import StudentProfilePanels from '../components/student-profile/StudentProfilePanels'
import { apiErrorMessage } from '../utils/apiError'
import { wpConfirm, wpConfirmDiscard } from '../utils/wpSwal'
import {
  normalizeEducationalBackground,
  normalizeParentsGuardian,
} from '../utils/studentProfile'
import './ProfilePage.css'

const TABS = [
  { key: 'info', label: 'Student Information' },
  { key: 'edu', label: 'Educational Background' },
  { key: 'parents', label: 'Parents/Guardian' },
]

function profileSnapshot(profile) {
  if (!profile) return ''
  return JSON.stringify({
    last_name: profile.last_name || '',
    first_name: profile.first_name || '',
    middle_name: profile.middle_name || '',
    date_of_birth: profile.date_of_birth || '',
    place_of_birth: profile.place_of_birth || '',
    gender: profile.gender || '',
    civil_status: profile.civil_status || '',
    address_line_1: profile.address_line_1 || '',
    address_line_2: profile.address_line_2 || '',
    mobile: profile.mobile || '',
    telephone: profile.telephone || '',
    contact_email: profile.contact_email || '',
    ethnic_origin: profile.ethnic_origin || '',
    religion: profile.religion || '',
    educational_background: normalizeEducationalBackground(profile.educational_background),
    parents_guardian: normalizeParentsGuardian(profile.parents_guardian),
  })
}

export default function StudentEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [baseline, setBaseline] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('info')
  const [errors, setErrors] = useState({})
  const allowLeaveRef = useRef(false)

  const dirty = profileSnapshot(profile) !== baseline && baseline !== ''

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get(`/students/${id}`)
        if (cancelled) return
        const next = {
          ...data,
          date_of_birth: data.date_of_birth ? String(data.date_of_birth).slice(0, 10) : '',
          educational_background: normalizeEducationalBackground(data.educational_background),
          parents_guardian: normalizeParentsGuardian(data.parents_guardian),
        }
        setProfile(next)
        setBaseline(profileSnapshot(next))
        setErrors({})
        setTab('info')
        allowLeaveRef.current = false
      } catch (err) {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, 'Failed to load student.'))
          allowLeaveRef.current = true
          navigate('/students')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, navigate])

  useEffect(() => {
    function onBeforeUnload(e) {
      if (!dirty || allowLeaveRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty
      && !allowLeaveRef.current
      && currentLocation.pathname !== nextLocation.pathname
      && nextLocation.pathname !== '/login',
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined
    let cancelled = false
    async function ask() {
      const ok = await wpConfirmDiscard(
        'You have unsaved changes. Leave this page and lose your progress?',
      )
      if (cancelled) return
      if (ok) blocker.proceed()
      else blocker.reset()
    }
    ask()
    return () => { cancelled = true }
  }, [blocker])

  const confirmDiscard = useCallback(async (message) => {
    if (!dirty) return true
    return wpConfirmDiscard(message)
  }, [dirty])

  function goBackToStudents() {
    navigate('/students')
  }

  function restoreFromBaseline() {
    if (!baseline) return
    try {
      const snap = JSON.parse(baseline)
      setProfile((p) => ({
        ...p,
        ...snap,
        educational_background: normalizeEducationalBackground(snap.educational_background),
        parents_guardian: normalizeParentsGuardian(snap.parents_guardian),
      }))
      setErrors({})
    } catch {
      /* ignore */
    }
  }

  async function changeTab(nextTab) {
    if (nextTab === tab) return
    if (!dirty) {
      setTab(nextTab)
      return
    }
    const ok = await confirmDiscard(
      'You have unsaved changes. Switch section and discard your progress?',
    )
    if (!ok) return
    restoreFromBaseline()
    setTab(nextTab)
  }

  function setField(key, value) {
    setProfile((p) => ({ ...p, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function checkContactEmail(value) {
    const email = String(value || '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
    try {
      const { data } = await api.get('/students/check-email', {
        params: {
          contact_email: email,
          ignore_student_id: id,
        },
      })
      return data?.errors?.contact_email || null
    } catch {
      return null
    }
  }

  async function onBlurField(key) {
    if (key !== 'contact_email' || !profile) return
    const msg = await checkContactEmail(profile.contact_email)
    if (msg) setErrors((prev) => ({ ...prev, contact_email: msg }))
  }

  function setEdu(key, value) {
    setProfile((p) => ({
      ...p,
      educational_background: {
        ...normalizeEducationalBackground(p.educational_background),
        [key]: value,
      },
    }))
  }

  function setParent(role, key, value) {
    setProfile((p) => {
      const parents = normalizeParentsGuardian(p.parents_guardian)
      return {
        ...p,
        parents_guardian: {
          ...parents,
          [role]: {
            ...parents[role],
            [key]: value,
          },
        },
      }
    })
  }

  async function save() {
    if (!profile) return
    if (!profile.last_name?.trim() || !profile.first_name?.trim()) {
      toast.error('Last name and first name are required.')
      setTab('info')
      return
    }

    const emailMsg = await checkContactEmail(profile.contact_email)
    if (emailMsg) {
      setErrors({ contact_email: emailMsg })
      setTab('info')
      toast.error(emailMsg)
      return
    }

    if (!dirty) {
      toast.info('No changes to save.')
      return
    }

    const confirmed = await wpConfirm({
      icon: 'question',
      title: 'Save changes?',
      text: `Save updates to ${profile.last_name}, ${profile.first_name} (${profile.student_no})?`,
      confirmText: 'Save changes',
      cancelText: 'Cancel',
      focusCancel: false,
    })
    if (!confirmed) return

    setSaving(true)
    try {
      const payload = {
        last_name: profile.last_name.trim(),
        first_name: profile.first_name.trim(),
        middle_name: profile.middle_name?.trim() || null,
        date_of_birth: profile.date_of_birth || null,
        place_of_birth: profile.place_of_birth?.trim() || null,
        gender: profile.gender || null,
        civil_status: profile.civil_status || null,
        address_line_1: profile.address_line_1?.trim() || null,
        address_line_2: profile.address_line_2?.trim() || null,
        mobile: profile.mobile?.trim() || null,
        telephone: profile.telephone?.trim() || null,
        contact_email: profile.contact_email?.trim()?.toLowerCase() || null,
        ethnic_origin: profile.ethnic_origin?.trim() || null,
        religion: profile.religion?.trim() || null,
        educational_background: normalizeEducationalBackground(profile.educational_background),
        parents_guardian: normalizeParentsGuardian(profile.parents_guardian),
      }

      const { data } = await api.put(`/students/${id}`, payload)
      const next = {
        ...data,
        date_of_birth: data.date_of_birth ? String(data.date_of_birth).slice(0, 10) : '',
        educational_background: normalizeEducationalBackground(data.educational_background),
        parents_guardian: normalizeParentsGuardian(data.parents_guardian),
      }
      setProfile(next)
      setBaseline(profileSnapshot(next))
      setErrors({})
      allowLeaveRef.current = true
      toast.success('Student profile saved.')
      navigate('/students')
    } catch (err) {
      const data = err?.response?.data
      if (data?.errors) {
        const mapped = {}
        Object.entries(data.errors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setErrors(mapped)
        if (mapped.contact_email) setTab('info')
      }
      toast.error(apiErrorMessage(err, 'Failed to save profile.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <WestPrimeLoader variant="page" message="Loading…" label="Loading" />
  }

  if (!profile) {
    return <div className="wp-profile__error">Student not found.</div>
  }

  const activeLabel = TABS.find((t) => t.key === tab)?.label || 'Profile'

  return (
    <div className="wp-profile wp-profile--edit">
      <div className="wp-profile__header">
        <div>
          <h1 className="wp-profile__title">Edit Student Profile</h1>
          <p className="wp-profile__sub">
            Update student information, educational background, and parents/guardian details.
          </p>
          <div className="wp-profile__badge-row">
            <span className="wp-profile__chip">{profile.student_no}</span>
            <span className="wp-profile__chip is-muted">
              {profile.last_name}, {profile.first_name}
            </span>
            {dirty ? <span className="wp-profile__chip is-warn">Unsaved changes</span> : null}
          </div>
        </div>
        <div className="wp-profile__actions">
          <button
            type="button"
            className="wp-profile__btn wp-profile__btn--ghost"
            onClick={goBackToStudents}
          >
            <FiArrowLeft />
            Back to Students
          </button>
          <button
            type="button"
            className="wp-profile__btn wp-profile__btn--primary"
            onClick={save}
            disabled={saving}
          >
            <FiSave />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="wp-profile__layout">
        <nav className="wp-profile__tabs" aria-label="Profile sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`wp-profile__tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => changeTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="wp-profile__panel">
          <h2 className="wp-profile__panel-title">{activeLabel}</h2>
          {tab === 'info' ? (
            <p className="wp-profile__note">
              Program, year, and section are managed under Admissions. Other personal details can be edited here.
            </p>
          ) : null}
          <StudentProfilePanels
            profile={profile}
            tab={tab}
            readOnly={false}
            onChange={setField}
            onEduChange={setEdu}
            onParentChange={setParent}
            onBlurField={onBlurField}
            errors={errors}
          />
        </section>
      </div>
    </div>
  )
}
