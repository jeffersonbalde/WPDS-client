import { useEffect, useState } from 'react'
import { FiUser } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api from '../api/client'
import WestPrimeLoader from '../components/common/WestPrimeLoader'
import StudentProfilePanels from '../components/student-profile/StudentProfilePanels'
import { apiErrorMessage } from '../utils/apiError'
import {
  normalizeEducationalBackground,
  normalizeParentsGuardian,
} from '../utils/studentProfile'
import './ProfilePage.css'

const TABS = [
  { key: 'info', label: 'Student Information' },
  { key: 'edu', label: 'Educational Background' },
  { key: 'parents', label: 'Parents/Guardian' },
]

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')

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

  if (loading) {
    return <WestPrimeLoader variant="page" message="Loading…" label="Loading" />
  }

  if (!profile) {
    return <div className="wp-profile__error">No student profile found.</div>
  }

  const activeLabel = TABS.find((t) => t.key === tab)?.label || 'Profile'

  return (
    <div className="wp-profile">
      <div className="wp-profile__header">
        <div>
          <h1 className="wp-profile__title">My Profile</h1>
          <p className="wp-profile__sub">
            View your student records. Profile details can only be updated by the Registrar.
          </p>
          <div className="wp-profile__badge-row">
            <span className="wp-profile__chip">{profile.student_no}</span>
            <span className="wp-profile__chip is-muted">
              {String(profile.academic_level || '').toUpperCase()}
            </span>
            {profile.program?.code ? (
              <span className="wp-profile__chip is-muted">{profile.program.code}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="wp-profile__layout">
        <nav className="wp-profile__tabs" aria-label="Profile sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`wp-profile__tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="wp-profile__panel">
          <h2 className="wp-profile__panel-title">
            <FiUser style={{ marginRight: 8, verticalAlign: -2 }} />
            {activeLabel}
          </h2>
          <p className="wp-profile__note">
            This section is read-only. Contact the Registrar Office if any information needs to be corrected.
          </p>
          <StudentProfilePanels profile={profile} tab={tab} readOnly />
        </section>
      </div>
    </div>
  )
}
