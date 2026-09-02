import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FiLogOut, FiMenu, FiChevronDown } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { getNavForRole, isChildActive, isGroupActive, isNavGroup } from './nav'
import { wpAlert, wpClose, wpConfirm, wpLoading } from '../utils/wpSwal'
import logo from '../assets/west_prime_logo.png'
import './dashboard.css'

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function groupKey(sectionHeading, item) {
  return `${sectionHeading}::${item.label}`
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const menuRef = useRef(null)
  const sections = getNavForRole(user?.role)

  useEffect(() => {
    localStorage.removeItem('wpds_dash_theme')
  }, [])

  useEffect(() => {
    if (!user) return
    const key = `wpds_welcome_${user.id ?? user.email}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    toast.success(`Welcome back, ${user.name || 'User'}!`, {
      position: 'top-right',
      autoClose: 3500,
    })
  }, [user])

  // Accordion: only the group matching the current route stays open
  useEffect(() => {
    const nav = getNavForRole(user?.role)
    const next = {}
    nav.forEach((section) => {
      section.items.forEach((item) => {
        if (!isNavGroup(item)) return
        const key = groupKey(section.heading, item)
        next[key] = isGroupActive(location.pathname, item)
      })
    })
    setOpenGroups(next)
  }, [location.pathname, user?.role])

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setCollapsed(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function handleLogout() {
    setMenuOpen(false)
    const ok = await wpConfirm({
      icon: 'question',
      title: 'Sign out?',
      text: 'You will need to sign in again to access the portal.',
      confirmText: 'Sign out',
      cancelText: 'Cancel',
      danger: false,
    })
    if (!ok) return

    wpLoading({
      title: 'Signing out…',
    })

    try {
      await logout()
      wpClose()
      navigate('/login', { replace: true })
    } catch {
      await wpAlert({
        icon: 'error',
        title: 'Sign out failed',
        text: 'Something went wrong. Please try again.',
      })
    }
  }

  function closeMobileNav() {
    if (window.innerWidth < 768) setCollapsed(false)
  }

  function toggleGroup(key) {
    setOpenGroups((prev) => {
      const willOpen = !prev[key]
      if (!willOpen) return { ...prev, [key]: false }
      // Accordion: opening one parent closes the others
      const next = {}
      Object.keys(prev).forEach((k) => {
        next[k] = false
      })
      next[key] = true
      return next
    })
  }

  return (
    <div className={`wp-dash${collapsed ? ' is-collapsed' : ''}`}>
      <div
        className="wp-dash__overlay"
        onClick={() => setCollapsed(false)}
        aria-hidden="true"
      />

      <aside className="wp-dash__sidebar" aria-label="Main navigation">
        <NavLink to="/" end className="wp-dash__brand" onClick={closeMobileNav}>
          <img src={logo} alt="West Prime" className="wp-dash__brand-logo" />
          <span className="wp-dash__brand-text">
            <span className="wp-dash__brand-title">West Prime Horizon Institute, Inc.</span>
          </span>
        </NavLink>

        <nav className="wp-dash__nav">
          {sections.map((section) => (
            <div key={section.heading}>
              <p className="wp-dash__nav-heading">
                {section.heading === 'Main' ? 'Main Navigation' : section.heading}
              </p>
              {section.items.map((item) => {
                if (isNavGroup(item)) {
                  const key = groupKey(section.heading, item)
                  const ParentIcon = item.icon
                  const groupActive = isGroupActive(location.pathname, item)
                  const expanded = Boolean(openGroups[key]) || groupActive

                  return (
                    <div key={key} className={`wp-dash__nav-group${expanded ? ' is-open' : ''}${groupActive ? ' is-active' : ''}`}>
                      <button
                        type="button"
                        className={`wp-dash__nav-parent${groupActive ? ' is-active' : ''}`}
                        aria-expanded={expanded}
                        onClick={() => toggleGroup(key)}
                      >
                        <span className="wp-dash__nav-icon">
                          <ParentIcon />
                        </span>
                        <span className="wp-dash__nav-label">{item.label}</span>
                        <FiChevronDown
                          size={14}
                          className={`wp-dash__nav-chevron${expanded ? ' is-open' : ''}`}
                        />
                      </button>
                      <div className={`wp-dash__nav-children${expanded ? ' is-open' : ''}`}>
                        <div className="wp-dash__nav-children-inner">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon
                            const childActive = isChildActive(location.pathname, child)
                            return (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                end={child.end}
                                className={() =>
                                  `wp-dash__nav-child${childActive ? ' is-active' : ''}`
                                }
                                onClick={closeMobileNav}
                              >
                                <span className="wp-dash__nav-icon">
                                  <ChildIcon />
                                </span>
                                <span>{child.label}</span>
                              </NavLink>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                }

                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `wp-dash__nav-link${isActive ? ' is-active' : ''}`
                    }
                    onClick={closeMobileNav}
                  >
                    <span className="wp-dash__nav-icon">
                      <Icon />
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="wp-dash__content">
        <header className="wp-dash__topbar">
          <button
            type="button"
            className="wp-dash__toggle"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((v) => !v)}
          >
            <FiMenu size={22} />
          </button>

          <div className="wp-dash__top-actions">
            <div className="wp-dash__user-wrap" ref={menuRef}>
              <button
                type="button"
                className="wp-dash__user-btn"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span className="wp-dash__avatar">{initials(user?.name)}</span>
                <span className="wp-dash__user-name" title={user?.name || 'User'}>
                  {user?.name || 'User'}
                </span>
                <FiChevronDown
                  size={14}
                  className={`wp-dash__user-chevron${menuOpen ? ' is-open' : ''}`}
                />
              </button>
              <div
                className={`wp-dash__user-menu${menuOpen ? ' is-open' : ''}`}
                role="menu"
                aria-hidden={!menuOpen}
              >
                <button type="button" role="menuitem" tabIndex={menuOpen ? 0 : -1} onClick={handleLogout}>
                  <FiLogOut />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="wp-dash__main">
          <Outlet />
        </main>

        <footer className="wp-dash__footer">
          <div className="wp-dash__footer-inner">
            <span>© {new Date().getFullYear()} West Prime Horizon Institute, Inc.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
