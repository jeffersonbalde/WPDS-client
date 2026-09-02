import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff, FiLock, FiMail, FiArrowRight, FiInfo } from 'react-icons/fi'
import Swal from 'sweetalert2'
import { useAuth } from '../context/AuthContext'
import WestPrimeLoader from '../components/common/WestPrimeLoader'
import logo from '../assets/west_prime_logo.png'
import 'sweetalert2/dist/sweetalert2.min.css'
import './LoginPage.css'

const CAMPUS_BG = '/backgrounds/westprime-login-sign-correct.png'
const CREDENTIALS_ERROR = 'These credentials do not match our records.'

function showForgotPasswordInfo() {
  Swal.fire({
    icon: 'info',
    title: 'Password reset',
    html: `
      <p style="margin:0 0 0.65rem;color:#475569;font-size:0.92rem;line-height:1.55;text-align:left;">
        For security, passwords cannot be reset online.
      </p>
      <p style="margin:0;color:#475569;font-size:0.92rem;line-height:1.55;text-align:left;">
        Please visit the <strong>IT Office</strong> during school hours to request a new password.
        Bring a valid school ID for verification.
      </p>
    `,
    width: 420,
    confirmButtonText: 'Got it',
    confirmButtonColor: '#1036c9',
    buttonsStyling: true,
    focusConfirm: true,
    customClass: {
      popup: 'wp-swal-popup',
      title: 'wp-swal-title',
      htmlContainer: 'wp-swal-html',
      confirmButton: 'wp-swal-confirm',
      icon: 'wp-swal-icon',
    },
  })
}

function validateLogin(email, password) {
  const fieldErrors = { email: '', password: '' }
  const trimmedEmail = email.trim()

  if (!trimmedEmail) {
    fieldErrors.email = 'Email or username is required.'
  }

  if (!password) {
    fieldErrors.password = 'The password field is required.'
  }

  return fieldErrors
}

function resolveLoginError(err) {
  const status = err.response?.status
  const errors = err.response?.data?.errors
  const message = err.response?.data?.message

  if (status === 403) {
    return { general: message || 'Account is deactivated.', fieldErrors: { email: '', password: '' } }
  }

  if (status === 422 && errors) {
    const emailMsg = errors.email?.[0] || ''
    const passwordMsg = errors.password?.[0] || ''
    const isCredentials =
      emailMsg.toLowerCase().includes('credentials') ||
      emailMsg === CREDENTIALS_ERROR

    if (isCredentials && !passwordMsg) {
      return { general: CREDENTIALS_ERROR, fieldErrors: { email: '', password: '' } }
    }

    return {
      general: '',
      fieldErrors: {
        email: isCredentials ? '' : emailMsg,
        password: passwordMsg,
      },
    }
  }

  if (status === 401 || status === 422) {
    return { general: CREDENTIALS_ERROR, fieldErrors: { email: '', password: '' } }
  }

  return {
    general: message || 'Unable to sign in. Please try again.',
    fieldErrors: { email: '', password: '' },
  }
}

export default function LoginPage() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (loading) {
    return (
      <WestPrimeLoader
        variant="fullscreen"
        message="Please wait…"
        label="Loading"
      />
    )
  }

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    const localErrors = validateLogin(email, password)
    if (localErrors.email || localErrors.password) {
      setFieldErrors(localErrors)
      return
    }

    setFieldErrors({ email: '', password: '' })
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate('/')
    } catch (err) {
      const resolved = resolveLoginError(err)
      setError(resolved.general)
      setFieldErrors(resolved.fieldErrors)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`wp-login${ready ? ' is-ready' : ''}`}>
      <aside className="wp-login__visual" aria-hidden="true">
        <img className="wp-login__visual-img" src={CAMPUS_BG} alt="" />
        <div className="wp-login__visual-shade" />

        <div className="wp-login__brand">
          <img src={logo} alt="" className="wp-login__brand-logo" />
          <div className="wp-login__brand-text">
            <span className="wp-login__brand-name">West Prime Horizon Institute, Inc.</span>
            <span className="wp-login__brand-tag">Digital Academic Portal</span>
          </div>
        </div>
      </aside>

      <main className="wp-login__panel">
        <div className="wp-login__panel-inner">
          <div className="wp-login__heading">
            <h1>Welcome back</h1>
            <p>Enter your institutional credentials to continue.</p>
          </div>

          {error && (
            <div className="wp-login__alert" role="alert">
              <FiInfo size={16} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate>
            <div className="wp-login__field">
              <label htmlFor="login-email">Email or username</label>
              <div className="wp-login__input-wrap">
                <FiMail className="wp-login__input-icon" aria-hidden />
                <input
                  id="login-email"
                  className={`form-control${fieldErrors.email ? ' is-invalid' : ''}`}
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your email or username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }))
                    if (error) setError('')
                  }}
                  aria-invalid={!!fieldErrors.email}
                />
              </div>
              {fieldErrors.email && <p className="wp-login__field-error">{fieldErrors.email}</p>}
            </div>

            <div className="wp-login__field">
              <div className="wp-login__label-row">
                <label htmlFor="login-password">Password</label>
                <button
                  type="button"
                  className="wp-login__forgot"
                  onClick={showForgotPasswordInfo}
                >
                  Forgot password?
                </button>
              </div>
              <div className="wp-login__input-wrap">
                <FiLock className="wp-login__input-icon" aria-hidden />
                <input
                  id="login-password"
                  className={`form-control${fieldErrors.password ? ' is-invalid' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }))
                    if (error) setError('')
                  }}
                  aria-invalid={!!fieldErrors.password}
                />
                <button
                  type="button"
                  className="wp-login__toggle-pw"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
              {fieldErrors.password && <p className="wp-login__field-error">{fieldErrors.password}</p>}
            </div>

            <button type="submit" className="wp-login__submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <FiArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="wp-login__footer">
            © {new Date().getFullYear()} West Prime Horizon Institute, Inc.
          </p>
        </div>
      </main>
    </div>
  )
}
