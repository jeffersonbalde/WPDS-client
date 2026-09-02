import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import { AuthProvider, useAuth } from './context/AuthContext'
import DashboardLayout from './layouts/DashboardLayout'
import WestPrimeLoader from './components/common/WestPrimeLoader'
import 'react-toastify/dist/ReactToastify.css'
import './styles/wp-swal.css'
import './styles/wp-toast.css'
import './App.css'
import AdmissionCreatePage from './pages/AdmissionCreatePage'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdmissionsListPage = lazy(() => import('./pages/AdmissionsListPage'))
const AdmissionDetailPage = lazy(() => import('./pages/AdmissionDetailPage'))
const CurriculumPage = lazy(() => import('./pages/CurriculumPage'))
const TeacherClassesPage = lazy(() => import('./pages/TeacherClassesPage'))
const GradeSheetPage = lazy(() => import('./pages/GradeSheetPage'))
const GradeChangesPage = lazy(() => import('./pages/GradeChangesPage'))
const GradeApprovalsPage = lazy(() => import('./pages/GradeApprovalsPage'))
const StudentsManagePage = lazy(() => import('./pages/StudentsManagePage'))
const StudentCreatePage = lazy(() => import('./pages/StudentCreatePage'))
const StudentRecordPage = lazy(() => import('./pages/StudentRecordPage'))
const StudentEditPage = lazy(() => import('./pages/StudentEditPage'))
const AdmissionsManagePage = lazy(() => import('./pages/AdmissionsManagePage'))
const ClassSectionsManagePage = lazy(() => import('./pages/ClassSectionsManagePage'))
const ProgramsPage = lazy(() => import('./pages/ProgramsPage'))
const CurriculumManagePage = lazy(() => import('./pages/CurriculumManagePage'))
const SubjectsPage = lazy(() => import('./pages/SubjectsPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SystemPage = lazy(() => import('./pages/SystemPage'))
const MonitorPage = lazy(() => import('./pages/MonitorPage'))

function RouteFallback() {
  return (
    <WestPrimeLoader
      variant="page"
      message="Loading…"
      label="Loading"
    />
  )
}

function LazyRoute({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function Protected({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <WestPrimeLoader
        variant="fullscreen"
        message="Please wait…"
        label="Loading"
      />
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function DashboardRoot() {
  return (
    <Protected>
      <DashboardLayout />
    </Protected>
  )
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <LazyRoute>
        <LoginPage />
      </LazyRoute>
    ),
  },
  {
    path: '/',
    element: <DashboardRoot />,
    children: [
      { index: true, element: <LazyRoute><HomePage /></LazyRoute> },
      { path: 'profile', element: <Protected roles={['student', 'alumni']}><LazyRoute><ProfilePage /></LazyRoute></Protected> },
      { path: 'admissions', element: <Protected roles={['student', 'alumni']}><LazyRoute><AdmissionsListPage /></LazyRoute></Protected> },
      { path: 'admissions/:id', element: <LazyRoute><AdmissionDetailPage /></LazyRoute> },
      { path: 'curriculum', element: <Protected roles={['student', 'alumni']}><LazyRoute><CurriculumPage /></LazyRoute></Protected> },

      { path: 'classes', element: <Protected roles={['teacher']}><LazyRoute><TeacherClassesPage /></LazyRoute></Protected> },
      { path: 'classes/:id', element: <Protected roles={['teacher']}><LazyRoute><GradeSheetPage /></LazyRoute></Protected> },
      { path: 'grade-changes', element: <Protected roles={['teacher']}><LazyRoute><GradeChangesPage /></LazyRoute></Protected> },

      { path: 'students', element: <Protected roles={['registrar']}><LazyRoute><StudentsManagePage /></LazyRoute></Protected> },
      { path: 'students/new', element: <Protected roles={['registrar']}><LazyRoute><StudentCreatePage /></LazyRoute></Protected> },
      { path: 'students/:id/edit', element: <Protected roles={['registrar']}><LazyRoute><StudentEditPage /></LazyRoute></Protected> },
      { path: 'students/:id', element: <Protected roles={['registrar']}><LazyRoute><StudentRecordPage /></LazyRoute></Protected> },
      { path: 'admissions-manage', element: <Protected roles={['registrar']}><LazyRoute><AdmissionsManagePage /></LazyRoute></Protected> },
      { path: 'admissions-manage/new', element: <Protected roles={['registrar']}><AdmissionCreatePage /></Protected> },
      { path: 'class-sections', element: <Protected roles={['registrar']}><LazyRoute><ClassSectionsManagePage /></LazyRoute></Protected> },
      { path: 'programs', element: <Protected roles={['registrar']}><LazyRoute><ProgramsPage /></LazyRoute></Protected> },
      { path: 'curriculum-manage', element: <Protected roles={['registrar']}><LazyRoute><CurriculumManagePage /></LazyRoute></Protected> },
      { path: 'subjects', element: <Protected roles={['registrar']}><LazyRoute><SubjectsPage /></LazyRoute></Protected> },
      { path: 'terms', element: <Protected roles={['registrar']}><LazyRoute><TermsPage /></LazyRoute></Protected> },
      { path: 'grade-approvals', element: <Protected roles={['registrar']}><LazyRoute><GradeApprovalsPage /></LazyRoute></Protected> },

      { path: 'users', element: <Protected roles={['it']}><LazyRoute><UsersPage /></LazyRoute></Protected> },
      { path: 'system', element: <Protected roles={['it']}><LazyRoute><SystemPage /></LazyRoute></Protected> },

      { path: 'monitor/:resource', element: <Protected roles={['admin', 'stakeholder']}><LazyRoute><MonitorPage /></LazyRoute></Protected> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return (
    <AuthProvider>
      <ToastContainer
        theme="light"
        newestOnTop
        closeOnClick
        pauseOnHover
        autoClose={4500}
        limit={3}
        hideProgressBar={false}
        toastClassName="wp-toast"
        bodyClassName="wp-toast__body"
        progressClassName="wp-toast__progress"
        style={{ fontSize: '0.875rem' }}
      />
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
