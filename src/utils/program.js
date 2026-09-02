export function programLevel(level) {
  if (level && typeof level === 'object' && level.value) return String(level.value)
  return String(level || '')
}

export function normalizeProgramName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ')
}

export function isSameProgramCode(a, b) {
  return String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase()
}

export function isSameProgramName(a, b) {
  return normalizeProgramName(a).toLowerCase() === normalizeProgramName(b).toLowerCase()
}

export function majorLabel(major) {
  if (!major) return '—'
  if (major.label) return String(major.label)
  const code = String(major.code || '').trim()
  const name = String(major.name || '').trim()
  if (code && name) return `${code} — ${name}`
  return name || code || '—'
}

export function majorsList(program) {
  return Array.isArray(program?.majors) ? program.majors : []
}

export function majorsFullText(program, empty = '—') {
  const labels = majorsList(program)
    .map((m) => {
      const text = majorLabel(m)
      return text === '—' ? '' : text
    })
    .filter(Boolean)
  return labels.length ? labels.join(', ') : empty
}

export function activeMajors(program) {
  return majorsList(program).filter((m) => m.is_active !== false)
}

export function majorsSummary(program, empty = 'None') {
  const majors = majorsList(program)
  if (!majors.length) return empty
  return majors.map((m) => {
    const text = majorLabel(m)
    return text === '—' ? '' : text
  }).filter(Boolean).join(' · ') || empty
}
