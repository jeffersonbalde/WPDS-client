import { useCallback, useEffect, useState } from 'react'
import {
  FiRefreshCw,
  FiDownload,
  FiTrash2,
  FiDatabase,
  FiShield,
  FiClock,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import PageLoadingRow from '../components/common/PageLoadingRow'
import { useAuth } from '../context/AuthContext'
import { apiErrorMessage } from '../utils/apiError'
import { excelExportError } from '../utils/excelExport'
import { wpConfirm } from '../utils/wpSwal'
import './StudentsManagePage.css'
import './SystemPage.css'

const TABS = [
  { key: 'backups', label: 'Data Backups' },
  { key: 'password', label: 'Account Security' },
]

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const emptySchedule = {
  enabled: true,
  frequency: 'daily',
  time: '02:00',
  weekday: 1,
  retention_days: 30,
  label: '',
  next_run_at: null,
  last_run_at: null,
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export default function SystemPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('backups')
  const [status, setStatus] = useState(null)
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [deletingName, setDeletingName] = useState(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwErrors, setPwErrors] = useState({})
  const [scheduleForm, setScheduleForm] = useState(emptySchedule)
  const [scheduleSaving, setScheduleSaving] = useState(false)

  function applySchedule(raw) {
    if (!raw) return
    setScheduleForm({
      enabled: !!raw.enabled,
      frequency: raw.frequency === 'weekly' ? 'weekly' : 'daily',
      time: raw.time || '02:00',
      weekday: raw.weekday == null ? 1 : Number(raw.weekday),
      retention_days: Number(raw.retention_days ?? 30),
      label: raw.label || '',
      next_run_at: raw.next_run_at || null,
      last_run_at: raw.last_run_at || null,
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, backupsRes] = await Promise.all([
        api.get('/system/status'),
        api.get('/system/backups'),
      ])
      setStatus(statusRes.data)
      setBackups(backupsRes.data?.data || [])
      applySchedule(statusRes.data?.backup?.schedule || backupsRes.data?.schedule)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load system tools.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createBackup() {
    setWorking(true)
    try {
      const { data } = await api.post('/system/backups')
      toast.success(data.message || 'Backup created.')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create backup.'))
    } finally {
      setWorking(false)
    }
  }

  async function saveSchedule(e) {
    e.preventDefault()
    setScheduleSaving(true)
    try {
      const payload = {
        enabled: !!scheduleForm.enabled,
        frequency: scheduleForm.frequency,
        time: scheduleForm.time,
        retention_days: Number(scheduleForm.retention_days) || 0,
      }
      if (scheduleForm.frequency === 'weekly') {
        payload.weekday = Number(scheduleForm.weekday)
      }
      const { data } = await api.put('/system/backup-schedule', payload)
      toast.success(data.message || 'Schedule saved.')
      applySchedule(data.schedule)
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save backup schedule.'))
    } finally {
      setScheduleSaving(false)
    }
  }

  async function downloadFreshSql() {
    setWorking(true)
    try {
      const response = await api.get('/system/backup', { responseType: 'blob' })
      const disposition = response.headers['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || `wpds-backup-${new Date().toISOString().slice(0, 10)}.sql`
      triggerBlobDownload(new Blob([response.data], { type: 'application/sql' }), filename)
      toast.success('SQL backup downloaded.')
      await load()
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to download SQL backup.'))
    } finally {
      setWorking(false)
    }
  }

  async function downloadFile(name) {
    setWorking(true)
    try {
      const response = await api.get(`/system/backups/${encodeURIComponent(name)}`, {
        responseType: 'blob',
      })
      const type = name.endsWith('.sql') ? 'application/sql' : 'application/json'
      triggerBlobDownload(new Blob([response.data], { type }), name)
      toast.success('Download started.')
    } catch (err) {
      toast.error(await excelExportError(err, 'Failed to download backup file.'))
    } finally {
      setWorking(false)
    }
  }

  async function deleteFile(name) {
    const ok = await wpConfirm({
      icon: 'warning',
      title: 'Delete this backup?',
      text: `${name} will be permanently removed from the server.`,
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return

    setDeletingName(name)
    try {
      await api.delete(`/system/backups/${encodeURIComponent(name)}`)
      toast.success('Backup deleted.')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete backup.'))
    } finally {
      setDeletingName(null)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwErrors({})
    setPwSaving(true)
    try {
      await api.put('/system/password', {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      })
      toast.success('Password updated successfully.')
      setCurrentPassword('')
      setPassword('')
      setPasswordConfirmation('')
    } catch (err) {
      const data = err?.response?.data
      if (data?.errors) {
        const mapped = {}
        Object.entries(data.errors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setPwErrors(mapped)
      }
      toast.error(apiErrorMessage(err, 'Failed to update password.'))
    } finally {
      setPwSaving(false)
    }
  }

  const backupMeta = status?.backup || {}
  const sqlRows = backups.filter((f) => f.format === 'sql')
  const jsonRows = backups.filter((f) => f.format === 'json')

  return (
    <div className="wp-flat wp-system">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">Backup & Security</h1>
          <p className="wp-flat__sub">
            Create SQL database backups, review stored files, and update your IT account password.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading || working}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
        </div>
      </div>

      <div className="wp-system__tabs" role="tablist" aria-label="Backup and security sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`wp-system__tab${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'backups' ? (
        <div className="wp-system__section">
          <div className="wp-system__panel">
            <div className="wp-system__panel-head">
              <span>Backup actions</span>
            </div>
            <div className="wp-system__panel-body">
              <div className="wp-system__actions">
                <button
                  type="button"
                  className="wp-flat__btn wp-flat__btn--export"
                  onClick={downloadFreshSql}
                  disabled={working}
                >
                  <FiDownload size={15} />
                  {working ? 'Working…' : 'Download SQL backup'}
                </button>
                <button
                  type="button"
                  className="wp-flat__btn wp-flat__btn--primary"
                  onClick={createBackup}
                  disabled={working}
                >
                  <FiDatabase size={15} />
                  Create & keep on server
                </button>
              </div>

              <div className="wp-system__meta-grid">
                <div className="wp-system__meta">
                  <FiClock size={16} />
                  <div>
                    <span className="wp-system__meta-label">Schedule</span>
                    <span className="wp-system__meta-value">
                      {loading ? '…' : (scheduleForm.label || (scheduleForm.enabled ? 'Configured' : 'Disabled'))}
                    </span>
                  </div>
                </div>
                <div className="wp-system__meta">
                  <FiShield size={16} />
                  <div>
                    <span className="wp-system__meta-label">Next automatic backup</span>
                    <span className="wp-system__meta-value">
                      {loading ? '…' : formatWhen(scheduleForm.next_run_at)}
                    </span>
                  </div>
                </div>
                <div className="wp-system__meta">
                  <FiDatabase size={16} />
                  <div>
                    <span className="wp-system__meta-label">Latest SQL backup</span>
                    <span className="wp-system__meta-value">
                      {loading
                        ? '…'
                        : backupMeta.latest?.name
                          ? `${backupMeta.latest.name} · ${formatWhen(backupMeta.latest.generated_at)}`
                          : 'None yet'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="wp-system__panel">
            <div className="wp-system__panel-head">Automatic backup schedule</div>
            <div className="wp-system__panel-body">
              <form onSubmit={saveSchedule} className="wp-system__schedule-form">
                <div className="wp-system__schedule-grid">
                  <div className="wp-system__field">
                    <label className="form-label" htmlFor="bk-enabled">Auto backup</label>
                    <select
                      id="bk-enabled"
                      className="form-select"
                      value={scheduleForm.enabled ? '1' : '0'}
                      onChange={(e) => setScheduleForm((s) => ({ ...s, enabled: e.target.value === '1' }))}
                    >
                      <option value="1">Enabled</option>
                      <option value="0">Disabled</option>
                    </select>
                  </div>

                  <div className="wp-system__field">
                    <label className="form-label" htmlFor="bk-frequency">Frequency</label>
                    <select
                      id="bk-frequency"
                      className="form-select"
                      value={scheduleForm.frequency}
                      onChange={(e) => setScheduleForm((s) => ({ ...s, frequency: e.target.value }))}
                      disabled={!scheduleForm.enabled}
                    >
                      <option value="daily">Every day</option>
                      <option value="weekly">Once a week</option>
                    </select>
                  </div>

                  {scheduleForm.frequency === 'weekly' ? (
                    <div className="wp-system__field">
                      <label className="form-label" htmlFor="bk-weekday">Day</label>
                      <select
                        id="bk-weekday"
                        className="form-select"
                        value={scheduleForm.weekday}
                        onChange={(e) => setScheduleForm((s) => ({ ...s, weekday: Number(e.target.value) }))}
                        disabled={!scheduleForm.enabled}
                      >
                        {WEEKDAYS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="wp-system__field">
                    <label className="form-label" htmlFor="bk-time">Time</label>
                    <input
                      id="bk-time"
                      type="time"
                      className="form-control"
                      value={scheduleForm.time}
                      onChange={(e) => setScheduleForm((s) => ({ ...s, time: e.target.value }))}
                      disabled={!scheduleForm.enabled}
                      required
                    />
                  </div>

                  <div className="wp-system__field">
                    <label className="form-label" htmlFor="bk-retention">Keep files (days)</label>
                    <input
                      id="bk-retention"
                      type="number"
                      min={0}
                      max={3650}
                      className="form-control"
                      value={scheduleForm.retention_days}
                      onChange={(e) => setScheduleForm((s) => ({
                        ...s,
                        retention_days: e.target.value === '' ? 0 : Number(e.target.value),
                      }))}
                    />
                  </div>
                </div>

                <div className="wp-system__schedule-foot">
                  <span className="wp-system__schedule-hint">
                    Last auto run: {formatWhen(scheduleForm.last_run_at)}
                    {scheduleForm.retention_days === 0 ? ' · Keep all files' : ` · Delete after ${scheduleForm.retention_days} days`}
                  </span>
                  <button
                    type="submit"
                    className="wp-flat__btn wp-flat__btn--primary"
                    disabled={scheduleSaving || loading}
                  >
                    {scheduleSaving ? 'Saving…' : 'Save schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="wp-flat__panel">
            <div className="table-responsive">
              <table className="wp-flat__table">
                <thead>
                  <tr>
                    <th className="wp-flat__num">#</th>
                    <th>Actions</th>
                    <th>Filename</th>
                    <th>Format</th>
                    <th>Size</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <PageLoadingRow colSpan={6} message="Loading backups…" />
                  ) : backups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="wp-flat__empty">
                        No backup files on the server yet. Create or download a SQL backup to begin.
                      </td>
                    </tr>
                  ) : (
                    backups.map((file, idx) => (
                      <tr key={file.name}>
                        <td className="wp-flat__num">{idx + 1}</td>
                        <td>
                          <div className="wp-flat__actions">
                            <button
                              type="button"
                              className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                              onClick={() => downloadFile(file.name)}
                              disabled={working}
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              className="wp-flat__btn wp-flat__btn--danger wp-flat__btn--sm"
                              onClick={() => deleteFile(file.name)}
                              disabled={deletingName === file.name || working}
                            >
                              <FiTrash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                        <td>{file.name}</td>
                        <td>
                          <span className="wp-flat__status">{String(file.format || '').toUpperCase()}</span>
                        </td>
                        <td>{formatBytes(file.size)}</td>
                        <td>{formatWhen(file.generated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="wp-flat__footer">
              <span className="wp-flat__footer-meta">
                {sqlRows.length} SQL · {jsonRows.length} JSON · {backups.length} total
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'password' ? (
        <div className="wp-system__section">
          <div className="wp-system__panel wp-system__panel--narrow">
            <div className="wp-system__panel-head">IT account password</div>
            <div className="wp-system__panel-body">
              <p className="wp-system__lead">
                Your login email is fixed. Only the password can be changed here.
              </p>

              <div className="wp-system__field">
                <label className="form-label" htmlFor="it-email">Email / Username</label>
                <input
                  id="it-email"
                  className="form-control"
                  value={user?.email || ''}
                  readOnly
                  disabled
                />
              </div>

              <form onSubmit={changePassword} className="wp-system__pw-form" noValidate>
                <div className="wp-system__field">
                  <label className="form-label" htmlFor="it-current-pw">Current password</label>
                  <div className="wp-system__pw-wrap">
                    <input
                      id="it-current-pw"
                      type={showCurrentPw ? 'text' : 'password'}
                      className={`form-control${pwErrors.current_password ? ' is-invalid' : ''}`}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="wp-system__pw-toggle"
                      aria-label={showCurrentPw ? 'Hide current password' : 'Show current password'}
                      onClick={() => setShowCurrentPw((v) => !v)}
                    >
                      {showCurrentPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                  {pwErrors.current_password ? (
                    <div className="invalid-feedback d-block">{pwErrors.current_password}</div>
                  ) : null}
                </div>

                <div className="wp-system__field">
                  <label className="form-label" htmlFor="it-new-pw">New password</label>
                  <div className="wp-system__pw-wrap">
                    <input
                      id="it-new-pw"
                      type={showNewPw ? 'text' : 'password'}
                      className={`form-control${pwErrors.password ? ' is-invalid' : ''}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="wp-system__pw-toggle"
                      aria-label={showNewPw ? 'Hide new password' : 'Show new password'}
                      onClick={() => setShowNewPw((v) => !v)}
                    >
                      {showNewPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                  {pwErrors.password ? (
                    <div className="invalid-feedback d-block">{pwErrors.password}</div>
                  ) : null}
                </div>

                <div className="wp-system__field">
                  <label className="form-label" htmlFor="it-confirm-pw">Confirm new password</label>
                  <div className="wp-system__pw-wrap">
                    <input
                      id="it-confirm-pw"
                      type={showConfirmPw ? 'text' : 'password'}
                      className={`form-control${pwErrors.password_confirmation ? ' is-invalid' : ''}`}
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="wp-system__pw-toggle"
                      aria-label={showConfirmPw ? 'Hide confirm password' : 'Show confirm password'}
                      onClick={() => setShowConfirmPw((v) => !v)}
                    >
                      {showConfirmPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                  {pwErrors.password_confirmation ? (
                    <div className="invalid-feedback d-block">{pwErrors.password_confirmation}</div>
                  ) : null}
                </div>

                <div className="wp-system__form-actions">
                  <button type="submit" className="wp-flat__btn wp-flat__btn--primary" disabled={pwSaving}>
                    {pwSaving ? 'Saving…' : 'Update password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
