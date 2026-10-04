import React from 'react'
import { PaymentMatch } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  CheckCircle2,
  GitMerge,
  Calendar,
  IndianRupee,
  User,
  Clock,
  ShieldCheck,
  Check,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

interface MatchDetailsModalProps {
  isOpen: boolean
  match: PaymentMatch | null
  onConfirm: () => void
  onReject: () => void
  onClose: () => void
}

export const MatchDetailsModal: React.FC<MatchDetailsModalProps> = ({
  isOpen,
  match,
  onConfirm,
  onReject,
  onClose,
}) => {
  if (!isOpen || !match) return null

  const isConfirmed = match.user_confirmed
  const isRejected = match.status === 'rejected'
  const isUnmatched = match.match_type === 'unmatched' || !match.ledger_entry
  const isAiAssisted = match.match_type === 'fuzzy' || match.reason.includes('AI') || match.reason.includes('Gemini')

  // Determine matching method string
  const getMatchingMethod = () => {
    if (isAiAssisted) return 'AI-Assisted (Google Gemini)'
    if (match.rule) return `Deterministic (${match.rule.replace(/_/g, ' ')})`
    if (match.match_type === 'exact') return 'Deterministic (Exact Match)'
    return 'Manual / Rule-based'
  }

  // Determine Match Status
  const getMatchStatusBadge = () => {
    if (isConfirmed) {
      return (
        <span className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
          Confirmed Match
        </span>
      )
    }
    if (isRejected) {
      return (
        <span className="inline-flex items-center text-xs font-bold text-slate-700 bg-slate-200 px-3 py-1 rounded-full">
          <X className="w-3.5 h-3.5 mr-1 text-slate-500" />
          Rejected Suggestion
        </span>
      )
    }
    if (isUnmatched) {
      return (
        <span className="inline-flex items-center text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
          Unmatched Payment
        </span>
      )
    }
    return (
      <span className="inline-flex items-center text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
        <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
        Pending Human Review
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              {isAiAssisted ? <Sparkles className="w-4 h-4 text-purple-600" /> : <GitMerge className="w-4 h-4 text-emerald-600" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Match Details & Evidence
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {getMatchingMethod()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status & Method Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {getMatchStatusBadge()}
            <Badge
              variant={match.confidence >= 0.75 ? 'success' : match.confidence > 0 ? 'warning' : 'outline'}
              className="font-bold text-xs"
            >
              {Math.round(match.confidence * 100)}% Confidence Score
            </Badge>
          </div>

          {/* Side-by-Side Comparison Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Bank Payment Card */}
            <div className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/40 space-y-2">
              <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
                Bank / UPI Payment
              </p>
              <div>
                <p className="text-xs font-extrabold text-slate-900 truncate">
                  {match.payment?.payer_name || 'Unknown'}
                </p>
                <p className="text-sm font-black text-teal-900 mt-0.5">
                  {formatINR(match.payment?.amount)}
                </p>
              </div>
              <div className="text-[10px] text-slate-500 space-y-0.5 pt-1 border-t border-teal-200/60">
                <p className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1 text-teal-600" />
                  Payment Date: {formatDate(match.payment?.paid_at)}
                </p>
                {match.payment?.reference && (
                  <p className="font-mono truncate" title={match.payment.reference}>
                    Ref: {match.payment.reference}
                  </p>
                )}
              </div>
            </div>

            {/* Ledger Due Card */}
            <div className={`p-3.5 rounded-2xl border space-y-2 ${
              match.ledger_entry
                ? 'border-emerald-200 bg-emerald-50/40'
                : 'border-slate-200 bg-slate-50/40'
            }`}>
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Ledger Credit Due
              </p>
              {match.ledger_entry ? (
                <>
                  <div>
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      {match.ledger_entry.customer_name}
                    </p>
                    <p className="text-sm font-black text-emerald-900 mt-0.5">
                      {formatINR(match.ledger_entry.amount)}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-0.5 pt-1 border-t border-emerald-200/60">
                    <p className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1 text-emerald-600" />
                      Ledger Date: {formatDate(match.ledger_entry.entry_date)}
                    </p>
                    <p className="text-emerald-700 font-medium capitalize">
                      Type: {match.ledger_entry.type} Credit
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-3 text-center text-slate-400">
                  <p className="text-xs font-semibold">No Ledger Entry Matched</p>
                  <p className="text-[10px] mt-0.5">Standalone payment</p>
                </div>
              )}
            </div>
          </div>

          {/* Explainable Rationale Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center">
                {isAiAssisted ? (
                  <>
                    <Sparkles className="w-4 h-4 text-purple-600 mr-1.5" />
                    <span>Gemini AI Reason</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 mr-1.5" />
                    <span>Deterministic Match Rationale</span>
                  </>
                )}
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                Method: {isAiAssisted ? 'Multimodal LLM' : 'Rule-Based'}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-200/70">
              "{match.reason}"
            </p>

            {match.date_diff_days !== null && match.date_diff_days !== undefined && (
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Date gap: <strong>{match.date_diff_days} day{match.date_diff_days === 1 ? '' : 's'}</strong> between notebook entry and bank payment.
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center space-x-3">
            {!isUnmatched && !isConfirmed && (
              <Button
                type="button"
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold h-11 rounded-xl shadow-md"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Confirm This Match
              </Button>
            )}

            {!isUnmatched && !isRejected && !isConfirmed && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onReject()
                  onClose()
                }}
                className="h-11 rounded-xl text-red-600 border-red-200 hover:bg-red-50 font-bold"
              >
                Reject Suggestion
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-xl text-slate-600"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
