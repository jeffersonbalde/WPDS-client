import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { wpConfirmDiscard } from '../utils/wpSwal'

/**
 * Warn before leaving a form with unsaved changes (in-app navigation + tab close).
 */
export default function useUnsavedChangesGuard(dirty, allowLeave) {
  const skipBlockRef = useRef(false)

  useEffect(() => {
    if (allowLeave) skipBlockRef.current = true
  }, [allowLeave])

  useEffect(() => {
    if (!dirty) skipBlockRef.current = false
  }, [dirty])

  const markSaved = useCallback(() => {
    skipBlockRef.current = true
  }, [])

  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }) =>
      !skipBlockRef.current
      && dirty
      && !allowLeave
      && currentLocation.pathname !== nextLocation.pathname
      && nextLocation.pathname !== '/login',
    [dirty, allowLeave],
  )

  useEffect(() => {
    function onBeforeUnload(e) {
      if (skipBlockRef.current || !dirty || allowLeave) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, allowLeave])

  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined
    let cancelled = false
    async function ask() {
      const ok = await wpConfirmDiscard(
        'You have unsaved progress. Leave this page and lose what you entered?',
      )
      if (cancelled) return
      if (ok) blocker.proceed()
      else blocker.reset()
    }
    ask()
    return () => { cancelled = true }
  }, [blocker])

  const confirmLeave = useCallback(async () => {
    if (skipBlockRef.current || !dirty || allowLeave) return true
    return wpConfirmDiscard(
      'You have unsaved progress. Leave this page and lose what you entered?',
    )
  }, [dirty, allowLeave])

  return { confirmLeave, markSaved }
}
