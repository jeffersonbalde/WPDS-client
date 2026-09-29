import defaultLogo from '../assets/west_prime_logo.png'

export const DEFAULT_BRANDING = {
  system_name: 'West Prime Horizon Institute, Inc.',
  system_short_name: 'West Prime Portal',
  tagline: 'Digital Academic Portal',
  login_heading: 'Welcome back',
  login_subtitle: 'Enter your institutional credentials to continue.',
  footer_text: 'West Prime Horizon Institute, Inc.',
  logo_url: defaultLogo,
  favicon_url: '/brand/west-prime-favicon.png',
  login_bg_url: '/backgrounds/westprime-login-sign-correct.png',
  has_custom_logo: false,
  has_custom_favicon: false,
  has_custom_login_bg: false,
}

export function mergeBranding(payload = {}) {
  return {
    system_name: payload.system_name || DEFAULT_BRANDING.system_name,
    system_short_name: payload.system_short_name || DEFAULT_BRANDING.system_short_name,
    tagline: payload.tagline || DEFAULT_BRANDING.tagline,
    login_heading: payload.login_heading || DEFAULT_BRANDING.login_heading,
    login_subtitle: payload.login_subtitle || DEFAULT_BRANDING.login_subtitle,
    footer_text: payload.footer_text || DEFAULT_BRANDING.footer_text,
    logo_url: payload.logo_url || DEFAULT_BRANDING.logo_url,
    favicon_url: payload.favicon_url || DEFAULT_BRANDING.favicon_url,
    login_bg_url: payload.login_bg_url || DEFAULT_BRANDING.login_bg_url,
    has_custom_logo: Boolean(payload.has_custom_logo && payload.logo_url),
    has_custom_favicon: Boolean(payload.has_custom_favicon && payload.favicon_url),
    has_custom_login_bg: Boolean(payload.has_custom_login_bg && payload.login_bg_url),
  }
}

export function applyDocumentBranding(branding) {
  if (typeof document === 'undefined') return

  const title = branding?.system_short_name || DEFAULT_BRANDING.system_short_name
  if (title) document.title = title

  const href = branding?.favicon_url || DEFAULT_BRANDING.favicon_url
  const links = document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']")
  links.forEach((link) => {
    link.setAttribute('href', href)
  })
}
