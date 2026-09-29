import { useEffect, useState } from 'react'
import { FiUser } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import Avatar from '../components/common/Avatar'
import PhotoLightbox from '../components/common/PhotoLightbox'
import WestPrimeLoader from '../components/common/WestPrimeLoader'
import StudentProfilePanels from '../components/student-profile/StudentProfilePanels'
import { apiErrorMessage } from '../utils/apiError'
import {
  normalizeEducationalBackground,
  normalizeParentsGuardian,
} from '../utils/studentProfile'
import './ProfilePage.css'
import './StaffProfilePage.css'

const TABS = [
  { key: 'info', label: 'Student Information' },
  { key: 'edu', label: 'Educational Background' },
  { key: 'parents', label: 'Parents/Guardian' },
]

function fullName(profile) {
  if (!profile) return ''
  const middle = profile.middle_name ? ` ${profile.middle_name}` : ''
  return `${profile.last_name}, ${profile.first_name}${middle}`.trim()
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [photoOpen, setPhotoOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get('/my/profile')
        if (cancelled) return
        setProfile({
          ...data,
          educational_background: normalizeEducationalBackground(data.educational_background),
          parents_guardian: normalizeParentsGuardian(data.parents_guardian),
        })
      } catch (err) {
        if (!cancelled) toast.error(apiErrorMessage(err, 'Failed to load profile.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const activeLabel = TABS.find((t) => t.key === tab)?.label || 'Profile'
  const displayName = fullName(profile)
  const avatarUrl = profile?.avatar_url || profile?.user?.avatar_url || null
  const hasPhoto = Boolean(avatarUrl)

  return (
    <div className="wp-profile">
      <div className="wp-profile__header">
        <div>
          <h1 className="wp-profile__title">My Profile</h1>
          <p className="wp-profile__sub">
            View your student records. Profile details can only be updated by the Registrar.
          </p>
        </div>
      </div>

      {!loading && profile ? (
        <div className="wp-flat__panel wp-sprofile wp-sprofile--student">
          <header className="wp-sprofile__header">
            {hasPhoto ? (
              <button
                type="button"
                className="wp-sprofile__photo has-photo"
                onClick={() => setPhotoOpen(true)}
                title="View photo"
                aria-label={`View photo of ${displayName || 'you'}`}
              >
                <Avatar src={avatarUrl} name={displayName || 'Student'} />
                <span className="wp-sprofile__photo-hint" aria-hidden>View photo</span>
              </button>
            ) : (
              <div className="wp-sprofile__photo" aria-hidden>
                <Avatar src={null} name={displayName || 'Student'} />
              </div>
            )}
            <div className="wp-sprofile__identity">
              <p className="wp-sprofile__eyebrow">My profile</p>
              <h2 className="wp-sprofile__name">{displayName || '—'}</h2>
              <div className="wp-sprofile__pills">
                <span className="wp-sprofile__pill is-id">{profile.student_no}</span>
                <span className="wp-sprofile__pill">
                  {String(profile.academic_level || '').toUpperCase() || '—'}
                </span>
                {profile.program?.code ? (
                  <span className="wp-sprofile__pill is-id">{profile.program.code}</span>
                ) : null}
              </div>
            </div>
          </header>
        </div>
      ) : null}

      <div className="wp-profile__layout">
        <nav className="wp-profile__tabs" aria-label="Profile sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`wp-profile__tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => setTab(t.key)}
              disabled={loading}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="wp-profile__panel">
          <h2 className="wp-profile__panel-title">
            <FiUser aria-hidden />
            <span>{activeLabel}</span>
          </h2>
          <p className="wp-profile__note">
            This section is read-only. Contact the Registrar Office if any information needs to be corrected.
          </p>
          {loading ? (
            <div className="wp-profile__loading">
              <WestPrimeLoader variant="inline" message="Loading…" label="Loading" />
            </div>
          ) : !profile ? (
            <div className="wp-profile__error">No student profile found.</div>
          ) : (
            <StudentProfilePanels profile={profile} tab={tab} readOnly />
          )}
        </section>
      </div>

      <PhotoLightbox
        src={photoOpen && avatarUrl ? avatarUrl : null}
        title={displayName || 'Photo'}
        onClose={() => setPhotoOpen(false)}
      />
    </div>
  )
}
