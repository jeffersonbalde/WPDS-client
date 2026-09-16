import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { apiErrorMessage } from '../../utils/apiError'
import { wpConfirm, wpConfirmDiscard } from '../../utils/wpSwal'
import '../students/StudentRecordModal.css'
import './AnnouncementFormModal.css'

const ANIM_MS = 220

function emptyForm() {
  return {
    title: '',
    body: '',
    is_published: false,
  }
}

function formFromAnnouncement(announcement) {
  if (!announcement?.id) return emptyForm()
  return {
    title: announcement.title || '',
    body: announcement.body || '',
    is_published: announcement.is_published === true,
  }
}

function snapshot(form) {
  return JSON.stringify({
    title: String(form.title || '').trim(),
    body: String(form.body || '').trim(),
    is_published: Boolean(form.is_published),
  })
}

export default function AnnouncementFormModal({ announcement, onClose, onSaved }) {
  const titleId = useId()
  const closingRef = useRef(false)
  const savedRef = useRef(false)
  const editing = Boolean(announcement?.id)
  const [anim, setAnim] = useState('enter')
  const [form, setForm] = useState(() => formFromAnnouncement(announcement))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const savedSnap = useRef(snapshot(formFromAnnouncement(announcement))).current
  const dirty = snapshot(form) !== savedSnap

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

  async function submit(e) {
    e.preventDefault()
    if (saving) return

    const next = {}
    if (!String(form.title || '').trim()) next.title = 'Title is required.'
    if (!String(form.body || '').trim()) next.body = 'Message is required.'
    setErrors(next)
    if (Object.keys(next).length) return

    const title = form.title.trim()
    const body = form.body.trim()
    const willPublish = Boolean(form.is_published)

    const confirmed = await wpConfirm({
      icon: 'question',
      title: editing ? 'Save announcement changes?' : 'Post this announcement?',
      text: editing
        ? `Save changes to "${title}"?`
        : willPublish
          ? `"${title}" will be published and visible on the student dashboard.`
          : `"${title}" will be saved as a draft (not visible to students yet).`,
      confirmText: editing ? 'Save changes' : (willPublish ? 'Publish' : 'Save draft'),
      focusCancel: false,
    })
    if (!confirmed || closingRef.current) return

    const payload = { title, body, is_published: willPublish }

    setSaving(true)
    try {
      if (editing) {
        await api.put(`/announcements/${announcement.id}`, payload)
        toast.success('Announcement updated.')
      } else {
        await api.post('/announcements', payload)
        toast.success(willPublish ? 'Announcement published.' : 'Draft saved.')
      }
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
      } else {
        toast.error(apiErrorMessage(err, editing ? 'Failed to update announcement.' : 'Failed to create announcement.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return (
    <div
      className={`wp-srm wp-ann-modal${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="wp-srm__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wp-srm__header">
          <h2 id={titleId} className="wp-srm__title">
            {editing ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button type="button" className="wp-srm__icon-btn" onClick={requestClose} aria-label="Close" disabled={saving}>
            <FiX size={18} />
          </button>
        </header>

        <form className="wp-ann-modal__form" onSubmit={submit} noValidate>
          <div className="wp-srm__body">
            <div className="wp-ann-modal__grid">
              <label className="wp-ann-modal__field">
                <span>Title</span>
                <input
                  className={fieldError('title') ? 'is-invalid' : ''}
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="Enter a short headline"
                  maxLength={160}
                  disabled={saving}
                  required
                />
                {fieldError('title') ? <small className="wp-ann-modal__error">{fieldError('title')}</small> : null}
              </label>

              <label className="wp-ann-modal__field">
                <span>Message</span>
                <textarea
                  className={fieldError('body') ? 'is-invalid' : ''}
                  value={form.body}
                  onChange={(e) => setField('body', e.target.value)}
                  placeholder="Write the announcement students will see on their dashboard."
                  maxLength={5000}
                  disabled={saving}
                  required
                />
                {fieldError('body') ? <small className="wp-ann-modal__error">{fieldError('body')}</small> : null}
              </label>

              <label className="wp-ann-modal__field wp-ann-modal__check">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_published)}
                  onChange={(e) => setField('is_published', e.target.checked)}
                  disabled={saving}
                />
                <span>Publish now (visible on the student dashboard)</span>
              </label>
              <span className="wp-ann-modal__hint">
                Leave unchecked to keep this as a draft. You can publish it later.
              </span>
            </div>
          </div>

          <footer className="wp-srm__footer">
            <button type="button" className="wp-srm__btn wp-srm__btn--ghost" onClick={requestClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="wp-srm__btn wp-srm__btn--primary" disabled={saving}>
              {saving ? 'Saving…' : (editing ? 'Save changes' : (form.is_published ? 'Publish' : 'Save draft'))}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
