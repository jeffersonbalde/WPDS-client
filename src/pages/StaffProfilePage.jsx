import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/common/Avatar'
import PhotoLightbox from '../components/common/PhotoLightbox'
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
  const [photoOpen, setPhotoOpen] = useState(false)

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

  const hasPhoto = Boolean(user.avatar_url)

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

      <div className="wp-flat__panel wp-sprofile">
        <header className="wp-sprofile__header">
          {hasPhoto ? (
            <button
              type="button"
              className="wp-sprofile__photo has-photo"
              onClick={() => setPhotoOpen(true)}
              title="View photo"
              aria-label={`View photo of ${user.name || 'you'}`}
            >
              <Avatar src={user.avatar_url} name={user.name} />
              <span className="wp-sprofile__photo-hint" aria-hidden>View photo</span>
            </button>
          ) : (
            <div className="wp-sprofile__photo" aria-hidden>
              <Avatar src={null} name={user.name} />
            </div>
          )}

          <div className="wp-sprofile__identity">
            <p className="wp-sprofile__eyebrow">My profile</p>
            <h2 className="wp-sprofile__name">{user.name}</h2>
            <div className="wp-sprofile__pills">
              <span className="wp-sprofile__pill">{user.role_label || user.role}</span>
              <span className={`wp-sprofile__pill${user.is_active ? ' is-active' : ' is-inactive'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
              {staff?.employee_no ? (
                <span className="wp-sprofile__pill is-id">Emp: {staff.employee_no}</span>
              ) : null}
            </div>
            {user.email ? <p className="wp-sprofile__email">{user.email}</p> : null}
          </div>
        </header>

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

      <PhotoLightbox
        src={photoOpen && user.avatar_url ? user.avatar_url : null}
        title={user.name || 'Photo'}
        onClose={() => setPhotoOpen(false)}
      />
    </div>
  )
}
