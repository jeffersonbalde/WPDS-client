import { displayValue } from '../../utils/studentProfile'

export default function ProfileField({
  label,
  value,
  onChange,
  onBlur,
  readOnly = false,
  type = 'text',
  placeholder = '',
  as = 'input',
  options = null,
  error = null,
}) {
  const empty = !String(value ?? '').trim()
  const invalidClass = error ? ' is-invalid' : ''

  if (readOnly) {
    return (
      <div className="wp-profile__field">
        <div className="wp-profile__label">{label}</div>
        <div className={`wp-profile__value${empty ? ' is-empty' : ''}`}>{displayValue(value)}</div>
      </div>
    )
  }

  if (as === 'select' || options) {
    return (
      <label className="wp-profile__field">
        <span className="wp-profile__label">{label}</span>
        <select
          className={`form-select${invalidClass}`}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
        >
          <option value="">{placeholder || 'Select'}</option>
          {(options || []).map((opt) => (
            <option key={opt.value ?? opt} value={opt.value ?? opt}>
              {opt.label ?? opt}
            </option>
          ))}
        </select>
        {error ? <div className="invalid-feedback d-block">{error}</div> : null}
      </label>
    )
  }

  return (
    <label className="wp-profile__field">
      <span className="wp-profile__label">{label}</span>
      <input
        type={type}
        className={`form-control${invalidClass}`}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
      />
      {error ? <div className="invalid-feedback d-block">{error}</div> : null}
    </label>
  )
}
