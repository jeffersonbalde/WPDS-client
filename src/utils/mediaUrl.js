/**
 * Turn an API media URL into one the browser can load.
 * Prefer the API origin from VITE_API_URL when the path is /storage/...
 * so mis-set APP_URL on deploy still serves avatars.
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return null

  try {
    const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
    const apiOrigin = new URL(apiBase, window.location.origin).origin
    const parsed = new URL(url, apiOrigin)

    if (parsed.pathname.startsWith('/storage/')) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}`
    }

    return parsed.href
  } catch {
    return url
  }
}
