import { useEffect, useMemo, useState } from 'react'
import {
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUserPlus,
  FiX,
  FiShield,
  FiUsers,
  FiUserCheck,
  FiUserX,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import PageLoadingRow from '../components/common/PageLoadingRow'
import Swal from 'sweetalert2'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { apiErrorMessage } from '../utils/apiError'
import { wpConfirm } from '../utils/wpSwal'
import './UsersPage.css'

const ALL_ROLES = [
  { value: 'student', label: 'Student', group: 'learner' },
  { value: 'alumni', label: 'Alumni', group: 'learner' },
  { value: 'teacher', label: 'Teacher', group: 'faculty' },
  { value: 'registrar', label: 'Registrar', group: 'staff' },
  { value: 'it', label: 'IT', group: 'staff' },
  { value: 'admin', label: 'Admin', group: 'staff' },
  { value: 'stakeholder', label: 'Stakeholder', group: 'staff' },
]

/** Staff accounts only — students are created by Registrar */
const CREATE_ROLES = ALL_ROLES.filter((r) => r.group !== 'learner')

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'learner', label: 'Students & Alumni' },
  { id: 'faculty', label: 'Teachers' },
  { id: 'staff', label: 'Staff' },
]

const emptyForm = {
  name: '',
  email: '',
  password: 'password',
  role: 'teacher',
  employee_no: '',
  department: '',
  mobile: '',
}

function roleMeta(role) {
  return ALL_ROLES.find((r) => r.value === role) || { value: role, label: role, group: 'staff' }
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/users', { params: { per_page: 100 } })
      setRows(data.data || data || [])
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load users.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    function onKey(e) {
      if (e.key === 'Escape' && !saving) setModalOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [modalOpen, saving])

  const stats = useMemo(() => {
    const total = rows.length
    const active = rows.filter((u) => u.is_active).length
    return {
      total,
      active,
      inactive: total - active,
      students: rows.filter((u) => u.role === 'student' || u.role === 'alumni').length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((u) => {
      const meta = roleMeta(u.role)
      if (category !== 'all' && meta.group !== category) return false
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter === 'active' && !u.is_active) return false
      if (statusFilter === 'inactive' && u.is_active) return false
      if (!q) return true
      return (
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, category, roleFilter, statusFilter])

  function openModal() {
    setForm(emptyForm)
    setFormErrors({})
    setShowPassword(false)
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setFormErrors({})
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFormErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validateForm() {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Name is required.'
    const loginId = form.email.trim()
    if (!loginId) {
      errors.email = 'Email or username is required.'
    } else if (loginId.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)) {
        errors.email = 'Enter a valid email address.'
      }
    } else if (!/^[a-zA-Z0-9._-]{3,60}$/.test(loginId)) {
      errors.email = 'Username must be 3–60 characters (letters, numbers, . _ -).'
    }
    if (!form.password || form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters.'
    }
    if (!form.employee_no.trim()) {
      errors.employee_no = 'Employee number is required.'
    }
    return errors
  }

  async function createUser(e) {
    e.preventDefault()
    const errors = validateForm()
    setFormErrors(errors)
    if (Object.keys(errors).length) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        mobile: form.mobile.trim() || null,
        employee_no: form.employee_no.trim(),
        department: form.department.trim() || 'West Prime Horizon Institute',
      }

      await api.post('/users', payload)
      toast.success('User created successfully.')
      setModalOpen(false)
      setForm(emptyForm)
      await load()
    } catch (err) {
      const data = err?.response?.data
      if (data?.errors) {
        const mapped = {}
        Object.entries(data.errors).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        })
        setFormErrors(mapped)
      }
      toast.error(apiErrorMessage(err, 'Failed to create user.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(user) {
    if (currentUser?.id === user.id) {
      toast.info('You cannot deactivate your own account.')
      return
    }

    const next = !user.is_active
    const ok = await wpConfirm({
      icon: 'question',
      title: next ? 'Activate user?' : 'Deactivate user?',
      text: next
        ? `${user.name} will be able to sign in again.`
        : `${user.name} will no longer be able to sign in.`,
      confirmText: next ? 'Activate' : 'Deactivate',
      cancelText: 'Cancel',
      danger: !next,
    })
    if (!ok) return

    try {
      await api.put(`/users/${user.id}`, { is_active: next })
      toast.success(next ? 'User activated.' : 'User deactivated.')
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update user status.'))
    }
  }

  async function resetPassword(user) {
    const { value: password } = await Swal.fire({
      title: 'Reset password',
      html: `<p style="margin:0 0 0.75rem;color:#64748b;font-size:0.9rem;">Set a new password for <strong>${user.name}</strong>.</p>`,
      input: 'text',
      inputValue: 'password',
      inputPlaceholder: 'New password (min. 6 characters)',
      showCancelButton: true,
      confirmButtonText: 'Reset password',
      cancelButtonText: 'Cancel',
      width: 420,
      padding: '1.5rem 1.5rem 1.25rem',
      buttonsStyling: false,
      customClass: {
        popup: 'wp-swal',
        icon: 'wp-swal__icon',
        title: 'wp-swal__title',
        htmlContainer: 'wp-swal__text',
        actions: 'wp-swal__actions',
        confirmButton: 'wp-swal__btn wp-swal__btn--primary',
        cancelButton: 'wp-swal__btn wp-swal__btn--secondary',
        input: 'wp-swal__input',
      },
      inputValidator: (v) => {
        if (!v || String(v).length < 6) return 'Password must be at least 6 characters.'
        return null
      },
    })
    if (!password) return

    try {
      await api.post(`/users/${user.id}/reset-password`, { password })
      toast.success(`Password reset for ${user.email}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to reset password.'))
    }
  }

  return (
    <div className="wp-users">
      <div className="wp-users__header">
        <div>
          <h1 className="wp-users__title">User Management</h1>
          <p className="wp-users__sub">
            Manage staff accounts and portal access. Student accounts are created by the Registrar.
          </p>
        </div>
        <div className="wp-users__header-actions">
          <button type="button" className="wp-users__btn wp-users__btn--ghost" onClick={load} disabled={loading}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} />
            Refresh
          </button>
          <button type="button" className="wp-users__btn wp-users__btn--primary" onClick={openModal}>
            <FiPlus />
            Add User
          </button>
        </div>
      </div>

      <div className="wp-users__stats">
        <div className="wp-users__stat">
          <span className="wp-users__stat-icon"><FiUsers /></span>
          <div>
            <div className="wp-users__stat-label">Total users</div>
            <div className="wp-users__stat-value">{stats.total}</div>
          </div>
        </div>
        <div className="wp-users__stat">
          <span className="wp-users__stat-icon is-ok"><FiUserCheck /></span>
          <div>
            <div className="wp-users__stat-label">Active</div>
            <div className="wp-users__stat-value">{stats.active}</div>
          </div>
        </div>
        <div className="wp-users__stat">
          <span className="wp-users__stat-icon is-warn"><FiUserX /></span>
          <div>
            <div className="wp-users__stat-label">Inactive</div>
            <div className="wp-users__stat-value">{stats.inactive}</div>
          </div>
        </div>
        <div className="wp-users__stat">
          <span className="wp-users__stat-icon is-blue"><FiShield /></span>
          <div>
            <div className="wp-users__stat-label">Learners</div>
            <div className="wp-users__stat-value">{stats.students}</div>
          </div>
        </div>
      </div>

      <div className="wp-users__toolbar">
        <div className="wp-users__cats" role="tablist" aria-label="User categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              className={`wp-users__cat${category === c.id ? ' is-active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="wp-users__filters">
          <div className="wp-users__search">
            <FiSearch aria-hidden />
            <input
              type="search"
              className="form-control"
              placeholder="Search name or email / username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select wp-users__select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <select
            className="form-select wp-users__select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="wp-users__panel">
        <div className="wp-users__panel-head">
          <span>
            {filtered.length} user{filtered.length === 1 ? '' : 's'} found
          </span>
        </div>
        <div className="table-responsive">
          <table className="wp-users__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email / Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PageLoadingRow colSpan={5} message="Loading…" cellClassName="wp-users__empty wp-flat__loading-cell" />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wp-users__empty">No users match your filters.</td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="wp-users__name">{u.name}</div>
                      {u.staff_profile?.employee_no || u.student_profile?.student_no ? (
                        <div className="wp-users__meta">
                          {u.staff_profile?.employee_no
                            ? `Emp: ${u.staff_profile.employee_no}`
                            : `Student: ${u.student_profile.student_no}`}
                        </div>
                      ) : null}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`wp-users__badge wp-users__badge--${u.role}`}>
                        {roleMeta(u.role).label}
                      </span>
                    </td>
                    <td>
                      <span className={`wp-users__status${u.is_active ? ' is-active' : ' is-inactive'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="wp-users__actions">
                        <button
                          type="button"
                          className="wp-users__btn wp-users__btn--sm wp-users__btn--ghost"
                          onClick={() => toggleActive(u)}
                          disabled={currentUser?.id === u.id}
                          title={currentUser?.id === u.id ? 'Cannot change your own status' : undefined}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="wp-users__btn wp-users__btn--sm wp-users__btn--primary"
                          onClick={() => resetPassword(u)}
                        >
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <div className="wp-users__modal-root" role="presentation">
          <button type="button" className="wp-users__modal-backdrop" aria-label="Close" onClick={closeModal} />
          <div
            className="wp-users__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wp-users-modal-title"
          >
            <div className="wp-users__modal-head">
              <div className="wp-users__modal-title-wrap">
                <span className="wp-users__modal-icon"><FiUserPlus /></span>
                <div>
                  <h2 id="wp-users-modal-title">Add User</h2>
                  <p>Create a staff portal account. Student accounts are created by the Registrar.</p>
                </div>
              </div>
              <button type="button" className="wp-users__modal-close" onClick={closeModal} aria-label="Close">
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={createUser} className="wp-users__modal-body" noValidate>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label" htmlFor="user-name">Full name</label>
                  <input
                    id="user-name"
                    className={`form-control${formErrors.name ? ' is-invalid' : ''}`}
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Enter full name"
                    autoFocus
                  />
                  {formErrors.name ? <div className="invalid-feedback d-block">{formErrors.name}</div> : null}
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="user-email">Email or username</label>
                  <input
                    id="user-email"
                    type="text"
                    autoComplete="username"
                    className={`form-control${formErrors.email ? ' is-invalid' : ''}`}
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="Enter email or username"
                  />
                  {formErrors.email ? <div className="invalid-feedback d-block">{formErrors.email}</div> : null}
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="user-password">Password</label>
                  <div className="wp-users__password-wrap">
                    <input
                      id="user-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={`form-control${formErrors.password ? ' is-invalid' : ''}`}
                      value={form.password}
                      onChange={(e) => setField('password', e.target.value)}
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      className="wp-users__password-toggle"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                  {formErrors.password ? <div className="invalid-feedback d-block">{formErrors.password}</div> : null}
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="user-role">Role</label>
                  <select
                    id="user-role"
                    className="form-select"
                    value={form.role}
                    onChange={(e) => setField('role', e.target.value)}
                  >
                    {CREATE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="user-mobile">Mobile number</label>
                  <input
                    id="user-mobile"
                    className="form-control"
                    value={form.mobile}
                    onChange={(e) => setField('mobile', e.target.value)}
                    placeholder="Enter mobile number"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="user-emp">Employee number</label>
                  <input
                    id="user-emp"
                    className={`form-control${formErrors.employee_no ? ' is-invalid' : ''}`}
                    value={form.employee_no}
                    onChange={(e) => setField('employee_no', e.target.value)}
                    placeholder="Enter employee number"
                  />
                  {formErrors.employee_no ? (
                    <div className="invalid-feedback d-block">{formErrors.employee_no}</div>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="user-dept">Department</label>
                  <input
                    id="user-dept"
                    className="form-control"
                    value={form.department}
                    onChange={(e) => setField('department', e.target.value)}
                    placeholder="Enter department"
                  />
                </div>
              </div>

              <div className="wp-users__modal-foot">
                <button type="button" className="wp-users__btn wp-users__btn--ghost" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="wp-users__btn wp-users__btn--primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
