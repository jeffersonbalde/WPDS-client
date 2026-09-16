import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiCamera, FiEye, FiEyeOff, FiUser, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { apiErrorMessage } from '../../utils/apiError'
import { wpConfirmDiscard } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import './AddUserModal.css'

const ANIM_MS = 220
const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp'
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

const CREATE_ROLES = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'registrar', label: 'Registrar' },
  { value: 'it', label: 'IT' },
  { value: 'admin', label: 'Admin' },
  { value: 'stakeholder', label: 'Stakeholder' },
]

function emptyForm() {
  return {
    name: '',
    email: '',
    password: 'password',
    role: 'teacher',
    employee_no: '',
    department: '',
    mobile: '',
  }
}

function snapshot(form) {
  return JSON.stringify({
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
    role: form.role,
    employee_no: form.employee_no.trim(),
    department: form.department.trim(),
    mobile: form.mobile.trim(),
  })
}

export default function AddUserModal({ onClose, onSaved }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const avatarInputRef = useRef(null)
  const [anim, setAnim] = useState('enter')
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const savedSnap = useRef(snapshot(emptyForm())).current
  const dirty = snapshot(form) !== savedSnap || Boolean(avatarFile)

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
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

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
      setErrors((prev) => ({ ...prev, avatar: 'Photo must be 2MB or smaller.' }))
      e.target.value = ''
      return
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
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
    if (!form.password || form.password.length < 6) {
      next.password = 'Password must be at least 6 characters.'
    }
    return next
  }

  async function submit(e) {
    e.preventDefault()
    if (saving) return

    const next = validateForm()
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      const payload = new FormData()
      payload.append('name', form.name.trim())
      payload.append('email', form.email.trim())
      payload.append('password', form.password)
      payload.append('role', form.role)
      if (form.mobile.trim()) payload.append('mobile', form.mobile.trim())
      if (form.employee_no.trim()) payload.append('employee_no', form.employee_no.trim())
      if (form.department.trim()) payload.append('department', form.department.trim())
      if (avatarFile) payload.append('avatar', avatarFile)

      await api.post('/users', payload)
      toast.success('User created successfully.')
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
      toast.error(apiErrorMessage(err, 'Failed to create user.'))
    } finally {
      setSaving(false)
    }
  }

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
          <h2 id={titleId} className="wp-srm__title">Add User</h2>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close" disabled={saving}>
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-user-modal__form" onSubmit={submit} noValidate>
          <div className="wp-srm__body">
            <div className="wp-user-modal__avatar-picker">
              <div className="wp-user-modal__avatar-preview">
                {avatarPreview ? <img src={avatarPreview} alt="" /> : <FiUser size={26} />}
              </div>
              <div className="wp-user-modal__avatar-actions">
                <label className="wp-flat__btn wp-flat__btn--secondary wp-flat__btn--sm" htmlFor="add-user-avatar-input">
                  <FiCamera size={13} />
                  {avatarFile ? 'Change photo' : 'Upload photo'}
                </label>
                <input
                  id="add-user-avatar-input"
                  ref={avatarInputRef}
                  type="file"
                  accept={AVATAR_ACCEPT}
                  hidden
                  disabled={saving}
                  onChange={onAvatarPicked}
                />
                {avatarFile ? (
                  <button
                    type="button"
                    className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                    onClick={resetAvatarPicker}
                    disabled={saving}
                  >
                    Remove
                  </button>
                ) : null}
                <span className="wp-user-modal__avatar-hint">JPG, PNG, or WEBP. Max 2MB. Optional.</span>
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
                <span>Password</span>
                <div className="wp-user-modal__password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={fieldError('password') ? 'is-invalid' : ''}
                    value={form.password}
                    onChange={(e) => setField('password', e.target.value)}
                    placeholder="Enter password"
                    disabled={saving}
                    required
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
                  disabled={saving}
                >
                  {CREATE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
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
                <span>Employee number (optional)</span>
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
            </div>
          </div>

          <footer className="wp-srm__footer">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="wp-srm__btn wp-srm__btn--primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
