import { FiX } from 'react-icons/fi'
import './PeriodDateFilter.css'

export const PERIOD_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
]

export const DEFAULT_PERIOD_FILTER = {
  period: 'all',
  date_from: '',
  date_to: '',
}

/** Build query params for GET /dashboard (and similar). */
export function periodFilterParams(filter) {
  const period = filter?.period || 'all'
  const params = { period }
  if (period === 'custom') {
    if (filter.date_from) params.date_from = filter.date_from
    if (filter.date_to) params.date_to = filter.date_to
  }
  return params
}

function formatRangeLabel(filter, serverFilter) {
  if (serverFilter?.label) return serverFilter.label
  const opt = PERIOD_OPTIONS.find((o) => o.value === filter.period)
  if (filter.period === 'custom') {
    if (filter.date_from && filter.date_to) return `${filter.date_from} → ${filter.date_to}`
    if (filter.date_from) return `From ${filter.date_from}`
    if (filter.date_to) return `Until ${filter.date_to}`
    return 'Custom range'
  }
  return opt?.label || 'All time'
}

/**
 * Period + optional custom date range for dashboard overview analytics.
 */
export default function PeriodDateFilter({
  value,
  onChange,
  disabled = false,
  serverFilter = null,
  idPrefix = 'period',
}) {
  const filter = value || DEFAULT_PERIOD_FILTER
  const isCustom = filter.period === 'custom'
  const active = filter.period !== 'all' || Boolean(filter.date_from || filter.date_to)

  function setPeriod(period) {
    onChange?.({
      period,
      date_from: period === 'custom' ? filter.date_from : '',
      date_to: period === 'custom' ? filter.date_to : '',
    })
  }

  function setDate(key, next) {
    onChange?.({ ...filter, period: 'custom', [key]: next })
  }

  function clear() {
    onChange?.({ ...DEFAULT_PERIOD_FILTER })
  }

  return (
    <div className="wp-period-filter" role="search" aria-label="Overview date filter">
      <label className="wp-period-filter__field">
        <span>Period</span>
        <select
          id={`${idPrefix}-period`}
          className="form-select"
          value={filter.period}
          disabled={disabled}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Filter overview by period"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {isCustom ? (
        <>
          <label className="wp-period-filter__field">
            <span>From</span>
            <input
              id={`${idPrefix}-from`}
              type="date"
              className="form-control"
              value={filter.date_from || ''}
              disabled={disabled}
              max={filter.date_to || undefined}
              onChange={(e) => setDate('date_from', e.target.value)}
              aria-label="From date"
            />
          </label>
          <label className="wp-period-filter__field">
            <span>To</span>
            <input
              id={`${idPrefix}-to`}
              type="date"
              className="form-control"
              value={filter.date_to || ''}
              disabled={disabled}
              min={filter.date_from || undefined}
              onChange={(e) => setDate('date_to', e.target.value)}
              aria-label="To date"
            />
          </label>
        </>
      ) : null}

      <p className="wp-period-filter__hint" aria-live="polite">
        Showing: <strong>{formatRangeLabel(filter, serverFilter)}</strong>
      </p>

      {active ? (
        <button
          type="button"
          className="wp-period-filter__clear"
          onClick={clear}
          disabled={disabled}
          title="Reset to all time"
        >
          <FiX size={15} aria-hidden />
          <span>Clear filter</span>
        </button>
      ) : null}
    </div>
  )
}
