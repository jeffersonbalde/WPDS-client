import { apiErrorMessage } from './apiError'

export async function downloadExcelExport({
  api,
  url,
  params = {},
  fallbackFilename,
  successMessage,
  failureMessage = 'Failed to export report.',
}) {
  const response = await api.get(url, {
    params,
    responseType: 'blob',
  })

  const disposition = response.headers['content-disposition'] || ''
  const match = disposition.match(/filename="?([^"]+)"?/i)
  const filename = match?.[1] || fallbackFilename || `export-${new Date().toISOString().slice(0, 10)}.xlsx`

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)

  return { filename, successMessage }
}

export async function excelExportError(err, failureMessage = 'Failed to export report.') {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const json = JSON.parse(text)
      return json.message || failureMessage
    } catch {
      return failureMessage
    }
  }
  return apiErrorMessage(err, failureMessage)
}
