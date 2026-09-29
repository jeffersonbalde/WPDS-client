import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiCamera, FiEye, FiEyeOff, FiUser, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import PhotoLightbox from '../common/PhotoLightbox'
import WestPrimeLoader from '../common/WestPrimeLoader'
import { apiErrorMessage } from '../../utils/apiError'
import { wpConfirmDiscard } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import './AddUserModal.css'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

const ANIM_MS = 220
const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp'
const AVATAR_MAX_BYTES = 20 * 1024 * 1024
const AVATAR_MAX_LABEL = '20 MB'

const STAFF_ROLES = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'registrar', label: 'Registrar' },
  { value: 'it', label: 'IT' },
  { value: 'admin', label: 'Admin' },
  { value: 'stakeholder', label: 'Stakeholder' },
]

function formFromUser(user) {
  const staff = user?.staff_profile
  return {
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'teacher',
    is_active: user?.is_active !== false,
    employee_no: staff?.employee_no || '',
    department: staff?.department || '',
    position: staff?.position || '',
    mobile: staff?.mobile || '',
  }
}

function snapshot(form) {
  return JSON.stringify({
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
    is_active: Boolean(form.is_active),
    role: form.role,
    employee_no: form.employee_no.trim(),
    department: form.department.trim(),
    position: form.position.trim(),
    mobile: form.mobile.trim(),
  })
}

export default function EditUserModal({ userId, onClose, onSaved }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const avatarInputRef = useRef(null)
  const [anim, setAnim] = useState('enter')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [savedSnap, setSavedSnap] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSelf, setIsSelf] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  const dirty = form
    ? snapshot(form) !== savedSnap || Boolean(avatarFile) || removeAvatar
    : false

  const beginLeave = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setAnim('leave')
  }, [])

  const requestClose = useCallback(async () => {
    if (saving || closingRef.current) return
    if (dirty) {
      const ok = await wpConfirmDiscard('You have unsaved changes. Close this form and lose your progress?')
      if (!ok || closingRef.current) return
    }
    beginLeave()
  }, [saving, dirty, beginLeave])

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

  useBodyScrollLock()

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (photoOpen) return
        e.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose, photoOpen])

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [{ data: user }, meRes] = await Promise.all([
          api.get(`/users/${userId}`),
          api.get('/me').catch(() => ({ data: null })),
        ])
        if (cancelled) return
        if (user.role === 'student') {
          toast.error('Student profiles are edited on the full Edit Profile page.')
          beginLeave()
          return
        }
        const next = formFromUser(user)
        setIsSelf(Boolean(meRes?.data?.id && meRes.data.id === user.id))
        setForm(next)
        setSavedSnap(snapshot(next))
        setAvatarUrl(user.avatar_url || null)
        setAvatarFile(null)
        setRemoveAvatar(false)
        if (avatarPreview) URL.revokeObjectURL(avatarPreview)
        setAvatarPreview(null)
        setErrors({})
      } catch (err) {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, 'Failed to load user.'))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per userId
  }, [userId, beginLeave])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function fieldError(name) {
    const msg = errors[name]
    return Array.isArray(msg) ? msg[0] : msg || ''
  }

  function resetAvatarPicker() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(null)
    setAvatarPreview(null)
    setRemoveAvatar(Boolean(avatarUrl))
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  function onAvatarPicked(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrors((prev) => ({ ...prev, avatar: 'Photo must be a JPG, PNG, or WEBP image.' }))
      e.target.value = ''
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setErrors((prev) => ({ ...prev, avatar: `Photo must be ${AVATAR_MAX_LABEL} or smaller.` }))
      e.target.value = ''
      return
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setRemoveAvatar(false)
    setErrors((prev) => {
      if (!prev.avatar) return prev
      const next = { ...prev }
      delete next.avatar
      return next
    })
  }

  function validateForm() {
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required.'
    const loginId = form.email.trim()
    if (!loginId) {
      next.email = 'Email or username is required.'
    } else if (loginId.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)) {
        next.email = 'Enter a valid email address.'
      }
    } else if (!/^[a-zA-Z0-9._-]{3,60}$/.test(loginId)) {
      next.email = 'Username must be 3–60 characters (letters, numbers, . _ -).'
    }
    if (form.password && form.password.length < 6) {
      next.password = 'Password must be at least 6 characters.'
    }
    return next
  }

  async function submit(e) {
    e.preventDefault()
    if (saving || !form) return

    const next = validateForm()
    setErrors(next)
    if (Object.keys(next).length) return

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      is_active: Boolean(form.is_active),
      role: form.role,
      employee_no: form.employee_no.trim() || null,
      department: form.department.trim() || null,
      position: form.position.trim() || null,
      mobile: form.mobile.trim() || null,
    }
    if (form.password.trim()) payload.password = form.password

    setSaving(true)
    try {
      await api.put(`/users/${userId}`, payload)

      if (avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        await api.post(`/users/${userId}/avatar`, fd)
      } else if (removeAvatar) {
        await api.delete(`/users/${userId}/avatar`)
      }

      toast.success('User updated successfully.')
      savedRef.current = true
      beginLeave()
    } catch (err) {
      const serverErrors = err.response?.data?.errors
      if (serverErrors && typeof serverErrors === 'object') {
        const mapped = {}
        Object.entries(serverErrors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setErrors(mapped)
      }
      toast.error(apiErrorMessage(err, 'Failed to update user.'))
    } finally {
      setSaving(false)
    }
  }

  const displayPhoto = avatarPreview || (!removeAvatar && avatarUrl) || null
  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-user-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <h2 id={titleId} className="wp-srm__title">Edit User</h2>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close" disabled={saving}>
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-user-modal__form" onSubmit={submit} noValidate>
          <div className="wp-srm__body">
            {loading || !form ? (
              <div className="wp-user-modal__loading">
                <WestPrimeLoader variant="inline" message="Loading user…" label="Loading" />
              </div>
            ) : (
              <>
                <div className={`wp-user-modal__avatar-picker${displayPhoto ? ' has-photo' : ''}`}>
                  {displayPhoto ? (
                    <button
                      type="button"
                      className="wp-user-modal__avatar-preview wp-user-modal__avatar-preview--btn"
                      onClick={() => setPhotoOpen(true)}
                      title="View photo"
                      aria-label="View photo"
                    >
                      <img src={displayPhoto} alt="" />
                      <span className="wp-user-modal__avatar-overlay wp-user-modal__avatar-overlay--view">
                        View photo
                      </span>
                    </button>
                  ) : (
                    <label
                      className="wp-user-modal__avatar-preview"
                      htmlFor="edit-user-avatar-input"
                      title="Click to upload photo"
                    >
                      <span className="wp-user-modal__avatar-empty">
                        <FiUser size={42} aria-hidden />
                        <span>No photo</span>
                      </span>
                      <span className="wp-user-modal__avatar-overlay">
                        <FiCamera size={18} aria-hidden />
                        Upload photo
                      </span>
                    </label>
                  )}
                  <input
                    id="edit-user-avatar-input"
                    ref={avatarInputRef}
                    type="file"
                    accept={AVATAR_ACCEPT}
                    hidden
                    disabled={saving}
                    onChange={onAvatarPicked}
                  />
                  <div className="wp-user-modal__avatar-actions">
                    <p className="wp-user-modal__avatar-title">Photo</p>
                    <p className="wp-user-modal__avatar-hint">
                      JPG, PNG, or WEBP · Up to {AVATAR_MAX_LABEL} · Optional
                    </p>
                    <div className="wp-user-modal__avatar-btns">
                      <label className="wp-flat__btn wp-flat__btn--secondary wp-flat__btn--sm" htmlFor="edit-user-avatar-input">
                        <FiCamera size={13} />
                        {displayPhoto ? 'Change photo' : 'Upload photo'}
                      </label>
                      {displayPhoto ? (
                        <button
                          type="button"
                          className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                          onClick={resetAvatarPicker}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    {fieldError('avatar') ? <small className="wp-user-modal__error">{fieldError('avatar')}</small> : null}
                  </div>
                </div>

                <div className="wp-user-modal__grid">
                  <label className="wp-user-modal__field wp-user-modal__field--span-2">
                    <span>Full name</span>
                    <input
                      className={fieldError('name') ? 'is-invalid' : ''}
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      placeholder="Enter full name"
                      disabled={saving}
                      autoFocus
                      required
                    />
                    {fieldError('name') ? <small className="wp-user-modal__error">{fieldError('name')}</small> : null}
                  </label>

                  <label className="wp-user-modal__field">
                    <span>Email or username</span>
                    <input
                      type="text"
                      autoComplete="username"
                      className={fieldError('email') ? 'is-invalid' : ''}
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      placeholder="Enter email or username"
                      disabled={saving}
                      required
                    />
                    {fieldError('email') ? <small className="wp-user-modal__error">{fieldError('email')}</small> : null}
                  </label>

                  <label className="wp-user-modal__field">
                    <span>New password (optional)</span>
                    <div className="wp-user-modal__password-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        className={fieldError('password') ? 'is-invalid' : ''}
                        value={form.password}
                        onChange={(e) => setField('password', e.target.value)}
                        placeholder="Leave blank to keep current"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        className="wp-user-modal__password-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                    {fieldError('password') ? <small className="wp-user-modal__error">{fieldError('password')}</small> : null}
                  </label>

                  <label className="wp-user-modal__field">
                    <span>Role</span>
                    <select
                      value={form.role}
                      onChange={(e) => setField('role', e.target.value)}
                      disabled={saving || isSelf}
                      title={isSelf ? 'You cannot change your own role' : undefined}
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="wp-user-modal__field">
                    <span>Status</span>
                    <select
                      value={form.is_active ? '1' : '0'}
                      onChange={(e) => setField('is_active', e.target.value === '1')}
                      disabled={saving || isSelf}
                      title={isSelf ? 'You cannot change your own status' : undefined}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </label>

                  <label className="wp-user-modal__field">
                    <span>Mobile number</span>
                    <input
                      value={form.mobile}
                      onChange={(e) => setField('mobile', e.target.value)}
                      placeholder="Enter mobile number"
                      disabled={saving}
                    />
                  </label>

                  <label className="wp-user-modal__field">
                    <span>Employee number</span>
                    <input
                      className={fieldError('employee_no') ? 'is-invalid' : ''}
                      value={form.employee_no}
                      onChange={(e) => setField('employee_no', e.target.value)}
                      placeholder="Enter employee number"
                      disabled={saving}
                    />
                    {fieldError('employee_no') ? <small className="wp-user-modal__error">{fieldError('employee_no')}</small> : null}
                  </label>

                  <label className="wp-user-modal__field">
                    <span>Department</span>
                    <input
                      value={form.department}
                      onChange={(e) => setField('department', e.target.value)}
                      placeholder="Enter department"
                      disabled={saving}
                    />
                  </label>

                  <label className="wp-user-modal__field">
                    <span>Position</span>
                    <input
                      value={form.position}
                      onChange={(e) => setField('position', e.target.value)}
                      placeholder="Enter position"
                      disabled={saving}
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          <footer className="wp-srm__footer">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="wp-srm__btn wp-srm__btn--primary" disabled={saving || loading || !form}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      </div>

      <PhotoLightbox
        src={photoOpen && displayPhoto ? displayPhoto : null}
        title={form?.name || 'Photo'}
        onClose={() => setPhotoOpen(false)}
      />
    </div>
  )
}
