import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { initialsOf } from '../utils/avatar'
import '../components/admissions/AdmissionViewModal.css'
import './StaffProfilePage.css'

function fmtDateTime(value) {
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

export default function StaffProfilePage() {
  const { user } = useAuth()
  const staff = user?.staff_profile

  const accountFields = useMemo(() => {
    if (!user) return []
    return [
      { label: 'Full name', value: user.name || '—', span: 2 },
      { label: 'Email / Username', value: user.email || '—' },
      { label: 'Role', value: user.role_label || user.role || '—' },
      { label: 'Status', value: user.is_active ? 'Active' : 'Inactive' },
      { label: 'Account created', value: fmtDateTime(user.created_at) },
      { label: 'Last updated', value: fmtDateTime(user.updated_at) },
    ]
  }, [user])

  const staffFields = useMemo(() => {
    if (!staff) {
      return [{ label: 'Staff profile', value: 'No staff profile on file.', span: 2 }]
    }
    return [
      { label: 'Employee number', value: staff.employee_no || '—' },
      { label: 'Position', value: staff.position || '—' },
      { label: 'Department', value: staff.department || '—', span: 2 },
      { label: 'Mobile', value: staff.mobile || '—' },
    ]
  }, [staff])

  if (!user) return null

  return (
    <div className="wp-flat">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">My Profile</h1>
          <p className="wp-flat__sub">
            View your account details. Contact IT if any information needs to be corrected.
          </p>
        </div>
      </div>

      <div className="wp-flat__panel">
        <div className="wp-sprofile__header">
          <div className="wp-sprofile__avatar">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" />
            ) : (
              <span>{initialsOf(user.name)}</span>
            )}
          </div>
          <div>
            <h2 className="wp-sprofile__name">{user.name}</h2>
            <div className="wp-sprofile__pills">
              <span className="wp-sprofile__pill">{user.role_label || user.role}</span>
              <span className={`wp-sprofile__pill${user.is_active ? ' wp-sprofile__pill--active' : ' wp-sprofile__pill--inactive'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="wp-sprofile__body">
          <section className="wp-adm-view-modal__panel" aria-label="Account details">
            <h3 className="wp-adm-view-modal__panel-title">Account details</h3>
            <div className="wp-adm-view-modal__fields">
              {accountFields.map((field) => (
                <div
                  key={field.label}
                  className={`wp-adm-view-modal__field${field.span === 2 ? ' wp-adm-view-modal__field--span-2' : ''}`}
                >
                  <span className="wp-adm-view-modal__field-label">{field.label}</span>
                  <div className="wp-adm-view-modal__readonly">{field.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="wp-adm-view-modal__panel" aria-label="Staff profile">
            <h3 className="wp-adm-view-modal__panel-title">Staff profile</h3>
            <div className="wp-adm-view-modal__fields">
              {staffFields.map((field) => (
                <div
                  key={field.label}
                  className={`wp-adm-view-modal__field${field.span === 2 ? ' wp-adm-view-modal__field--span-2' : ''}`}
                >
                  <span className="wp-adm-view-modal__field-label">{field.label}</span>
                  <div className="wp-adm-view-modal__readonly">{field.value}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
