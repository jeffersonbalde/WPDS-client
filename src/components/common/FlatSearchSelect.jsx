import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi'
import './FlatSearchSelect.css'

/**
 * Generic searchable combobox for flat SCC-style forms.
 */
export default function FlatSearchSelect({
  options = [],
  value = '',
  onChange,
  disabled = false,
  loading = false,
  id: idProp,
  label,
  required = false,
  placeholder = 'Select…',
  allowEmpty = false,
  emptyOptionLabel = 'None',
  searchPlaceholder = 'Search…',
  getValue = (item) => String(item.id),
  getLabel = (item) => String(item.name ?? item.label ?? ''),
  getMeta,
  filters,
  filterByFilter,
  filterBySearch,
  countLabel = 'result',
  invalid = false,
  compact = false,
  overlayPanel = false,
  overlayBackdrop = true,
  embedded = false,
  serverSearch = false,
  onSearchQueryChange,
  selectedOption = null,
  className = '',
}) {
  const autoId = useId()
  const inputId = idProp || autoId
  const listboxId = `${inputId}-listbox`
  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const wasOpenRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState(filters?.[0]?.key ?? 'all')
  const [highlight, setHighlight] = useState(0)

  const selected = useMemo(
    () => options.find((item) => String(getValue(item)) === String(value))
      || (selectedOption && String(getValue(selectedOption)) === String(value) ? selectedOption : null)
      || null,
    [options, value, getValue, selectedOption],
  )

  const filtered = useMemo(() => {
    let list = options
    if (filters?.length && filterByFilter && activeFilter !== 'all') {
      list = list.filter((item) => filterByFilter(item, activeFilter))
    }
    if (serverSearch) return list
    const q = search.trim().toLowerCase()
    if (!q) return list
    if (filterBySearch) return list.filter((item) => filterBySearch(item, q))
    return list.filter((item) => getLabel(item).toLowerCase().includes(q))
  }, [options, search, activeFilter, filters, filterByFilter, filterBySearch, getLabel, serverSearch])

  const listItems = useMemo(() => {
    const items = filtered.map((item) => ({ type: 'option', item }))
    if (allowEmpty && !search.trim()) {
      return [{ type: 'empty', item: null }, ...items]
    }
    return items
  }, [filtered, allowEmpty, search])

  const initialLoading = loading && options.length === 0 && !selected
  const panelLoading = loading
  const busy = disabled || initialLoading

  useEffect(() => {
    if (!open || !overlayPanel) return undefined
    const modalBody = rootRef.current?.closest('.wp-srm__body')
    if (modalBody) modalBody.classList.add('wp-combobox-open')
    return () => {
      modalBody?.classList.remove('wp-combobox-open')
    }
  }, [open, overlayPanel])

  useEffect(() => {
    if (!open) return undefined
    const t = window.setTimeout(() => searchRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [search, activeFilter, open])

  useEffect(() => {
    if (!serverSearch || !onSearchQueryChange) {
      wasOpenRef.current = open
      return undefined
    }

    if (!open) {
      wasOpenRef.current = false
      return undefined
    }

    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true
    const q = search.trim()

    // Keep cached options when reopening with an empty query.
    if (justOpened && !q && options.length > 0) {
      return undefined
    }

    const delay = q ? 300 : (justOpened ? 0 : 150)
    const timer = window.setTimeout(() => {
      onSearchQueryChange(q)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [search, open, serverSearch, onSearchQueryChange, options.length])

  useEffect(() => {
    if (!open) return undefined
    function onDocMouseDown(e) {
      if (e.target.closest('.wp-flat-search__backdrop')) return
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false)
        setSearch('')
        if (filters?.length) setActiveFilter(filters[0]?.key ?? 'all')
      }
    }
    function onDocKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        setSearch('')
        if (filters?.length) setActiveFilter(filters[0]?.key ?? 'all')
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onDocKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onDocKeyDown)
    }
  }, [open, filters])

  function closePanel() {
    setOpen(false)
    setSearch('')
    if (filters?.length) setActiveFilter(filters[0]?.key ?? 'all')
  }

  function pick(item, isEmpty = false) {
    if (disabled || initialLoading) return
    onChange?.(isEmpty ? '' : String(getValue(item)))
    closePanel()
  }

  function toggleOpen() {
    if (disabled || initialLoading) return
    if (open) {
      closePanel()
      return
    }
    setOpen(true)
  }

  function onTriggerKeyDown(e) {
    if (disabled || initialLoading) return
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
    }
  }

  function onSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((i) => Math.min(i + 1, Math.max(listItems.length - 1, 0)))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const row = listItems[highlight]
      if (!row || panelLoading) return
      if (row.type === 'empty') pick(null, true)
      else pick(row.item)
    }
    if (e.key === 'Tab') closePanel()
  }

  let triggerText = placeholder
  if (initialLoading) triggerText = 'Loading options…'
  else if (selected) triggerText = getLabel(selected)
  else if (allowEmpty && value === '') triggerText = emptyOptionLabel
  else if (!options.length && !panelLoading) triggerText = 'No options available'

  const rootClass = [
    'wp-flat-search',
    compact ? 'wp-flat-search--compact' : '',
    open ? 'is-open' : '',
    busy ? 'is-disabled' : '',
    initialLoading ? 'is-loading' : '',
    panelLoading && !initialLoading ? 'is-searching' : '',
    invalid ? 'is-invalid' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={rootRef} className={rootClass}>
      {label ? (
        <label className="wp-flat-search__label" htmlFor={inputId}>
          {label}
          {required ? <span className="wp-flat-search__req" aria-hidden="true"> *</span> : null}
        </label>
      ) : null}

      <button
        id={inputId}
        type="button"
        className="wp-flat-search__trigger"
        onClick={toggleOpen}
        onKeyDown={onTriggerKeyDown}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-invalid={invalid || undefined}
        aria-busy={panelLoading || undefined}
      >
        <span className={`wp-flat-search__value${selected || initialLoading || (allowEmpty && value === '') ? '' : ' is-placeholder'}`}>
          {initialLoading ? (
            <span className="wp-flat-search__loading-text">
              <span className="wp-flat-search__spinner" aria-hidden />
              {triggerText}
            </span>
          ) : (
            triggerText
          )}
        </span>
        <FiChevronDown className="wp-flat-search__chev" size={compact ? 14 : 16} aria-hidden />
      </button>

      {open && overlayPanel && overlayBackdrop ? (
        <div
          className="wp-flat-search__backdrop"
          role="presentation"
          onMouseDown={closePanel}
        />
      ) : null}

      {open ? (
        <div className={`wp-flat-search__panel${overlayPanel ? ' wp-flat-search__panel--overlay' : ''}${embedded ? ' wp-flat-search__panel--embedded' : ''}`}>
          <div className="wp-flat-search__search-wrap">
            <FiSearch className="wp-flat-search__search-icon" size={15} aria-hidden />
            <input
              ref={searchRef}
              type="text"
              role="searchbox"
              className="wp-flat-search__search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              aria-label={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
            {search ? (
              <button
                type="button"
                className="wp-flat-search__clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <FiX size={14} />
              </button>
            ) : null}
          </div>

          {filters?.length ? (
            <div className="wp-flat-search__filters" role="tablist" aria-label="Filters">
              {filters.map(({ key, label: filterLabel }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === key}
                  className={`wp-flat-search__filter${activeFilter === key ? ' is-active' : ''}`}
                  onClick={() => setActiveFilter(key)}
                >
                  {filterLabel}
                </button>
              ))}
            </div>
          ) : null}

          <p className="wp-flat-search__count">
            {panelLoading
              ? 'Loading…'
              : `${listItems.length} ${countLabel}${listItems.length === 1 ? '' : 's'}`}
          </p>

          <ul id={listboxId} className="wp-flat-search__list" role="listbox">
            {panelLoading && options.length === 0 ? (
              <li className="wp-flat-search__loading" aria-live="polite">
                <span className="wp-flat-search__spinner" aria-hidden />
                Loading options…
              </li>
            ) : listItems.length === 0 ? (
              <li className="wp-flat-search__empty">
                {panelLoading ? 'Searching…' : 'No matches found.'}
              </li>
            ) : (
              <>
                {panelLoading ? (
                  <li className="wp-flat-search__loading wp-flat-search__loading--inline" aria-live="polite">
                    <span className="wp-flat-search__spinner" aria-hidden />
                    Updating results…
                  </li>
                ) : null}
                {listItems.map((row, idx) => {
                  if (row.type === 'empty') {
                    const active = value === ''
                    const hot = idx === highlight
                    return (
                      <li key="__empty__" role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`wp-flat-search__option${active ? ' is-selected' : ''}${hot ? ' is-highlight' : ''}`}
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => pick(null, true)}
                        >
                          <span className="wp-flat-search__option-label">{emptyOptionLabel}</span>
                        </button>
                      </li>
                    )
                  }

                  const item = row.item
                  const active = String(getValue(item)) === String(value)
                  const hot = idx === highlight
                  const meta = getMeta?.(item)

                  return (
                    <li key={getValue(item)} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`wp-flat-search__option${active ? ' is-selected' : ''}${hot ? ' is-highlight' : ''}`}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => pick(item)}
                      >
                        <span className="wp-flat-search__option-label">{getLabel(item)}</span>
                        {meta ? <span className="wp-flat-search__option-meta">{meta}</span> : null}
                      </button>
                    </li>
                  )
                })}
              </>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
