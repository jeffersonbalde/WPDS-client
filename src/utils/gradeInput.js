/**
 * Shared helpers for West Prime grading scales:
 * - College: 1.00–5.00
 * - Senior High: 0–100
 */

export function normalizeAcademicLevel(levelRaw) {
  if (levelRaw && typeof levelRaw === 'object') {
    return String(levelRaw.value || '').toLowerCase()
  }
  return String(levelRaw || '').toLowerCase()
}

/** Strip letters/symbols; keep digits and at most one decimal point (max 2 decimals). */
export function sanitizeGradeInput(raw) {
  let s = String(raw ?? '').replace(/[^0-9.]/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  const parts = s.split('.')
  if (parts.length === 2 && parts[1].length > 2) {
    s = `${parts[0]}.${parts[1].slice(0, 2)}`
  }
  return s
}

export function gradeRangeHint(level) {
  return normalizeAcademicLevel(level) === 'shs' ? '0–100' : '1.00–5.00'
}

export function isValidPeriodGrade(value, level) {
  if (value === '' || value === null || value === undefined) return true
  const n = Number(value)
  if (!Number.isFinite(n)) return false
  if (normalizeAcademicLevel(level) === 'shs') {
    return n >= 0 && n <= 100
  }
  return n >= 1 && n <= 5
}

export function gradeValidationMessage(level) {
  return `Enter a number only (${gradeRangeHint(level)}). Letters are not allowed.`
}
