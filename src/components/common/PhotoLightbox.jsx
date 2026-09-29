import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import './PhotoLightbox.css'

const ANIM_MS = 200

/**
 * Lightweight full-photo viewer. Normal dialog size — not fullscreen.
 * Pass src=null / falsy to close (parent controls open state).
 */
export default function PhotoLightbox({ src, title, onClose }) {
  const titleId = useId()
  const [anim, setAnim] = useState('enter')

  useBodyScrollLock(Boolean(src))

  useEffect(() => {
    if (!src) return undefined
    setAnim('enter')
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnim('open'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [src])

  useEffect(() => {
    if (!src || anim !== 'leave') return undefined
    const timer = window.setTimeout(() => onClose?.(), ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [anim, onClose, src])

  useEffect(() => {
    if (!src) return undefined
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setAnim('leave')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [src])

  if (!src) return null

  const animClass = anim === 'open' ? ' is-open' : anim === 'leave' ? ' is-leave' : ''

  return createPortal(
    <div
      className={`wp-photo-lb${animClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setAnim('leave')
      }}
    >
      <div
        className="wp-photo-lb__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="wp-photo-lb__header">
          <h2 id={titleId} className="wp-photo-lb__title">
            {title || 'Photo'}
          </h2>
          <button
            type="button"
            className="wp-photo-lb__close"
            onClick={() => setAnim('leave')}
            aria-label="Close"
          >
            <FiX size={18} />
          </button>
        </header>
        <div className="wp-photo-lb__body">
          <img src={src} alt={title || 'Profile photo'} className="wp-photo-lb__img" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
