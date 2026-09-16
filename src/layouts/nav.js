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
  FiInbox,
  FiSend,
  FiBarChart2,
  FiPieChart,
  FiActivity,
  FiBell,
} from 'react-icons/fi'

/**
 * Temporary: hide Activity Log from IT / admin / stakeholder nav + quick access.
 * Keep the page + route + API — flip to true when the client wants this feature.
 */
export const ACTIVITY_LOG_NAV_ENABLED = false

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
  teacher: [
    {
      heading: 'Main',
      items: [
        { to: '/', label: 'Dashboard', end: true, icon: FiHome },
        { to: '/notifications', label: 'Notifications', icon: FiBell },
        { to: '/my-profile', label: 'My Profile', icon: FiUser },
      ],
    },
    {
      heading: 'Grades',
      items: [
        { to: '/classes', label: 'My Classes', icon: FiLayers },
        { to: '/grade-submissions', label: 'Grade Submissions', icon: FiSend },
        { to: '/grade-changes', label: 'Grade Change Requests', icon: FiEdit3 },
      ],
    },
  ],
  registrar: [
    {
      heading: 'Main',
      items: [
        { to: '/', label: 'Dashboard', end: true, icon: FiHome },
        { to: '/notifications', label: 'Notifications', icon: FiBell },
        { to: '/my-profile', label: 'My Profile', icon: FiUser },
      ],
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
      items: [
        { to: '/grade-submissions-review', label: 'Grade Submissions', icon: FiInbox },
        { to: '/grade-approvals', label: 'Grade Change Approvals', icon: FiCheckSquare },
      ],
    },
    {
      heading: 'Communication',
      items: [
        { to: '/announcements', label: 'Announcements', icon: FiBell },
      ],
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
        { to: '/system', label: 'Backup & Security', icon: FiTool },
        ...(ACTIVITY_LOG_NAV_ENABLED
          ? [{ to: '/activity-log', label: 'Activity Log', icon: FiActivity }]
          : []),
      ],
    },
  ],
  admin: [
    {
      heading: 'Main',
      items: [
        { to: '/', label: 'Dashboard', end: true, icon: FiHome },
        { to: '/my-profile', label: 'My Profile', icon: FiUser },
      ],
    },
    {
      heading: 'Reports',
      items: [
        { to: '/reports/population', label: 'Student Population', icon: FiUsers },
        { to: '/reports/performance', label: 'Academic Performance', icon: FiBarChart2 },
        { to: '/reports/grade-operations', label: 'Grade Operations', icon: FiPieChart },
      ],
    },
    {
      heading: 'Directory',
      items: [
        { to: '/monitor/students', label: 'Students', icon: FiUsers },
        { to: '/monitor/teachers', label: 'Teachers', icon: FiUser },
        { to: '/monitor/programs', label: 'Programs', icon: FiBriefcase },
        { to: '/monitor/subjects', label: 'Subjects', icon: FiBook },
      ],
    },
    ...(ACTIVITY_LOG_NAV_ENABLED
      ? [{
          heading: 'Oversight',
          items: [{ to: '/activity-log', label: 'Activity Log', icon: FiActivity }],
        }]
      : []),
  ],
  stakeholder: [
    {
      heading: 'Main',
      items: [
        { to: '/', label: 'Dashboard', end: true, icon: FiHome },
        { to: '/my-profile', label: 'My Profile', icon: FiUser },
      ],
    },
    {
      heading: 'Reports',
      items: [
        { to: '/reports/population', label: 'Student Population', icon: FiUsers },
        { to: '/reports/performance', label: 'Academic Performance', icon: FiBarChart2 },
        { to: '/reports/grade-operations', label: 'Grade Operations', icon: FiPieChart },
      ],
    },
    {
      heading: 'Directory',
      items: [
        { to: '/monitor/students', label: 'Students', icon: FiUsers },
        { to: '/monitor/teachers', label: 'Teachers', icon: FiUser },
        { to: '/monitor/programs', label: 'Programs', icon: FiBriefcase },
        { to: '/monitor/subjects', label: 'Subjects', icon: FiBook },
      ],
    },
    ...(ACTIVITY_LOG_NAV_ENABLED
      ? [{
          heading: 'Oversight',
          items: [{ to: '/activity-log', label: 'Activity Log', icon: FiActivity }],
        }]
      : []),
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
    teacher: 'Teacher',
    registrar: 'Registrar',
    it: 'IT Administrator',
    admin: 'System Admin',
    stakeholder: 'Stakeholder',
  }
  return map[role] ?? role ?? 'User'
}
