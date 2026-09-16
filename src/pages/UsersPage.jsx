import { useCallback, useEffect, useState } from 'react'
import { FiPlus, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import Swal from 'sweetalert2'
import FlatPager from '../components/common/FlatPager'
import AddUserModal from '../components/users/AddUserModal'
import StudentRecordModal from '../components/students/StudentRecordModal'
import StaffUserViewModal from '../components/users/StaffUserViewModal'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { apiErrorMessage } from '../utils/apiError'
import { initialsOf } from '../utils/avatar'
import { wpConfirm } from '../utils/wpSwal'
import './StudentsManagePage.css'
import './UsersPage.css'

const ALL_ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'registrar', label: 'Registrar' },
  { value: 'it', label: 'IT' },
  { value: 'admin', label: 'Admin' },
  { value: 'stakeholder', label: 'Stakeholder' },
]

const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp'
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

const emptyMeta = { current_page: 1, last_page: 1, total: 0, from: 0, to: 0 }
const emptySummary = { total: 0, active: 0, inactive: 0, students: 0 }

function roleLabel(role) {
  return ALL_ROLES.find((r) => r.value === role)?.label || role
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(emptyMeta)
  const [summary, setSummary] = useState(emptySummary)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [cardAvatarBusyId, setCardAvatarBusyId] = useState(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [viewStudentId, setViewStudentId] = useState(null)
  const [viewUserId, setViewUserId] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async (opts = {}) => {
    const pageNum = opts.page ?? page
    const perPageNum = opts.perPage ?? perPage
    setLoading(true)
    try {
      const params = { page: pageNum, per_page: perPageNum }
      if (debouncedSearch) params.search = debouncedSearch
      if (roleFilter !== 'all') params.role = roleFilter
      if (statusFilter === 'active') params.status = 'active'
      if (statusFilter === 'inactive') params.status = 'inactive'

      const { data } = await api.get('/users', { params })
      setRows(data.data || [])
      setMeta({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total || 0,
        from: data.from || 0,
        to: data.to || 0,
      })
      if (data.summary) {
        setSummary({
          total: data.summary.total ?? 0,
          active: data.summary.active ?? 0,
          inactive: data.summary.inactive ?? 0,
          students: data.summary.students ?? 0,
        })
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to load users.'))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, debouncedSearch, roleFilter, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  function closeAddUserModal() {
    setModalOpen(false)
  }

  async function onUserCreated() {
    setModalOpen(false)
    if (page === 1) {
      await load({ page: 1 })
    } else {
      setPage(1)
    }
  }

  async function onCardAvatarChange(user, e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Photo must be a JPG, PNG, or WEBP image.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error('Photo must be 2MB or smaller.')
      return
    }

    setCardAvatarBusyId(user.id)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const { data } = await api.post(`/users/${user.id}/avatar`, fd)
      setRows((prev) => prev.map((r) => (r.id === user.id ? { ...r, avatar_url: data.avatar_url } : r)))
      toast.success('Profile photo updated.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update profile photo.'))
    } finally {
      setCardAvatarBusyId(null)
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

  function viewUser(user) {
    if (user.role === 'student') {
      const studentId = user.student_profile?.id
      if (!studentId) {
        toast.error('This student has no profile record yet.')
        return
      }
      setViewStudentId(studentId)
      return
    }
    setViewUserId(user.id)
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
    <div className="wp-flat wp-users">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">User Management</h1>
          <p className="wp-flat__sub">
            Manage staff accounts and portal access. Student accounts are created by the Registrar.
          </p>
        </div>
        <div className="wp-flat__top-actions">
          <button type="button" className="wp-flat__btn wp-flat__btn--secondary" onClick={load} disabled={loading}>
            <FiRefreshCw className={loading ? 'is-spin' : ''} size={15} />
            Refresh
          </button>
          <button type="button" className="wp-flat__btn wp-flat__btn--primary" onClick={() => setModalOpen(true)}>
            <FiPlus size={16} />
            Add User
          </button>
        </div>
      </div>

      <div className="wp-flat__stats" aria-label="User counts">
        <div className={`wp-flat__stat${!loading ? '' : ' is-loading'}`}>
          <span className="wp-flat__stat-label">Total users</span>
          {loading ? <span className="wp-flat__stat-skeleton" aria-hidden /> : <span className="wp-flat__stat-value">{summary.total}</span>}
        </div>
        <div className={`wp-flat__stat wp-flat__stat--teal${!loading ? '' : ' is-loading'}`}>
          <span className="wp-flat__stat-label">Active</span>
          {loading ? <span className="wp-flat__stat-skeleton" aria-hidden /> : <span className="wp-flat__stat-value">{summary.active}</span>}
        </div>
        <div className={`wp-flat__stat wp-flat__stat--blue${!loading ? '' : ' is-loading'}`}>
          <span className="wp-flat__stat-label">Inactive</span>
          {loading ? <span className="wp-flat__stat-skeleton" aria-hidden /> : <span className="wp-flat__stat-value">{summary.inactive}</span>}
        </div>
        <div className={`wp-flat__stat wp-flat__stat--blue${!loading ? '' : ' is-loading'}`}>
          <span className="wp-flat__stat-label">Learners</span>
          {loading ? <span className="wp-flat__stat-skeleton" aria-hidden /> : <span className="wp-flat__stat-value">{summary.students}</span>}
        </div>
      </div>

      <div className="wp-flat__toolbar">
        <select
          className="form-select wp-flat__control"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          {ALL_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          className="form-select wp-flat__control"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <input
          type="search"
          className="form-control wp-flat__search"
          placeholder="Search name or email / username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />
        <label className="wp-flat__records">
          Show
          <select
            className="form-select wp-flat__control"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value))
              setPage(1)
            }}
            aria-label="Rows per page"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <div className="wp-flat__panel wp-users__panel">
        {loading ? (
          <div className="wp-users__grid">
            {Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
              <div key={i} className="wp-users__card wp-users__card--skeleton" aria-hidden>
                <div className="wp-users__card-avatar wp-users__skeleton-avatar" />
                <div className="wp-users__skeleton-bar wp-users__skeleton-bar--wide" />
                <div className="wp-users__skeleton-bar wp-users__skeleton-bar--pill" />
                <div className="wp-users__skeleton-bar" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="wp-flat__empty">No users match your filters.</div>
        ) : (
          <div className="wp-users__grid">
            {rows.map((u) => {
              const busy = cardAvatarBusyId === u.id
              const subId = u.staff_profile?.employee_no
                ? `Emp: ${u.staff_profile.employee_no}`
                : u.student_profile?.student_no
                  ? `Student: ${u.student_profile.student_no}`
                  : null

              return (
                <article key={u.id} className={`wp-users__card wp-users__card--${u.role}`}>
                  <label
                    className="wp-users__card-avatar-wrap"
                    title="Click to change photo"
                    aria-label={`Change photo for ${u.name}`}
                  >
                    <div className="wp-users__card-avatar">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" />
                      ) : (
                        <span>{initialsOf(u.name)}</span>
                      )}
                      {busy ? <span className="wp-users__card-avatar-busy" aria-hidden /> : null}
                    </div>
                    <input
                      type="file"
                      accept={AVATAR_ACCEPT}
                      hidden
                      disabled={busy}
                      onChange={(e) => onCardAvatarChange(u, e)}
                    />
                  </label>

                  <h3 className="wp-users__card-name" title={u.name}>{u.name}</h3>
                  <span className="wp-users__role-pill">{roleLabel(u.role)}</span>
                  <p className="wp-users__card-email" title={u.email}>{u.email}</p>
                  {subId ? <p className="wp-users__card-meta">{subId}</p> : null}
                  <span className={`wp-users__status-pill${u.is_active ? ' is-active' : ' is-inactive'}`}>
                    <span className="wp-users__status-dot" aria-hidden />
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>

                  <div className="wp-users__card-actions">
                    <button
                      type="button"
                      className="wp-flat__btn wp-flat__btn--success wp-flat__btn--sm"
                      onClick={() => viewUser(u)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className={`wp-flat__btn wp-flat__btn--sm ${u.is_active ? 'wp-flat__btn--danger' : 'wp-flat__btn--success'}`}
                      onClick={() => toggleActive(u)}
                      disabled={currentUser?.id === u.id}
                      title={currentUser?.id === u.id ? 'Cannot change your own status' : undefined}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="wp-flat__btn wp-flat__btn--edit wp-flat__btn--sm"
                      onClick={() => resetPassword(u)}
                    >
                      Reset password
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="wp-flat__footer">
          <span className="wp-flat__footer-meta">
            {meta.total > 0
              ? `Showing ${meta.from}–${meta.to} of ${meta.total} user${meta.total === 1 ? '' : 's'}`
              : '0 users'}
            {meta.last_page > 1 ? ` · Page ${meta.current_page} of ${meta.last_page}` : ''}
          </span>
          <FlatPager meta={meta} disabled={loading} onPageChange={setPage} />
        </div>
      </div>

      {modalOpen ? (
        <AddUserModal onClose={closeAddUserModal} onSaved={onUserCreated} />
      ) : null}

      {viewStudentId ? (
        <StudentRecordModal
          studentId={viewStudentId}
          onClose={() => setViewStudentId(null)}
        />
      ) : null}

      {viewUserId ? (
        <StaffUserViewModal
          userId={viewUserId}
          onClose={() => setViewUserId(null)}
        />
      ) : null}
    </div>
  )
}
