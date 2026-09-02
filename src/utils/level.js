export function levelValue(level) {
  if (level && typeof level === 'object' && level.value) return String(level.value)
  return String(level || '')
}

export function levelLabel(level) {
  const v = levelValue(level)
  if (v === 'college') return 'College'
  if (v === 'shs') return 'Senior High'
  return v || '—'
}

/** Human-readable year level from an admission (SHS: Grade 11/12; college: Year 1–4). */
export function admissionYearLabel(admission) {
  const raw = admission?.year_level
  if (raw == null || raw === '') return '—'

  const year = Number(raw)
  if (!Number.isFinite(year) || year < 1) return '—'

  const academicLevel = levelValue(
    admission?.program?.academic_level
    || admission?.student_profile?.academic_level,
  )

  if (academicLevel === 'shs') {
    return `Grade ${year + 10}`
  }

  return `Year ${year}`
}
