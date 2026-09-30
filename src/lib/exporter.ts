import Papa from 'papaparse'

/**
 * Export tabular data array to CSV file download
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert('No records available to export.')
    return
  }

  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
