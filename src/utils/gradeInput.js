/**
 * Shared helpers for West Prime grading scales:
 * - College: 1.00–5.00
 * - Senior High: 0–100
 * - "NG" (No Grade) is accepted for any period; it makes the final grade NG (FAILED).
 */

export const NO_GRADE = 'NG'

export function normalizeAcademicLevel(levelRaw) {
  if (levelRaw && typeof levelRaw === 'object') {
    return String(levelRaw.value || '').toLowerCase()
  }
  return String(levelRaw || '').toLowerCase()
}

export function isNoGrade(value) {
  return String(value ?? '').trim().toUpperCase() === NO_GRADE
}

/**
 * Keep digits and at most one decimal point (max 2 decimals), or "NG" (No Grade).
 * Typing "n" yields "N" until "NG" is complete.
 */
export function sanitizeGradeInput(raw) {
  const upper = String(raw ?? '').trim().toUpperCase()
  if (upper.startsWith('NG')) return NO_GRADE
  if (upper.startsWith('N')) return 'N'

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
  if (isNoGrade(value)) return true
  const n = Number(value)
  if (!Number.isFinite(n)) return false
  if (normalizeAcademicLevel(level) === 'shs') {
    return n >= 0 && n <= 100
  }
  return n >= 1 && n <= 5
}

export function gradeValidationMessage(level) {
  return `Enter a number (${gradeRangeHint(level)}) or NG for No Grade. Other letters are not allowed.`
}

/** Display a period/final grade: "NG" when flagged, "—" when empty, else fixed decimals. */
export function formatGradeCell(value, isNg = false, digits = 2) {
  if (isNg) return NO_GRADE
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(digits) : '—'
}
