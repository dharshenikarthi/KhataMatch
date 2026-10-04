import React from 'react'
import { ImportSummary } from '@/services/paymentImportService'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight, RotateCcw, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { formatINR } from '@/lib/utils'

interface ImportSummaryModalProps {
  isOpen: boolean
  summary: ImportSummary | null
  onProceedToMatches: () => void
  onClose: () => void
}

export const ImportSummaryModal: React.FC<ImportSummaryModalProps> = ({
  isOpen,
  summary,
  onProceedToMatches,
  onClose,
}) => {
  if (!isOpen || !summary) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="p-6 text-center bg-gradient-to-b from-emerald-50 to-white border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Import Completed</h2>
          <p className="text-xs text-slate-500 mt-1">Payments recorded and ready for reconciliation</p>
          <div className="mt-3 inline-block bg-emerald-100/70 text-emerald-900 px-4 py-1.5 rounded-full font-black text-sm">
            {formatINR(summary.totalImportedAmount)} Imported
          </div>
        </div>

        {/* Content Details */}
        <div className="p-6 space-y-4">
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span>Total CSV Rows Processed:</span>
              <span>{summary.totalRows}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-700 font-semibold">
              <span className="flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Successfully Imported:
              </span>
              <span className="font-bold">{summary.importedCount}</span>
            </div>
            {summary.duplicatesSkipped > 0 && (
              <div className="flex items-center justify-between text-amber-700">
                <span>Duplicates Skipped:</span>
                <span className="font-bold">{summary.duplicatesSkipped}</span>
              </div>
            )}
            {summary.excludedCount > 0 && (
              <div className="flex items-center justify-between text-slate-500">
                <span>Excluded (Debits/Withdrawals):</span>
                <span>{summary.excludedCount}</span>
              </div>
            )}
            {summary.invalidCount > 0 && (
              <div className="flex items-center justify-between text-red-600">
                <span>Invalid Rows:</span>
                <span className="font-bold">{summary.invalidCount}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <Button
              type="button"
              onClick={onProceedToMatches}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md"
            >
              <span>Continue to Reconciliation Matches</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full h-10 text-xs font-bold text-slate-600 rounded-xl"
            >
              Close & View Statement
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
