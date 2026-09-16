import { useParams } from 'react-router-dom'
import MonitorStudentsPage from './MonitorStudentsPage'
import MonitorTeachersPage from './MonitorTeachersPage'
import MonitorProgramsPage from './MonitorProgramsPage'
import MonitorSubjectsPage from './MonitorSubjectsPage'

const RESOURCE_PAGES = {
  students: MonitorStudentsPage,
  teachers: MonitorTeachersPage,
  programs: MonitorProgramsPage,
  subjects: MonitorSubjectsPage,
}

export default function MonitorPage() {
  const { resource } = useParams()
  const ResourcePage = RESOURCE_PAGES[resource]

  if (!ResourcePage) {
    return (
      <div className="wp-flat">
        <div className="wp-flat__top">
          <div>
            <h1 className="wp-flat__title">Directory</h1>
            <p className="wp-flat__sub">Unknown directory resource.</p>
          </div>
        </div>
      </div>
    )
  }

  return <ResourcePage />
}
