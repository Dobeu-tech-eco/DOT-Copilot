export interface CsvColumn {
  key: string
  label: string
  enabled: boolean
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function buildCSV(rows: Record<string, string | number | null | undefined>[], columns: CsvColumn[]): string {
  const activeColumns = columns.filter(c => c.enabled)
  const header = activeColumns.map(c => escapeCell(c.label)).join(',')
  const body = rows.map(row =>
    activeColumns.map(c => escapeCell(row[c.key])).join(',')
  ).join('\n')
  return `${header}\n${body}`
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
