import { useEffect } from 'react'

/**
 * Reference-counted body scroll lock.
 * Nested modals / lightboxes can lock safely without leaving the page stuck
 * (or briefly unlockable) when one of them closes.
 */
let lockCount = 0
let savedOverflow = ''

export function lockBodyScroll() {
  if (typeof document === 'undefined') {
    return () => {}
  }

  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1

  let released = false
  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0 && typeof document !== 'undefined') {
      document.body.style.overflow = savedOverflow
      savedOverflow = ''
    }
  }
}

/** Force-clear any leftover locks (e.g. after HMR or a stuck modal). */
export function resetBodyScrollLock() {
  lockCount = 0
  savedOverflow = ''
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
}

/** @param {boolean} [active=true] */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined
    return lockBodyScroll()
  }, [active])
}
