import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkflowState } from '@/hooks/useWorkflowState'
import { csvParserService, ParsedTransactionRow, CsvParseResult, ColumnMapping, TransactionDirection } from '@/services/csvParserService'
import { paymentImportService, ImportSummary } from '@/services/paymentImportService'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ColumnMappingModal } from '@/components/common/ColumnMappingModal'
import { EditStatementRowModal } from '@/components/common/EditStatementRowModal'
import { ImportSummaryModal } from '@/components/common/ImportSummaryModal'
import {
  FileSpreadsheet,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowUpDown,
  Edit2,
  Trash2,
  RotateCcw,
  UploadCloud,
  Check,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

interface StatementReviewPanelProps {
  onImportComplete?: () => void
}

export const StatementReviewPanel: React.FC<StatementReviewPanelProps> = ({ onImportComplete }) => {
  const { user } = useAuth()
  const { state } = useWorkflowState()

  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [rows, setRows] = useState<ParsedTransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortField, setSortField] = useState<'date' | 'amount' | 'rowNumber'>('rowNumber')
  const [sortAsc, setSortAsc] = useState(true)

  // Modals
  const [isMappingOpen, setIsMappingOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<ParsedTransactionRow | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)

  // Feedback banner
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setFeedback({ text, type })
    setTimeout(() => setFeedback(null), 4000)
  }

  const userId = user?.id || 'demo-shopkeeper-001'

  // Load and parse CSV string from workflow state
  const loadAndParseCsv = async (customMapping?: ColumnMapping) => {
    let csvText = state.statement?.csvContent

    if (!csvText && state.statement?.isSample) {
      try {
        const res = await fetch('/sample-data/sample-statement.csv')
        csvText = await res.text()
      } catch (e) {
        console.error('Failed to fetch sample csv', e)
      }
    }

    if (!csvText) {
      return
    }

    setLoading(true)
    try {
      const result = csvParserService.parseCsvString(csvText, customMapping)
      setParseResult(result)

      // Run duplicate check against database
      const checkedRows = await paymentImportService.checkDuplicatePayments(userId, result.rows)
      setRows(checkedRows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAndParseCsv()
  }, [state.statement?.csvContent, userId])

  // --- ACTIONS ---
  const handleApplyMapping = (newMapping: ColumnMapping) => {
    loadAndParseCsv(newMapping)
    showToast('Column mapping updated.')
  }

  const handleToggleExclude = (rowNumber: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowNumber === rowNumber) {
          const nextStatus = r.status === 'excluded' ? 'valid' : 'excluded'
          return { ...r, status: nextStatus }
        }
        return r
      })
    )
  }

  const handleSaveRowEdit = (updated: {
    payerName: string
    amount: number
    date: string | null
    reference: string | null
    direction: TransactionDirection
  }) => {
    if (!editingRow) return

    setRows((prev) =>
      prev.map((r) => {
        if (r.rowNumber === editingRow.rowNumber) {
          return {
            ...r,
            ...updated,
            status: updated.direction === 'outgoing' ? 'excluded' : 'valid',
            validationReason: updated.direction === 'outgoing' ? 'Marked as outgoing' : null,
          }
        }
        return r
      })
    )
    showToast(`Row #${editingRow.rowNumber} updated successfully.`)
  }

  const handleImport = async (includeDuplicates: boolean = false) => {
    setIsImporting(true)
    try {
      const { summary, error } = await paymentImportService.importPayments(userId, rows, {
        includeDuplicates,
      })

      if (error) {
        showToast(error.message, 'error')
      } else {
        setImportSummary(summary)
        setIsSummaryOpen(true)
        if (onImportComplete) onImportComplete()
      }
    } finally {
      setIsImporting(false)
    }
  }

  // --- STATS DYNAMICALLY CALCULATED ---
  const stats = useMemo(() => {
    const total = rows.length
    const valid = rows.filter((r) => r.status === 'valid').length
    const duplicates = rows.filter((r) => r.status === 'possible_duplicate').length
    const excluded = rows.filter((r) => r.status === 'excluded').length
    const invalid = rows.filter((r) => r.status === 'invalid').length
    const totalAmount = rows
      .filter((r) => r.status === 'valid' && r.direction === 'incoming')
      .reduce((sum, r) => sum + r.amount, 0)

    return { total, valid, duplicates, excluded, invalid, totalAmount }
  }, [rows])

  // --- FILTERED & SORTED ROWS ---
  const displayedRows = useMemo(() => {
    return rows
      .filter((r) => {
        const matchesQuery =
          r.payerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.reference && r.reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
          String(r.amount).includes(searchQuery)

        if (!matchesQuery) return false

        if (filterStatus === 'valid') return r.status === 'valid'
        if (filterStatus === 'duplicates') return r.status === 'possible_duplicate'
        if (filterStatus === 'excluded') return r.status === 'excluded'
        if (filterStatus === 'invalid') return r.status === 'invalid'

        return true
      })
      .sort((a, b) => {
        let valA: any = a[sortField] || ''
        let valB: any = b[sortField] || ''
        if (sortField === 'amount') {
          valA = a.amount
          valB = b.amount
        }
        if (valA < valB) return sortAsc ? -1 : 1
        if (valA > valB) return sortAsc ? 1 : -1
        return 0
      })
  }, [rows, searchQuery, filterStatus, sortField, sortAsc])

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-600" />
            <span>Bank & UPI Statement Transactions</span>
          </h2>
          <p className="text-xs text-slate-500">
            {state.statement?.name || 'Statement CSV'} • Automatic Column Detection Active
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {parseResult && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMappingOpen(true)}
              className="h-9 px-3 text-xs font-bold rounded-xl border-slate-300 text-slate-700 bg-white"
            >
              <Sliders className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
              <span>Map Columns</span>
            </Button>
          )}

          <Button
            type="button"
            disabled={stats.valid === 0 || isImporting}
            onClick={() => handleImport(false)}
            className="h-9 px-4 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md"
          >
            {isImporting ? (
              <span className="flex items-center space-x-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importing...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 mr-1" />
                <span>Import {stats.valid} Valid Payments</span>
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3 rounded-xl flex items-center space-x-2 text-xs font-semibold animate-in fade-in ${
            feedback.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-teal-50 border border-teal-200 text-teal-800'
          }`}
        >
          <Check className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rows</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">{stats.total}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/50 shadow-sm">
          <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wider flex items-center">
            <span className="w-2 h-2 rounded-full bg-teal-500 mr-1.5"></span>
            Valid Deposits
          </p>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-xl font-black text-teal-900">{stats.valid}</span>
            <span className="text-xs font-bold text-teal-700">{formatINR(stats.totalAmount)}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm">
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Duplicates</p>
          <p className="text-xl font-black text-amber-900 mt-0.5">{stats.duplicates}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Excluded</p>
          <p className="text-xl font-black text-slate-700 mt-0.5">{stats.excluded}</p>
        </div>

        <div className="p-3.5 rounded-2xl border border-red-100 bg-red-50/30 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Invalid Rows</p>
          <p className="text-xl font-black text-red-900 mt-0.5">{stats.invalid}</p>
        </div>
      </div>

      {/* Table & Controls Card */}
      <Card className="rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden bg-white">
        {/* Filter and Search Bar */}
        <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Search payer, UTR or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
            {[
              { id: 'all', label: 'All', count: stats.total },
              { id: 'valid', label: 'Valid', count: stats.valid },
              { id: 'duplicates', label: 'Duplicates', count: stats.duplicates },
              { id: 'excluded', label: 'Excluded', count: stats.excluded },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all ${
                  filterStatus === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-1 opacity-75 text-[10px]">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-100/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Payer Name</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3 hidden md:table-cell">Reference</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-teal-600 mb-1" />
                      <p className="text-xs">Parsing CSV records...</p>
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      <p className="text-xs font-semibold">No transactions found for current filter.</p>
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row) => {
                    const isValid = row.status === 'valid'
                    const isDup = row.status === 'possible_duplicate'
                    const isExcluded = row.status === 'excluded'
                    const isInvalid = row.status === 'invalid'

                    return (
                      <tr
                        key={row.rowNumber}
                        className={`transition-colors ${
                          isExcluded
                            ? 'bg-slate-50/60 text-slate-400 opacity-60'
                            : isDup
                            ? 'bg-amber-50/50 hover:bg-amber-50'
                            : isInvalid
                            ? 'bg-red-50/50'
                            : 'hover:bg-slate-50/70 text-slate-900'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                          {row.rowNumber}
                        </td>

                        <td className="py-2.5 px-3 text-xs text-slate-600">
                          {formatDate(row.date)}
                        </td>

                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          <div className="flex flex-col">
                            <span>{row.payerName}</span>
                            {row.validationReason && (
                              <span className="text-[10px] text-amber-700 font-normal">
                                {row.validationReason}
                              </span>
                            )}
                            {row.duplicateReason && (
                              <span className="text-[10px] text-amber-700 font-normal">
                                {row.duplicateReason}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-extrabold text-slate-900">
                          {formatINR(row.amount)}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-xs text-slate-500 hidden md:table-cell">
                          {row.reference || '—'}
                        </td>

                        <td className="py-2.5 px-3">
                          {isValid ? (
                            <Badge variant="success" className="text-[10px] font-bold">
                              Valid Inflow
                            </Badge>
                          ) : isDup ? (
                            <Badge variant="warning" className="text-[10px] font-bold">
                              Possible Duplicate
                            </Badge>
                          ) : isExcluded ? (
                            <Badge variant="outline" className="text-[10px] text-slate-400 bg-white">
                              Excluded
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] font-bold">
                              Invalid
                            </Badge>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => setEditingRow(row)}
                              title="Edit Transaction"
                              className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleExclude(row.rowNumber)}
                              title={isExcluded ? 'Restore Transaction' : 'Exclude Transaction'}
                              className={`p-1 rounded-lg border text-xs ${
                                isExcluded
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600'
                              }`}
                            >
                              {isExcluded ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Column Mapping Modal */}
      {parseResult && (
        <ColumnMappingModal
          isOpen={isMappingOpen}
          headers={parseResult.headers}
          currentMapping={parseResult.mapping}
          onApply={handleApplyMapping}
          onClose={() => setIsMappingOpen(false)}
        />
      )}

      {/* Edit Statement Row Modal */}
      <EditStatementRowModal
        isOpen={Boolean(editingRow)}
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSave={handleSaveRowEdit}
      />

      {/* Import Summary Modal */}
      <ImportSummaryModal
        isOpen={isSummaryOpen}
        summary={importSummary}
        onProceedToMatches={() => {
          setIsSummaryOpen(false)
          window.location.href = '/matches'
        }}
        onClose={() => setIsSummaryOpen(false)}
      />
    </div>
  )
}
