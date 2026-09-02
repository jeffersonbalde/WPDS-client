/**
 * Extract a short, user-facing error message from an Axios/API error.
 * Never surfaces SQL, stack traces, or file paths.
 */
export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const status = err?.response?.status
  const data = err?.response?.data

  if (data instanceof Blob) {
    return fallback
  }

  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0]
    const msg = Array.isArray(first) ? first[0] : first
    if (msg && typeof msg === 'string' && isFriendlyMessage(msg)) {
      return msg
    }
  }

  const raw = data?.message
  if (typeof raw === 'string' && isFriendlyMessage(raw)) {
    return raw
  }

  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return 'The requested record was not found.'
  if (status === 422) return 'Please check the highlighted fields and try again.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'A server error occurred. Please try again later.'
  if (!err?.response) return 'Unable to connect to the server. Check your connection and try again.'

  return fallback
}

function isFriendlyMessage(message) {
  const msg = message.trim()
  if (!msg || msg.length > 220) return false

  const technical = [
    /sqlstate/i,
    /\bSQL:/i,
    /sqlite/i,
    /connection:/i,
    /insert into/i,
    /update\s+"/i,
    /select\s+/i,
    /stack trace/i,
    /vendor[\\/]/i,
    /\\\\Users\\\\/i,
    /C:\\Users\\/i,
    /Illuminate\\/i,
    /QueryException/i,
    /PDOException/i,
    /at\s+\/.*\.php/i,
  ]

  return !technical.some((re) => re.test(msg))
}

export default apiErrorMessage
