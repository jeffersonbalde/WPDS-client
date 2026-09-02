import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi'
import { pageItemsFor } from '../../utils/pagination'

export default function FlatPager({ meta, disabled, onPageChange }) {
  const pageItems = pageItemsFor(meta.last_page, meta.current_page)
  const atFirst = meta.current_page <= 1
  const atLast = meta.current_page >= meta.last_page

  if ((meta.last_page || 1) <= 1) return null

  return (
    <nav className="wp-flat__pager" aria-label="Pagination">
      <button
        type="button"
        className="wp-flat__pager-btn"
        disabled={atFirst || disabled}
        onClick={() => onPageChange(1)}
        aria-label="First page"
        title="First page"
      >
        <FiChevronsLeft size={16} />
        <span className="wp-flat__pager-label">First</span>
      </button>
      <button
        type="button"
        className="wp-flat__pager-btn"
        disabled={atFirst || disabled}
        onClick={() => onPageChange(Math.max(1, meta.current_page - 1))}
        aria-label="Previous page"
        title="Previous page"
      >
        <FiChevronLeft size={16} />
        <span className="wp-flat__pager-label">Prev</span>
      </button>

      <div className="wp-flat__pager-pages">
        {pageItems.map((item, idx) => {
          if (typeof item === 'string') {
            return (
              <span key={`${item}-${idx}`} className="wp-flat__pager-ellipsis" aria-hidden>
                …
              </span>
            )
          }
          const active = item === meta.current_page
          return (
            <button
              key={item}
              type="button"
              className={`wp-flat__pager-num${active ? ' is-active' : ''}`}
              onClick={() => onPageChange(item)}
              disabled={disabled}
              aria-label={`Page ${item}`}
              aria-current={active ? 'page' : undefined}
            >
              {item}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="wp-flat__pager-btn"
        disabled={atLast || disabled}
        onClick={() => onPageChange(Math.min(meta.last_page, meta.current_page + 1))}
        aria-label="Next page"
        title="Next page"
      >
        <span className="wp-flat__pager-label">Next</span>
        <FiChevronRight size={16} />
      </button>
      <button
        type="button"
        className="wp-flat__pager-btn"
        disabled={atLast || disabled}
        onClick={() => onPageChange(meta.last_page)}
        aria-label="Last page"
        title="Last page"
      >
        <span className="wp-flat__pager-label">Last</span>
        <FiChevronsRight size={16} />
      </button>
    </nav>
  )
}
