import logo from '../../assets/west_prime_logo.png'
import './WestPrimeLoader.css'

/**
 * Flat branded loading indicator for West Prime Portal.
 * @param {'fullscreen'|'page'|'inline'|'overlay'} variant
 */
export default function WestPrimeLoader({
  variant = 'page',
  message = 'Loading…',
  label = 'Loading',
}) {
  const isFullscreen = variant === 'fullscreen'
  const isInline = variant === 'inline'

  const rootClass = [
    'wp-loader',
    `wp-loader--${variant}`,
    isFullscreen || variant === 'overlay' ? 'wp-loader--brand' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="wp-loader__inner">
        {isInline ? (
          <>
            <span className="wp-loader__spinner wp-loader__spinner--sm" aria-hidden="true" />
            <span className="wp-loader__text">{message}</span>
          </>
        ) : (
          <div className="wp-loader__mark" aria-hidden="true">
            <span className="wp-loader__ring" />
            <span className="wp-loader__logo-disc">
              <img src={logo} alt="" className="wp-loader__logo" draggable={false} />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
