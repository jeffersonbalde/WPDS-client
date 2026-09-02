function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function emptySubjectUsage(subject) {
  return {
    code: subject?.code || '',
    title: subject?.title || '',
    in_use: Boolean(subject?.in_use),
    can_delete: !subject?.in_use,
    curriculum: { total: 0, preview: [] },
    class_sections: { total: 0, preview: [] },
    enrollments: { total: 0, preview: [] },
  }
}

export function subjectUsageHasRecords(usage) {
  return Boolean(
    usage?.curriculum?.total
      || usage?.class_sections?.total
      || usage?.enrollments?.total
  )
}

function curriculumLine(row) {
  const program = row.program ? `${row.program}` : ''
  const extra = [
    row.year_level ? `Year ${row.year_level}` : '',
    row.semester ? `Sem ${row.semester}` : '',
  ].filter(Boolean).join(' · ')
  const subject = [row.code, row.title].filter(Boolean).join(' — ')
  return escapeHtml([program, subject, extra].filter(Boolean).join(' · '))
}

function sectionLine(row) {
  const bits = [row.term, row.section ? `Sec ${row.section}` : ''].filter(Boolean).join(' · ')
  const enrolled = row.enrolled ? `${row.enrolled} enrolled` : ''
  return escapeHtml([bits, enrolled].filter(Boolean).join(' · ') || 'Class section')
}

function enrollmentLine(row) {
  const who = [row.student_no, row.name].filter(Boolean).join(' — ')
  const extra = [row.term, row.section ? `Sec ${row.section}` : ''].filter(Boolean).join(' · ')
  return escapeHtml(extra ? `${who} · ${extra}` : who)
}

export function subjectUsageRecordsHtml(usage) {
  const curriculum = usage?.curriculum?.total || 0
  const sections = usage?.class_sections?.total || 0
  const enrollments = usage?.enrollments?.total || 0
  const chips = [
    curriculum ? `Curriculum ${curriculum}` : '',
    sections ? `Class sections ${sections}` : '',
    enrollments ? `Enrollments ${enrollments}` : '',
  ].filter(Boolean)

  let preview = { items: [], total: 0, format: curriculumLine, noun: 'records' }
  if (enrollments) {
    preview = {
      items: usage.enrollments.preview || [],
      total: enrollments,
      format: enrollmentLine,
      noun: 'enrollments',
    }
  } else if (sections) {
    preview = {
      items: usage.class_sections.preview || [],
      total: sections,
      format: sectionLine,
      noun: 'sections',
    }
  } else if (curriculum) {
    preview = {
      items: usage.curriculum.preview || [],
      total: curriculum,
      format: curriculumLine,
      noun: 'programs',
    }
  }

  const shown = preview.items.slice(0, 4)
  const extra = preview.total > shown.length
    ? `<li class="wp-swal__list-more">and ${preview.total - shown.length} more ${preview.noun}</li>`
    : ''

  if (!chips.length) return ''

  return `
    <div class="wp-swal__counts">
      ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}
    </div>
    ${shown.length ? `<ul class="wp-swal__list">${shown.map((item) => `<li>${preview.format(item)}</li>`).join('')}${extra}</ul>` : ''}
  `
}

export function subjectUsageDialogHtml(lead, usage) {
  const records = subjectUsageRecordsHtml(usage)
  return `
    <div class="wp-swal__detail">
      <p class="wp-swal__detail-lead">${lead}</p>
      ${records}
    </div>
  `
}

export function curriculumRemoveDialogHtml(lead, usage) {
  const enrollments = usage?.enrollments?.total || 0
  if (!enrollments) {
    return `<div class="wp-swal__detail"><p class="wp-swal__detail-lead">${lead}</p></div>`
  }

  const preview = (usage?.enrollments?.preview || []).slice(0, 4)
  const extra = enrollments > preview.length
    ? `<li class="wp-swal__list-more">and ${enrollments - preview.length} more enrollments</li>`
    : ''
  const rows = preview.map((row) => {
    const who = [row.student_no, row.name].filter(Boolean).join(' — ')
    const extraBits = [row.term, row.section ? `Sec ${row.section}` : ''].filter(Boolean).join(' · ')
    return `<li>${escapeHtml(extraBits ? `${who} · ${extraBits}` : who)}</li>`
  }).join('')

  return `
    <div class="wp-swal__detail">
      <p class="wp-swal__detail-lead">${lead}</p>
      <p class="wp-swal__detail-note">Note: ${enrollments} student enrollment${enrollments === 1 ? '' : 's'} exist for this subject. Removing it from the curriculum will not delete grades or enrollment records.</p>
      <div class="wp-swal__counts"><span>Enrollments ${enrollments}</span></div>
      <ul class="wp-swal__list">${rows}${extra}</ul>
    </div>
  `
}
