import ProfileField from './ProfileField'
import { majorLabel } from '../../utils/program'

const PARENT_ROLES = [
  { key: 'father', title: 'Father' },
  { key: 'mother', title: 'Mother' },
  { key: 'guardian', title: 'Guardian' },
]

export default function StudentProfilePanels({
  profile,
  tab,
  readOnly,
  onChange,
  onEduChange,
  onParentChange,
  onBlurField,
  errors = {},
}) {
  if (!profile) return null

  if (tab === 'info') {
    return (
      <div className="wp-profile__grid">
        <ProfileField label="Student No." value={profile.student_no} readOnly />
        <ProfileField
          label="Course / Program"
          value={profile.program?.name || profile.program?.code}
          readOnly
        />
        <ProfileField
          label="Major"
          value={profile.program_major ? majorLabel(profile.program_major) : '—'}
          readOnly
        />
        <ProfileField
          label="Last Name"
          value={profile.last_name}
          readOnly={readOnly}
          onChange={(v) => onChange?.('last_name', v)}
          placeholder="Enter last name"
        />
        <ProfileField
          label="First Name"
          value={profile.first_name}
          readOnly={readOnly}
          onChange={(v) => onChange?.('first_name', v)}
          placeholder="Enter first name"
        />
        <ProfileField
          label="Middle Name"
          value={profile.middle_name}
          readOnly={readOnly}
          onChange={(v) => onChange?.('middle_name', v)}
          placeholder="Enter middle name"
        />
        <ProfileField
          label="Date of Birth"
          value={profile.date_of_birth}
          readOnly={readOnly}
          type="date"
          onChange={(v) => onChange?.('date_of_birth', v)}
        />
        <ProfileField
          label="Place of Birth"
          value={profile.place_of_birth}
          readOnly={readOnly}
          onChange={(v) => onChange?.('place_of_birth', v)}
          placeholder="Enter place of birth"
        />
        <ProfileField
          label="Gender"
          value={profile.gender}
          readOnly={readOnly}
          as="select"
          placeholder="Select gender"
          options={[
            { value: 'Male', label: 'Male' },
            { value: 'Female', label: 'Female' },
          ]}
          onChange={(v) => onChange?.('gender', v)}
        />
        <ProfileField
          label="Civil Status"
          value={profile.civil_status}
          readOnly={readOnly}
          as="select"
          placeholder="Select civil status"
          options={[
            { value: 'Single', label: 'Single' },
            { value: 'Married', label: 'Married' },
            { value: 'Widowed', label: 'Widowed' },
            { value: 'Separated', label: 'Separated' },
          ]}
          onChange={(v) => onChange?.('civil_status', v)}
        />
        <ProfileField
          label="Address Line 1"
          value={profile.address_line_1}
          readOnly={readOnly}
          onChange={(v) => onChange?.('address_line_1', v)}
          placeholder="Enter address"
        />
        <ProfileField
          label="Address Line 2"
          value={profile.address_line_2}
          readOnly={readOnly}
          onChange={(v) => onChange?.('address_line_2', v)}
          placeholder="Enter address line 2"
        />
        <ProfileField
          label="Mobile"
          value={profile.mobile}
          readOnly={readOnly}
          onChange={(v) => onChange?.('mobile', v)}
          placeholder="Enter mobile number"
        />
        <ProfileField
          label="Telephone"
          value={profile.telephone}
          readOnly={readOnly}
          onChange={(v) => onChange?.('telephone', v)}
          placeholder="Enter telephone"
        />
        <ProfileField
          label="Contact Email"
          value={profile.contact_email}
          readOnly={readOnly}
          type="email"
          onChange={(v) => onChange?.('contact_email', v)}
          onBlur={() => onBlurField?.('contact_email')}
          error={errors.contact_email}
          placeholder="Enter email"
        />
        <ProfileField
          label="Ethnic Origin"
          value={profile.ethnic_origin}
          readOnly={readOnly}
          onChange={(v) => onChange?.('ethnic_origin', v)}
          placeholder="Enter ethnic origin"
        />
        <ProfileField
          label="Religion"
          value={profile.religion}
          readOnly={readOnly}
          onChange={(v) => onChange?.('religion', v)}
          placeholder="Enter religion"
        />
        <ProfileField
          label="Academic Level"
          value={String(profile.academic_level || '').toUpperCase()}
          readOnly
        />
        <ProfileField label="Year Level" value={profile.year_level} readOnly />
        <ProfileField label="Section" value={profile.section} readOnly />
        <ProfileField label="Portal Login" value={profile.user?.email} readOnly />
      </div>
    )
  }

  if (tab === 'edu') {
    const edu = profile.educational_background || {}
    return (
      <div className="wp-profile__grid wp-profile__grid--edu">
        <ProfileField
          label="Primary School"
          value={edu.primary_school}
          readOnly={readOnly}
          onChange={(v) => onEduChange?.('primary_school', v)}
          placeholder="Enter primary school"
        />
        <ProfileField
          label="Junior High School"
          value={edu.junior_high_school}
          readOnly={readOnly}
          onChange={(v) => onEduChange?.('junior_high_school', v)}
          placeholder="Enter junior high school"
        />
        <ProfileField
          label="Senior High School"
          value={edu.senior_high_school}
          readOnly={readOnly}
          onChange={(v) => onEduChange?.('senior_high_school', v)}
          placeholder="Enter senior high school"
        />
        <ProfileField
          label="Transferred From"
          value={edu.transferred_from}
          readOnly={readOnly}
          onChange={(v) => onEduChange?.('transferred_from', v)}
          placeholder="Enter previous school (if any)"
        />
      </div>
    )
  }

  if (tab === 'parents') {
    const parents = profile.parents_guardian || {}
    return (
      <div className="wp-profile__parents">
        {PARENT_ROLES.map(({ key, title }) => {
          const person = parents[key] || {}
          return (
            <section key={key} className="wp-profile__parent-card">
              <h3>{title}</h3>
              <div className="wp-profile__parent-fields">
                <ProfileField
                  label={`Name of ${title}`}
                  value={person.name}
                  readOnly={readOnly}
                  onChange={(v) => onParentChange?.(key, 'name', v)}
                  placeholder={`Enter name of ${title.toLowerCase()}`}
                />
                <ProfileField
                  label="Occupation"
                  value={person.occupation}
                  readOnly={readOnly}
                  onChange={(v) => onParentChange?.(key, 'occupation', v)}
                  placeholder="Enter occupation"
                />
                <ProfileField
                  label="Company Name"
                  value={person.company}
                  readOnly={readOnly}
                  onChange={(v) => onParentChange?.(key, 'company', v)}
                  placeholder="Enter company name"
                />
                <ProfileField
                  label="Contact Number"
                  value={person.contact}
                  readOnly={readOnly}
                  onChange={(v) => onParentChange?.(key, 'contact', v)}
                  placeholder="Enter contact number"
                />
                <ProfileField
                  label="Email"
                  value={person.email}
                  readOnly={readOnly}
                  type="email"
                  onChange={(v) => onParentChange?.(key, 'email', v)}
                  placeholder="Enter email"
                />
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  return null
}
