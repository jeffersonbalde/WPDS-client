export const defaultEducationalBackground = () => ({
  primary_school: '',
  junior_high_school: '',
  senior_high_school: '',
  transferred_from: '',
})

export const defaultParentPerson = () => ({
  name: '',
  occupation: '',
  company: '',
  contact: '',
  email: '',
})

export const defaultParentsGuardian = () => ({
  father: defaultParentPerson(),
  mother: defaultParentPerson(),
  guardian: defaultParentPerson(),
})

export function normalizeEducationalBackground(value) {
  const defaults = defaultEducationalBackground()
  if (!value || typeof value !== 'object') return defaults
  return {
    primary_school: value.primary_school || '',
    junior_high_school: value.junior_high_school || '',
    senior_high_school: value.senior_high_school || '',
    transferred_from: value.transferred_from || '',
  }
}

export function normalizeParentsGuardian(value) {
  const defaults = defaultParentsGuardian()
  if (!value || typeof value !== 'object') return defaults
  const out = { ...defaults }
  ;['father', 'mother', 'guardian'].forEach((role) => {
    const row = value[role] && typeof value[role] === 'object' ? value[role] : {}
    out[role] = {
      name: row.name || '',
      occupation: row.occupation || '',
      company: row.company || '',
      contact: row.contact || '',
      email: row.email || '',
    }
  })
  return out
}

export function displayValue(value) {
  const v = String(value ?? '').trim()
  return v || '—'
}
