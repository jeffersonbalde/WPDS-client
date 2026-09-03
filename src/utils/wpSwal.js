import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

const BASE_CLASS = {
  popup: 'wp-swal',
  icon: 'wp-swal__icon',
  title: 'wp-swal__title',
  htmlContainer: 'wp-swal__text',
  actions: 'wp-swal__actions',
}

/**
 * Shared flat confirm dialogs (Inter, square corners, solid brand buttons).
 */
export async function wpConfirm({
  icon = 'warning',
  title = 'Confirm',
  text = '',
  html,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  focusCancel = true,
  wide = false,
} = {}) {
  const result = await Swal.fire({
    icon,
    title,
    text: html ? undefined : text,
    html: html || undefined,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel,
    width: wide ? 520 : 420,
    padding: '1.5rem 1.5rem 1.25rem',
    buttonsStyling: false,
    customClass: {
      ...BASE_CLASS,
      popup: wide ? 'wp-swal wp-swal--wide' : 'wp-swal',
      confirmButton: `wp-swal__btn ${danger ? 'wp-swal__btn--danger' : 'wp-swal__btn--primary'}`,
      cancelButton: 'wp-swal__btn wp-swal__btn--secondary',
    },
  })
  return result.isConfirmed
}

export async function wpConfirmDiscard(message) {
  const result = await Swal.fire({
    icon: 'warning',
    title: 'Unsaved changes',
    text: message || 'You have unsaved changes. If you leave now, your progress will be lost.',
    showCancelButton: true,
    confirmButtonText: 'Leave without saving',
    cancelButtonText: 'Keep editing',
    reverseButtons: true,
    focusCancel: true,
    width: 420,
    padding: '1.5rem 1.5rem 1.25rem',
    buttonsStyling: false,
    customClass: {
      ...BASE_CLASS,
      confirmButton: 'wp-swal__btn wp-swal__btn--danger',
      cancelButton: 'wp-swal__btn wp-swal__btn--primary',
    },
  })
  return result.isConfirmed
}

export async function wpSuccess({
  title = 'Success',
  text = '',
  html,
  confirmText = 'OK',
  cancelText,
  showCancel = false,
} = {}) {
  const result = await Swal.fire({
    icon: 'success',
    title,
    text: html ? undefined : text,
    html: html || undefined,
    showCancelButton: showCancel,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText || 'Cancel',
    reverseButtons: showCancel,
    focusConfirm: true,
    width: 420,
    padding: '1.5rem 1.5rem 1.25rem',
    buttonsStyling: false,
    customClass: {
      ...BASE_CLASS,
      confirmButton: 'wp-swal__btn wp-swal__btn--primary',
      cancelButton: 'wp-swal__btn wp-swal__btn--secondary',
    },
  })
  return result
}

export function wpLoading({ title = 'Please wait…', text = '' } = {}) {
  const safeText = text ? String(text).replace(/</g, '&lt;') : ''
  const hint = safeText ? `<p class="wp-swal-loader__hint">${safeText}</p>` : ''

  Swal.fire({
    title,
    html: `${hint}<span class="wp-swal-loader__spinner" aria-hidden="true"></span>`,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    width: 380,
    padding: '1.5rem 1.5rem 1.25rem',
    customClass: {
      popup: 'wp-swal wp-swal--loading',
      title: 'wp-swal__title',
      htmlContainer: 'wp-swal__text wp-swal__text--loader',
    },
  })
}

export function wpClose() {
  Swal.close()
}

/**
 * Show a loading dialog while work runs, then close it before resolving.
 * Use before usage checks / email checks so clicks never feel dead.
 */
export async function wpWithLoading(work, {
  title = 'Please wait…',
  text = 'Checking records…',
} = {}) {
  wpLoading({ title, text })
  try {
    return await work()
  } finally {
    wpClose()
  }
}

export async function wpAlert({
  icon = 'info',
  title = 'Notice',
  text = '',
  html,
  confirmText = 'OK',
  wide = false,
} = {}) {
  await Swal.fire({
    icon,
    title,
    text: html ? undefined : text,
    html: html || undefined,
    confirmButtonText: confirmText,
    width: wide ? 520 : 420,
    padding: '1.5rem 1.5rem 1.25rem',
    buttonsStyling: false,
    customClass: {
      ...BASE_CLASS,
      popup: wide ? 'wp-swal wp-swal--wide' : 'wp-swal',
      confirmButton: 'wp-swal__btn wp-swal__btn--primary',
    },
  })
}
