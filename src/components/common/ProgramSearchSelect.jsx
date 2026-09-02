import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi'
import './ProgramSearchSelect.css'

function levelValue(level) {
  if (level && typeof level === 'object' && level.value) return String(level.value)
  return String(level || '')
}

function levelLabel(level) {
  const v = levelValue(level)
  if (v === 'college') return 'College'
  if (v === 'shs') return 'Senior High'
  return v || '—'
}

function programLabel(program) {
  if (!program) return ''
  return `${program.code} — ${program.name}`
}

export default function ProgramSearchSelect({
  programs = [],
  value = '',
  onChange,
  disabled = false,
  loading = false,
  id: idProp,
  label = 'Program',
}) {
  const autoId = useId()
  const inputId = idProp || autoId
  const listboxId = `${inputId}-listbox`
  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [highlight, setHighlight] = useState(0)

  const selected = useMemo(
    () => programs.find((p) => String(p.id) === String(value)) || null,
    [programs, value],
  )

  const filtered = useMemo(() => {
    let list = programs
    if (levelFilter !== 'all') {
      list = list.filter((p) => levelValue(p.academic_level) === levelFilter)
    }
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((p) => {
      const code = String(p.code || '').toLowerCase()
      const name = String(p.name || '').toLowerCase()
      return code.includes(q) || name.includes(q)
    })
  }, [programs, search, levelFilter])

  useEffect(() => {
    if (!open) return undefined
    const t = window.setTimeout(() => searchRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [search, levelFilter, open])

  useEffect(() => {
    if (!open) return undefined
    function onDocMouseDown(e) {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false)
        setSearch('')
        setLevelFilter('all')
      }
    }
    function onDocKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        setSearch('')
        setLevelFilter('all')
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onDocKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onDocKeyDown)
    }
  }, [open])

  function selectProgram(program) {
    if (!program || disabled) return
    onChange?.(String(program.id))
    setOpen(false)
    setSearch('')
    setLevelFilter('all')
  }

  function toggleOpen() {
    if (disabled || loading) return
    setOpen((prev) => {
      if (prev) {
        setSearch('')
        setLevelFilter('all')
      }
      return !prev
    })
  }

  function onTriggerKeyDown(e) {
    if (disabled || loading) return
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
    }
  }

  function onSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const pick = filtered[highlight]
      if (pick) selectProgram(pick)
    }
    if (e.key === 'Tab') {
      setOpen(false)
      setSearch('')
      setLevelFilter('all')
    }
  }

  const busy = disabled || loading
  const triggerText = selected ? programLabel(selected) : (programs.length ? 'Select program' : 'No programs available')

  return (
    <div
      ref={rootRef}
      className={`wp-prog-select${open ? ' is-open' : ''}${busy ? ' is-disabled' : ''}`}
    >
      <label className="wp-prog-select__label" htmlFor={inputId}>
        {label}
      </label>

      <button
        id={inputId}
        type="button"
        className="wp-prog-select__trigger"
        onClick={toggleOpen}
        onKeyDown={onTriggerKeyDown}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
      >
        <span className={`wp-prog-select__value${selected ? '' : ' is-placeholder'}`}>
          {loading ? 'Loading programs…' : triggerText}
        </span>
        <FiChevronDown className="wp-prog-select__chev" size={16} aria-hidden />
      </button>

      {open ? (
        <div className="wp-prog-select__panel">
          <div className="wp-prog-select__search-wrap">
            <FiSearch className="wp-prog-select__search-icon" size={15} aria-hidden />
            <input
              ref={searchRef}
              type="search"
              className="wp-prog-select__search"
              placeholder="Search by code or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              aria-label="Search programs"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                className="wp-prog-select__clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <FiX size={14} />
              </button>
            ) : null}
          </div>

          <div className="wp-prog-select__filters" role="tablist" aria-label="Filter by level">
            {[
              ['all', 'All'],
              ['college', 'College'],
              ['shs', 'Senior High'],
            ].map(([key, text]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={levelFilter === key}
                className={`wp-prog-select__filter${levelFilter === key ? ' is-active' : ''}`}
                onClick={() => setLevelFilter(key)}
              >
                {text}
              </button>
            ))}
          </div>

          <p className="wp-prog-select__count">
            {filtered.length} program{filtered.length === 1 ? '' : 's'}
          </p>

          <ul
            id={listboxId}
            className="wp-prog-select__list"
            role="listbox"
            aria-label="Programs"
          >
            {filtered.length === 0 ? (
              <li className="wp-prog-select__empty">No programs match your search.</li>
            ) : (
              filtered.map((program, idx) => {
                const active = String(program.id) === String(value)
                const hot = idx === highlight
                return (
                  <li key={program.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`wp-prog-select__option${active ? ' is-selected' : ''}${hot ? ' is-highlight' : ''}`}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => selectProgram(program)}
                    >
                      <span className="wp-prog-select__option-label">{programLabel(program)}</span>
                      <span className="wp-prog-select__option-meta">{levelLabel(program.academic_level)}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
