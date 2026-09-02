/** Remove the static HTML splash once React has bootstrapped. */
export function dismissAppSplash() {
  const el = document.getElementById('wp-splash')
  if (!el || el.classList.contains('is-hidden')) return
  el.classList.add('is-hidden')
  window.setTimeout(() => el.remove(), 480)
}
