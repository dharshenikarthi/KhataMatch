import React from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertTriangle, X, ShieldCheck } from 'lucide-react'

interface BulkConfirmModalProps {
  isOpen: boolean
  eligibleCount: number
  needsReviewCount: number
  struckOutCount: number
  onConfirm: () => void
  onReviewRemaining: () => void
  onClose: () => void
}

export const BulkConfirmModal: React.FC<BulkConfirmModalProps> = ({
  isOpen,
  eligibleCount,
  needsReviewCount,
  struckOutCount,
  onConfirm,
  onReviewRemaining,
  onClose,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Confirm Ledger Entries</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {needsReviewCount > 0
              ? 'Some entries have low confidence and require human verification. Do you want to confirm only the eligible entries?'
              : 'All active ledger entries will be marked confirmed and prepared for payment reconciliation.'}
          </p>

          {/* Breakdown Stats */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Eligible for Confirmation:</span>
              <span className="font-extrabold text-emerald-700">{eligibleCount} entries</span>
            </div>

            {needsReviewCount > 0 && (
              <div className="flex items-center justify-between text-amber-800">
                <span className="flex items-center font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Needs Manual Review:
                </span>
                <span className="font-extrabold">{needsReviewCount} entries</span>
              </div>
            )}

            {struckOutCount > 0 && (
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-medium">Struck-out Entries (Skipped):</span>
                <span className="font-bold">{struckOutCount} entries</span>
              </div>
            )}
          </div>

          <div className="pt-2 space-y-2">
            <Button
              type="button"
              disabled={eligibleCount === 0}
              onClick={onConfirm}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md"
            >
              <span>Confirm {eligibleCount} Eligible Entries</span>
            </Button>

            {needsReviewCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={onReviewRemaining}
                className="w-full h-11 border-amber-300 text-amber-800 hover:bg-amber-50 rounded-xl font-bold"
              >
                <span>Filter to Review Remaining</span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full h-10 text-xs text-slate-500 rounded-xl"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
