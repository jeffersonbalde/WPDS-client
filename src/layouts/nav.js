import {
  FiHome,
  FiUser,
  FiFileText,
  FiBookOpen,
  FiUsers,
  FiLayers,
  FiClipboard,
  FiCheckSquare,
  FiBriefcase,
  FiBook,
  FiCalendar,
  FiEdit3,
  FiTool,
  FiUserPlus,
  FiList,
} from 'react-icons/fi'

/**
 * @typedef {{ to: string, label: string, end?: boolean, icon: import('react').ComponentType }} NavLinkItem
 * @typedef {{ label: string, icon: import('react').ComponentType, children: NavLinkItem[], match?: string }} NavGroupItem
 * @typedef {NavLinkItem | NavGroupItem} NavItem
 * @typedef {{ heading: string, items: NavItem[] }} NavSection
 */

/** @type {NavSection[]} */
const studentSections = [
  {
    heading: 'Main',
    items: [
      { to: '/', label: 'Dashboard', end: true, icon: FiHome },
      {
        label: 'Student',
        icon: FiUser,
        match: '/(profile|admissions|curriculum)',
        children: [
          { to: '/profile', label: 'My Profile', icon: FiUser },
          { to: '/admissions', label: 'My Admissions', icon: FiFileText },
          { to: '/curriculum', label: 'Curriculum', icon: FiBookOpen },
        ],
      },
    ],
  },
]

/** @type {Record<string, NavSection[]>} */
const byRole = {
  student: studentSections,
  alumni: studentSections,
  teacher: [
    {
      heading: 'Main',
      items: [{ to: '/', label: 'Dashboard', end: true, icon: FiHome }],
    },
    {
      heading: 'Grades',
      items: [
        { to: '/classes', label: 'My Classes', icon: FiLayers },
        { to: '/grade-changes', label: 'Grade Change Requests', icon: FiEdit3 },
      ],
    },
  ],  
  registrar: [
    {
      heading: 'Main',
      items: [{ to: '/', label: 'Dashboard', end: true, icon: FiHome }],
    },
    {
      heading: 'Academic Records',
      items: [
        {
          label: 'Students',
          icon: FiUsers,
          match: '/students',
          children: [
            { to: '/students', label: 'All Students', end: true, icon: FiList },
            { to: '/students/new', label: 'Add Student', icon: FiUserPlus },
          ],
        },
        {
          label: 'Admissions',
          icon: FiClipboard,
          match: '/admissions-manage',
          children: [
            { to: '/admissions-manage', label: 'All Admissions', end: true, icon: FiList },
            { to: '/admissions-manage/new', label: 'Create Admission', icon: FiUserPlus },
          ],
        },
        { to: '/class-sections', label: 'Class Sections', icon: FiLayers },
        { to: '/programs', label: 'Programs', icon: FiBriefcase },
        { to: '/curriculum-manage', label: 'Curriculum', icon: FiBookOpen },
        { to: '/subjects', label: 'Subjects', icon: FiBook },
        { to: '/terms', label: 'School Terms', icon: FiCalendar },
      ],
    },
    {
      heading: 'Approvals',
      items: [{ to: '/grade-approvals', label: 'Grade Approvals', icon: FiCheckSquare }],
    },
  ],
  it: [
    {
      heading: 'Main',
      items: [{ to: '/', label: 'Dashboard', end: true, icon: FiHome }],
    },
    {
      heading: 'System',
      items: [
        { to: '/users', label: 'User Management', icon: FiUsers },
        { to: '/system', label: 'System Maintenance', icon: FiTool },
      ],
    },
  ],
  admin: [
    {
      heading: 'Main',
      items: [{ to: '/', label: 'Dashboard', end: true, icon: FiHome }],
    },
    {
      heading: 'Monitoring',
      items: [
        { to: '/monitor/students', label: 'Students', icon: FiUsers },
        { to: '/monitor/teachers', label: 'Teachers', icon: FiUser },
        { to: '/monitor/programs', label: 'Programs', icon: FiBriefcase },
        { to: '/monitor/subjects', label: 'Subjects', icon: FiBook },
      ],
    },
  ],
  stakeholder: [
    {
      heading: 'Main',
      items: [{ to: '/', label: 'Dashboard', end: true, icon: FiHome }],
    },
    {
      heading: 'Oversight',
      items: [
        { to: '/monitor/students', label: 'Students', icon: FiUsers },
        { to: '/monitor/teachers', label: 'Teachers', icon: FiUser },
        { to: '/monitor/programs', label: 'Programs', icon: FiBriefcase },
        { to: '/monitor/subjects', label: 'Subjects', icon: FiBook },
      ],
    },
  ],
}

const fallback = [
  {
    heading: 'Main',
    items: [{ to: '/', label: 'Dashboard', end: true, icon: FiHome }],
  },
]

/**
 * @param {string} [role]
 * @returns {NavSection[]}
 */
export function getNavForRole(role) {
  return byRole[role] ?? fallback
}

/** @param {NavItem} item */
export function isNavGroup(item) {
  return Array.isArray(item?.children) && item.children.length > 0
}

/**
 * @param {string} pathname
 * @param {NavGroupItem} group
 */
export function isGroupActive(pathname, group) {
  if (group.match) {
    try {
      return new RegExp(`^${group.match}`).test(pathname)
    } catch {
      /* fall through */
    }
  }
  return group.children.some((child) => {
    if (child.end) return pathname === child.to
    return pathname === child.to || pathname.startsWith(`${child.to}/`)
  })
}

/**
 * Active state for "All Students" should include edit pages (/students/:id) but not /students/new
 * @param {string} pathname
 * @param {NavLinkItem} child
 */
export function isChildActive(pathname, child) {
  if (child.to === '/students' && child.end) {
    if (pathname === '/students') return true
    if (pathname.startsWith('/students/') && pathname !== '/students/new') return true
    return false
  }
  if (child.to === '/admissions-manage' && child.end) {
    if (pathname === '/admissions-manage') return true
    if (pathname.startsWith('/admissions-manage/') && pathname !== '/admissions-manage/new') return true
    return false
  }
  if (child.end) return pathname === child.to
  return pathname === child.to || pathname.startsWith(`${child.to}/`)
}

export function roleLabel(role) {
  const map = {
    student: 'Student',
    alumni: 'Alumni',
    teacher: 'Teacher',
    registrar: 'Registrar',
    it: 'IT Administrator',
    admin: 'System Admin',
    stakeholder: 'Stakeholder',
  }
  return map[role] ?? role ?? 'User'
}
