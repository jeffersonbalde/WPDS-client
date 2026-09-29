import { useEffect, useRef, useState } from 'react'
import { FiCamera, FiImage, FiRefreshCw, FiSave } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../../api/client'
import { useBranding } from '../../context/BrandingContext'
import { apiErrorMessage } from '../../utils/apiError'
import { DEFAULT_BRANDING } from '../../utils/branding'
import { wpConfirm } from '../../utils/wpSwal'

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'
const LOGO_MAX = 20 * 1024 * 1024
const LOGO_MAX_LABEL = '20 MB'
const FAVICON_MAX = 5 * 1024 * 1024
const FAVICON_MAX_LABEL = '5 MB'
const BG_MAX = 10 * 1024 * 1024
const BG_MAX_LABEL = '10 MB'

function emptyForm(branding) {
  return {
    system_name: branding.system_name || '',
    system_short_name: branding.system_short_name || '',
    tagline: branding.tagline || '',
    login_heading: branding.login_heading || '',
    login_subtitle: branding.login_subtitle || '',
    footer_text: branding.footer_text || '',
  }
}

function validateImage(file, maxBytes, label) {
  if (!file) return `${label} is required.`
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return `${label} must be a JPG, PNG, or WEBP image.`
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024))
    return `${label} must be ${mb} MB or smaller.`
  }
  return ''
}

export default function SystemBrandingPanel({ disabled = false }) {
  const { branding, setBrandingFromPayload, refreshBranding } = useBranding()
  const [form, setForm] = useState(() => emptyForm(branding))
  const [errors, setErrors] = useState({})
  const [savingTexts, setSavingTexts] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [resetting, setResetting] = useState(false)

  const logoRef = useRef(null)
  const faviconRef = useRef(null)
  const bgRef = useRef(null)

  useEffect(() => {
    setForm(emptyForm(branding))
  }, [branding])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function saveTexts(e) {
    e.preventDefault()
    const nextErrors = {}
    Object.entries(form).forEach(([key, value]) => {
      if (!String(value || '').trim()) nextErrors[key] = 'This field is required.'
    })
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setSavingTexts(true)
    try {
      const { data } = await api.put('/system/branding', {
        system_name: form.system_name.trim(),
        system_short_name: form.system_short_name.trim(),
        tagline: form.tagline.trim(),
        login_heading: form.login_heading.trim(),
        login_subtitle: form.login_subtitle.trim(),
        footer_text: form.footer_text.trim(),
      })
      setBrandingFromPayload(data.branding)
      toast.success(data.message || 'Changes saved.')
    } catch (err) {
      const serverErrors = err.response?.data?.errors
      if (serverErrors && typeof serverErrors === 'object') {
        const mapped = {}
        Object.entries(serverErrors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setErrors(mapped)
      }
      toast.error(apiErrorMessage(err, 'Failed to save changes.'))
    } finally {
      setSavingTexts(false)
    }
  }

  async function uploadAsset(kind, file) {
    const fd = new FormData()
    let url = ''
    let field = ''
    if (kind === 'logo') {
      url = '/system/branding/logo'
      field = 'logo'
      fd.append('logo', file)
    } else if (kind === 'favicon') {
      url = '/system/branding/favicon'
      field = 'favicon'
      fd.append('favicon', file)
    } else {
      url = '/system/branding/login-bg'
      field = 'login_bg'
      fd.append('login_bg', file)
    }

    setUploading(kind)
    try {
      const { data } = await api.post(url, fd)
      setBrandingFromPayload(data.branding)
      toast.success(data.message || 'Image updated.')
    } catch (err) {
      const serverErrors = err.response?.data?.errors
      if (serverErrors?.[field]) {
        toast.error(Array.isArray(serverErrors[field]) ? serverErrors[field][0] : String(serverErrors[field]))
      } else {
        toast.error(apiErrorMessage(err, 'Failed to upload image.'))
      }
    } finally {
      setUploading(null)
    }
  }

  async function onPick(kind, e, maxBytes, label) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const message = validateImage(file, maxBytes, label)
    if (message) {
      toast.error(message)
      return
    }
    await uploadAsset(kind, file)
  }

  async function clearAsset(kind) {
    const labels = {
      logo: 'Restore the default system logo?',
      favicon: 'Restore the default favicon?',
      'login-bg': 'Restore the default login background?',
    }
    const ok = await wpConfirm({
      icon: 'question',
      title: 'Use default image?',
      text: labels[kind],
      confirmText: 'Restore default',
    })
    if (!ok) return

    setUploading(kind)
    try {
      const path = kind === 'login-bg' ? '/system/branding/login-bg' : `/system/branding/${kind}`
      const { data } = await api.delete(path)
      setBrandingFromPayload(data.branding)
      toast.success(data.message || 'Default image restored.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to restore default image.'))
    } finally {
      setUploading(null)
    }
  }

  async function resetAll() {
    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Reset to defaults?',
      text: 'The name, texts, logo, favicon, and login background will go back to the original West Prime settings.',
      confirmText: 'Reset',
      danger: true,
    })
    if (!ok) return

    setResetting(true)
    try {
      const { data } = await api.post('/system/branding/reset')
      setBrandingFromPayload(data.branding || DEFAULT_BRANDING)
      toast.success(data.message || 'Defaults restored.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to reset.'))
    } finally {
      setResetting(false)
    }
  }

  const busy = disabled || savingTexts || resetting || Boolean(uploading)

  return (
    <div className="wp-system__section">
      <div className="wp-system__panel">
        <div className="wp-system__panel-head">Name & text</div>
        <div className="wp-system__panel-body">
          <p className="wp-system__lead">
            Edit the school name and the text shown on the login page and footer.
          </p>
          <form className="wp-system__brand-form" onSubmit={saveTexts}>
            <label className="wp-system__field">
              <span>System name</span>
              <input
                className={errors.system_name ? 'is-invalid' : ''}
                value={form.system_name}
                onChange={(e) => setField('system_name', e.target.value)}
                disabled={busy}
                maxLength={120}
              />
              {errors.system_name ? <small>{errors.system_name}</small> : null}
            </label>
            <label className="wp-system__field">
              <span>Short name (browser title)</span>
              <input
                className={errors.system_short_name ? 'is-invalid' : ''}
                value={form.system_short_name}
                onChange={(e) => setField('system_short_name', e.target.value)}
                disabled={busy}
                maxLength={80}
              />
              {errors.system_short_name ? <small>{errors.system_short_name}</small> : null}
            </label>
            <label className="wp-system__field">
              <span>Tagline</span>
              <input
                className={errors.tagline ? 'is-invalid' : ''}
                value={form.tagline}
                onChange={(e) => setField('tagline', e.target.value)}
                disabled={busy}
                maxLength={160}
              />
              {errors.tagline ? <small>{errors.tagline}</small> : null}
            </label>
            <label className="wp-system__field">
              <span>Login heading</span>
              <input
                className={errors.login_heading ? 'is-invalid' : ''}
                value={form.login_heading}
                onChange={(e) => setField('login_heading', e.target.value)}
                disabled={busy}
                maxLength={120}
              />
              {errors.login_heading ? <small>{errors.login_heading}</small> : null}
            </label>
            <label className="wp-system__field wp-system__field--full">
              <span>Login subtitle</span>
              <textarea
                className={errors.login_subtitle ? 'is-invalid' : ''}
                value={form.login_subtitle}
                onChange={(e) => setField('login_subtitle', e.target.value)}
                disabled={busy}
                rows={2}
                maxLength={240}
              />
              {errors.login_subtitle ? <small>{errors.login_subtitle}</small> : null}
            </label>
            <label className="wp-system__field wp-system__field--full">
              <span>Footer text</span>
              <input
                className={errors.footer_text ? 'is-invalid' : ''}
                value={form.footer_text}
                onChange={(e) => setField('footer_text', e.target.value)}
                disabled={busy}
                maxLength={160}
              />
              {errors.footer_text ? <small>{errors.footer_text}</small> : null}
            </label>
            <div className="wp-system__brand-actions">
              <button type="submit" className="wp-flat__btn wp-flat__btn--primary" disabled={busy}>
                <FiSave size={15} />
                {savingTexts ? 'Saving…' : 'Save texts'}
              </button>
              <button
                type="button"
                className="wp-flat__btn wp-flat__btn--secondary"
                onClick={() => refreshBranding()}
                disabled={busy}
              >
                <FiRefreshCw size={15} />
                Reload
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="wp-system__panel">
        <div className="wp-system__panel-head">Images</div>
        <div className="wp-system__panel-body">
          <p className="wp-system__lead">
            Upload a new logo, favicon, or login campus photo. Leave blank to keep the current defaults.
          </p>

          <div className="wp-system__media-grid">
            <div className="wp-system__media-card">
              <div className="wp-system__media-preview wp-system__media-preview--logo">
                <img src={branding.logo_url} alt="" />
              </div>
              <div className="wp-system__media-meta">
                <strong>System logo</strong>
                <span>Shown on login, sidebar, and loading screens. JPG/PNG/WEBP · up to {LOGO_MAX_LABEL}.</span>
                <div className="wp-system__media-actions">
                  <input
                    ref={logoRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    hidden
                    disabled={busy}
                    onChange={(e) => onPick('logo', e, LOGO_MAX, 'Logo')}
                  />
                  <button
                    type="button"
                    className="wp-flat__btn wp-flat__btn--secondary wp-flat__btn--sm"
                    disabled={busy}
                    onClick={() => logoRef.current?.click()}
                  >
                    <FiCamera size={13} />
                    {uploading === 'logo' ? 'Uploading…' : branding.has_custom_logo ? 'Change logo' : 'Upload logo'}
                  </button>
                  {branding.has_custom_logo ? (
                    <button
                      type="button"
                      className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                      disabled={busy}
                      onClick={() => clearAsset('logo')}
                    >
                      Use default
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="wp-system__media-card">
              <div className="wp-system__media-preview wp-system__media-preview--favicon">
                <img src={branding.favicon_url} alt="" />
              </div>
              <div className="wp-system__media-meta">
                <strong>Favicon</strong>
                <span>Browser tab icon. Square PNG/JPG/WEBP · up to {FAVICON_MAX_LABEL}.</span>
                <div className="wp-system__media-actions">
                  <input
                    ref={faviconRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    hidden
                    disabled={busy}
                    onChange={(e) => onPick('favicon', e, FAVICON_MAX, 'Favicon')}
                  />
                  <button
                    type="button"
                    className="wp-flat__btn wp-flat__btn--secondary wp-flat__btn--sm"
                    disabled={busy}
                    onClick={() => faviconRef.current?.click()}
                  >
                    <FiCamera size={13} />
                    {uploading === 'favicon' ? 'Uploading…' : branding.has_custom_favicon ? 'Change favicon' : 'Upload favicon'}
                  </button>
                  {branding.has_custom_favicon ? (
                    <button
                      type="button"
                      className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                      disabled={busy}
                      onClick={() => clearAsset('favicon')}
                    >
                      Use default
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="wp-system__media-card wp-system__media-card--wide">
              <div className="wp-system__media-preview wp-system__media-preview--bg">
                <img src={branding.login_bg_url} alt="" />
              </div>
              <div className="wp-system__media-meta">
                <strong>Login background</strong>
                <span>Full-bleed campus photo on the login page. JPG/PNG/WEBP · up to {BG_MAX_LABEL}.</span>
                <div className="wp-system__media-actions">
                  <input
                    ref={bgRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    hidden
                    disabled={busy}
                    onChange={(e) => onPick('login-bg', e, BG_MAX, 'Login background')}
                  />
                  <button
                    type="button"
                    className="wp-flat__btn wp-flat__btn--secondary wp-flat__btn--sm"
                    disabled={busy}
                    onClick={() => bgRef.current?.click()}
                  >
                    <FiImage size={13} />
                    {uploading === 'login-bg' ? 'Uploading…' : branding.has_custom_login_bg ? 'Change background' : 'Upload background'}
                  </button>
                  {branding.has_custom_login_bg ? (
                    <button
                      type="button"
                      className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                      disabled={busy}
                      onClick={() => clearAsset('login-bg')}
                    >
                      Use default
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="wp-system__panel wp-system__panel--narrow">
        <div className="wp-system__panel-head">Reset</div>
        <div className="wp-system__panel-body">
          <p className="wp-system__lead">
            Restore the original West Prime name, texts, logo, favicon, and login background in one step.
          </p>
          <button
            type="button"
            className="wp-flat__btn wp-flat__btn--danger"
            disabled={busy}
            onClick={resetAll}
          >
            {resetting ? 'Resetting…' : 'Reset to defaults'}
          </button>
        </div>
      </div>
    </div>
  )
}
