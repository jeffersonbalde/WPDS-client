import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiCamera, FiSave, FiUser } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import WestPrimeLoader from '../components/common/WestPrimeLoader'
import PhotoLightbox from '../components/common/PhotoLightbox'
import StudentProfilePanels from '../components/student-profile/StudentProfilePanels'
import { useAuth } from '../context/AuthContext'
import { apiErrorMessage } from '../utils/apiError'
import { wpConfirm, wpConfirmDiscard, wpWithLoading } from '../utils/wpSwal'
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

const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp'
const AVATAR_MAX_BYTES = 20 * 1024 * 1024
const AVATAR_MAX_LABEL = '20 MB'

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
  const { user: currentUser } = useAuth()
  const listPath = currentUser?.role === 'it' ? '/users' : '/students'
  const backLabel = currentUser?.role === 'it' ? 'Back to User Management' : 'Back to Students'
  const [profile, setProfile] = useState(null)
  const [baseline, setBaseline] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('info')
  const [errors, setErrors] = useState({})
  const allowLeaveRef = useRef(false)
  const avatarInputRef = useRef(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  const dirty = (profileSnapshot(profile) !== baseline && baseline !== '')
    || Boolean(avatarFile)
    || removeAvatar

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

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
        setAvatarUrl(data.user?.avatar_url || null)
        setAvatarFile(null)
        setRemoveAvatar(false)
        if (avatarPreview) URL.revokeObjectURL(avatarPreview)
        setAvatarPreview(null)
        setErrors({})
        setTab('info')
        allowLeaveRef.current = false
      } catch (err) {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, 'Failed to load student.'))
          allowLeaveRef.current = true
          navigate(listPath)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on id/listPath only
  }, [id, navigate, listPath])

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
    navigate(listPath)
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

  function onAvatarPicked(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Photo must be a JPG, PNG, or WEBP image.')
      e.target.value = ''
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(`Photo must be ${AVATAR_MAX_LABEL} or smaller.`)
      e.target.value = ''
      return
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setRemoveAvatar(false)
  }

  function clearAvatarPicker() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(null)
    setAvatarPreview(null)
    setRemoveAvatar(Boolean(avatarUrl))
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  async function save() {
    if (!profile) return
    if (!profile.last_name?.trim() || !profile.first_name?.trim()) {
      toast.error('Last name and first name are required.')
      setTab('info')
      return
    }

    const emailMsg = await wpWithLoading(
      () => checkContactEmail(profile.contact_email),
      { title: 'Checking details…', text: 'Verifying email before saving.' },
    )
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

      if (avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        await api.post(`/students/${id}/avatar`, fd)
      } else if (removeAvatar) {
        await api.delete(`/students/${id}/avatar`)
      }

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
      navigate(listPath)
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
  const displayPhoto = avatarPreview || (!removeAvatar && avatarUrl) || null
  const displayName = [profile.last_name, profile.first_name].filter(Boolean).join(', ')
    + (profile.middle_name ? ` ${profile.middle_name}` : '')

  return (
    <div className="wp-profile wp-profile--edit">
      <div className="wp-profile__toolbar">
        <div className="wp-profile__toolbar-text">
          <h1 className="wp-profile__title">Edit Student Profile</h1>
          <p className="wp-profile__sub">
            Update personal details, school background, parents/guardian, and photo.
          </p>
        </div>
        <div className="wp-profile__actions">
          <button
            type="button"
            className="wp-profile__btn wp-profile__btn--ghost"
            onClick={goBackToStudents}
          >
            <FiArrowLeft />
            {backLabel}
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

      <section className="wp-profile__identity" aria-label="Student identity">
        {displayPhoto ? (
          <button
            type="button"
            className="wp-profile__photo has-photo wp-profile__photo--btn"
            onClick={() => setPhotoOpen(true)}
            title="View photo"
            aria-label="View photo"
          >
            <img src={displayPhoto} alt="" />
            <span className="wp-profile__photo-overlay">View</span>
          </button>
        ) : (
          <label
            className="wp-profile__photo"
            htmlFor="student-edit-avatar-input"
            title="Click to upload photo"
          >
            <span className="wp-profile__photo-empty">
              <FiUser size={32} aria-hidden />
              <span>No photo</span>
            </span>
            <span className="wp-profile__photo-overlay">
              <FiCamera size={15} aria-hidden />
              Upload
            </span>
          </label>
        )}
        <input
          id="student-edit-avatar-input"
          ref={avatarInputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          hidden
          disabled={saving}
          onChange={onAvatarPicked}
        />

        <div className="wp-profile__identity-body">
          <h2 className="wp-profile__identity-name">{displayName || '—'}</h2>
          <div className="wp-profile__badge-row">
            <span className="wp-profile__chip">{profile.student_no}</span>
            {profile.program?.code ? (
              <span className="wp-profile__chip is-muted">{profile.program.code}</span>
            ) : null}
            {dirty ? <span className="wp-profile__chip is-warn">Unsaved changes</span> : null}
          </div>
          <div className="wp-profile__photo-actions">
            <label className="wp-profile__btn wp-profile__btn--ghost wp-profile__btn--sm" htmlFor="student-edit-avatar-input">
              <FiCamera size={13} />
              {displayPhoto ? 'Change photo' : 'Upload photo'}
            </label>
            {displayPhoto ? (
              <button
                type="button"
                className="wp-profile__btn wp-profile__btn--ghost wp-profile__btn--sm"
                onClick={clearAvatarPicker}
                disabled={saving}
              >
                Remove
              </button>
            ) : null}
            <span className="wp-profile__photo-hint">JPG, PNG, or WEBP · Up to {AVATAR_MAX_LABEL}</span>
          </div>
        </div>
      </section>

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

      <PhotoLightbox
        src={photoOpen && displayPhoto ? displayPhoto : null}
        title={displayName || 'Photo'}
        onClose={() => setPhotoOpen(false)}
      />
    </div>
  )
}
