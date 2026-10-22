import { useState } from 'react'
import { X, Download, ChevronUp, ChevronDown, Settings2 } from 'lucide-react'
import { buildCSV, downloadCSV } from '../utils/csv'
import type { CsvColumn } from '../utils/csv'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  filteredRows: Record<string, string | number | null | undefined>[]
  allRows: Record<string, string | number | null | undefined>[]
  defaultColumns: CsvColumn[]
  filename?: string
}

export function ExportModal({ open, onClose, filteredRows, allRows, defaultColumns, filename = 'export.csv' }: ExportModalProps) {
  const [includeAll, setIncludeAll] = useState(false)
  const [columns, setColumns] = useState<CsvColumn[]>(defaultColumns)
  const [showCustomize, setShowCustomize] = useState(false)

  if (!open) return null

  const toggleColumn = (key: string) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, enabled: !c.enabled } : c))
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    setColumns(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  const moveDown = (index: number) => {
    if (index === columns.length - 1) return
    setColumns(prev => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  const handleDownload = () => {
    const rows = includeAll ? allRows : filteredRows
    const csv = buildCSV(rows, columns)
    downloadCSV(csv, filename)
    onClose()
  }

  const rows = includeAll ? allRows : filteredRows
  const enabledCount = columns.filter(c => c.enabled).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Download size={18} className="text-brand-600" />
            <h3 className="text-lg font-semibold text-gray-900">Export CSV</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 flex items-start gap-3">
            <input
              type="checkbox"
              id="include-all"
              checked={includeAll}
              onChange={e => setIncludeAll(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="include-all" className="cursor-pointer">
              <span className="text-sm font-medium text-gray-900 block">Include all drivers</span>
              <span className="text-xs text-gray-500">
                {includeAll
                  ? `All ${allRows.length} driver${allRows.length !== 1 ? 's' : ''} will be exported`
                  : `Only the ${filteredRows.length} currently filtered driver${filteredRows.length !== 1 ? 's' : ''} will be exported`}
              </span>
            </label>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowCustomize(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Customize Columns</span>
                <span className="badge badge-info">{enabledCount} selected</span>
              </div>
              {showCustomize ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {showCustomize && (
              <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs text-gray-500">Check to include. Use arrows to reorder.</p>
                </div>
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {columns.map((col, index) => (
                    <div key={col.key} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        id={`col-${col.key}`}
                        checked={col.enabled}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <label htmlFor={`col-${col.key}`} className="flex-1 text-sm text-gray-700 cursor-pointer">
                        {col.label}
                      </label>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(index)}
                          disabled={index === columns.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-700">
              <span className="font-medium">{rows.length} row{rows.length !== 1 ? 's' : ''}</span> with{' '}
              <span className="font-medium">{enabledCount} column{enabledCount !== 1 ? 's' : ''}</span> will be exported
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={enabledCount === 0 || rows.length === 0}
            className="btn-primary"
          >
            <Download size={16} />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  )
}
