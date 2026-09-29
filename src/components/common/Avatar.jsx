import { useEffect, useState } from 'react'
import { initialsOf } from '../../utils/avatar.js'
import { resolveMediaUrl } from '../../utils/mediaUrl.js'
import './Avatar.css'

/** Renders a user photo, falling back to centered initials if missing or unloadable. */
export default function Avatar({ src, name, className = '' }) {
  const [failed, setFailed] = useState(false)
  const resolved = resolveMediaUrl(src)

  useEffect(() => {
    setFailed(false)
  }, [resolved])

  const classes = ['wp-avatar', className].filter(Boolean).join(' ')

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt=""
        className={`${classes} wp-avatar--photo`}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span className={`${classes} wp-avatar--fallback`} aria-hidden="true">
      <span className="wp-avatar__initials">{initialsOf(name)}</span>
    </span>
  )
}
