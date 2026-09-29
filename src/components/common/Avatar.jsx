import { useEffect, useState } from 'react'
import { initialsOf } from '../../utils/avatar.js'

/** Renders a user photo, falling back to initials if the URL is missing or fails to load. */
export default function Avatar({ src, name, className = '' }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (src && !failed) {
    return <img src={src} alt="" className={className} onError={() => setFailed(true)} />
  }

  return <span className={className}>{initialsOf(name)}</span>
}
