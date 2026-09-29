import SystemBrandingPanel from '../components/system/SystemBrandingPanel'
import './StudentsManagePage.css'
import './SystemPage.css'

export default function BrandingPage() {
  return (
    <div className="wp-flat wp-system">
      <div className="wp-flat__top">
        <div>
          <h1 className="wp-flat__title">School Info</h1>
          <p className="wp-flat__sub">
            Change the logo, school name, login text, and login background.
          </p>
        </div>
      </div>

      <SystemBrandingPanel />
    </div>
  )
}
