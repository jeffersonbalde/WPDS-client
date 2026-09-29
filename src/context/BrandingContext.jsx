import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import { applyDocumentBranding, DEFAULT_BRANDING, mergeBranding } from '../utils/branding'

const BrandingContext = createContext({
  branding: DEFAULT_BRANDING,
  loading: true,
  refreshBranding: async () => {},
  setBrandingFromPayload: () => {},
})

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(true)

  const setBrandingFromPayload = useCallback((payload) => {
    const next = mergeBranding(payload)
    setBranding(next)
    applyDocumentBranding(next)
  }, [])


  
  const refreshBranding = useCallback(async () => {
    try {
      const { data } = await api.get('/branding')
      setBrandingFromPayload(data)
    } catch {
      setBrandingFromPayload(DEFAULT_BRANDING)
    } finally {
      setLoading(false)
    }
  }, [setBrandingFromPayload])

  useEffect(() => {
    refreshBranding()
  }, [refreshBranding])

  const value = useMemo(
    () => ({
      branding,
      loading,
      refreshBranding,
      setBrandingFromPayload,
    }),
    [branding, loading, refreshBranding, setBrandingFromPayload],
  )

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding() {
  return useContext(BrandingContext)
}
