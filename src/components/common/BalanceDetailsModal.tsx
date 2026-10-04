import React, { useState } from 'react'
import { LedgerBalanceRecord, CustomerSummaryBalance } from '@/services/balanceTrackingService'
import { ReminderCustomerItem } from '@/services/reminderService'
import { ReminderDraftModal } from '@/components/common/ReminderDraftModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  IndianRupee,
  User,
  Clock,
  ArrowRight,
  ShieldCheck,
  Receipt,
  FileSpreadsheet,
  MessageSquare,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

interface BalanceDetailsModalProps {
  isOpen: boolean
  record: LedgerBalanceRecord | CustomerSummaryBalance | null
  isCustomerSummary?: boolean
  shopName?: string
  userId?: string
  onClose: () => void
}

export const BalanceDetailsModal: React.FC<BalanceDetailsModalProps> = ({
  isOpen,
  record,
  isCustomerSummary = false,
  shopName = 'KhataMatch Shop',
  userId = 'demo-shopkeeper-001',
  onClose,
}) => {
  const [isReminderOpen, setIsReminderOpen] = useState(false)

  if (!isOpen || !record) return null

  const isCustSummary = isCustomerSummary && 'totalOutstandingAmount' in record
  const customerName = record.customerName
  const originalAmount = isCustSummary
    ? (record as CustomerSummaryBalance).totalOriginalAmount
    : (record as LedgerBalanceRecord).originalAmount
  const paidAmount = isCustSummary
    ? (record as CustomerSummaryBalance).totalPaidAmount
    : (record as LedgerBalanceRecord).paidAmount
  const outstandingAmount = isCustSummary
    ? (record as CustomerSummaryBalance).totalOutstandingAmount
    : (record as LedgerBalanceRecord).outstandingAmount
  const status = isCustSummary
    ? (record as CustomerSummaryBalance).overallStatus
    : (record as LedgerBalanceRecord).status

  const allocatedPayments = isCustSummary
    ? (record as CustomerSummaryBalance).allocatedPayments
    : (record as LedgerBalanceRecord).allocatedMatches.map((m) => m.payment!).filter(Boolean)

  const reminderItem: ReminderCustomerItem = {
    customer_name: customerName,
    amount_due: outstandingAmount,
    original_amount: originalAmount,
    paid_amount: paidAmount,
    ledger_date: isCustSummary ? null : (record as LedgerBalanceRecord).ledgerDate,
    entries_count: isCustSummary ? (record as CustomerSummaryBalance).entriesCount : 1,
  }

  const statusBadge = () => {
    switch (status) {
      case 'fully_paid':
        return (
          <span className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Fully Paid & Settled
          </span>
        )
      case 'partially_paid':
        return (
          <span className="inline-flex items-center text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Partially Paid
          </span>
        )
      case 'overpaid':
        return (
          <span className="inline-flex items-center text-xs font-bold text-purple-800 bg-purple-100 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-purple-600" />
            Overpaid / Advance
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center text-xs font-bold text-red-800 bg-red-100 px-3 py-1 rounded-full">
            <AlertCircle className="w-3.5 h-3.5 mr-1 text-red-600" />
            Unpaid Due
          </span>
        )
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isCustSummary ? 'Customer Balance Summary' : 'Ledger Entry Settlement Details'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">{customerName}</p>
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
            {/* Status & Highlights */}
            <div className="flex items-center justify-between">
              {statusBadge()}
              {!isCustSummary && (record as LedgerBalanceRecord).ledgerDate && (
                <span className="text-xs text-slate-500 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  Ledger Date: {formatDate((record as LedgerBalanceRecord).ledgerDate)}
                </span>
              )}
            </div>

            {/* Financial Breakdown Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Original Due</p>
                <p className="text-sm font-extrabold text-slate-900 mt-1">{formatINR(originalAmount)}</p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-center">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Confirmed Paid</p>
                <p className="text-sm font-black text-emerald-800 mt-1">{formatINR(paidAmount)}</p>
              </div>

              <div className={`p-3 rounded-2xl border text-center ${
                outstandingAmount > 0
                  ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-emerald-50/30 border-emerald-100'
              }`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  outstandingAmount > 0 ? 'text-amber-800' : 'text-emerald-700'
                }`}>
                  Remaining Due
                </p>
                <p className={`text-sm font-black mt-1 ${
                  outstandingAmount > 0 ? 'text-amber-900' : 'text-emerald-800'
                }`}>
                  {formatINR(outstandingAmount)}
                </p>
              </div>
            </div>

            {/* Allocated Confirmed Payments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  <span>Confirmed Payment Allocations ({allocatedPayments.length})</span>
                </h3>
              </div>

              {allocatedPayments.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center">
                  <p className="text-xs font-medium text-slate-500">No confirmed payments allocated yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Confirm matching UPI payments in the Matches tab to settle this balance.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {allocatedPayments.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-3 rounded-xl border border-teal-100 bg-teal-50/30 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-slate-900">{p.payer_name || 'UPI Payer'}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(p.paid_at)} {p.reference ? `• Ref: ${p.reference}` : ''}
                        </p>
                      </div>
                      <span className="font-black text-teal-800">{formatINR(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center space-x-3">
              {outstandingAmount > 0 ? (
                <Button
                  type="button"
                  onClick={() => setIsReminderOpen(true)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold h-11 rounded-xl shadow-md"
                >
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                  <span>Draft Polite WhatsApp Reminder</span>
                </Button>
              ) : (
                <div className="flex-1 p-2.5 rounded-xl bg-emerald-100/60 border border-emerald-200 text-center text-xs font-bold text-emerald-800">
                  ✓ Account Fully Settled — No Reminder Needed
                </div>
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

      {/* Embedded Reminder Draft Modal */}
      {isReminderOpen && (
        <ReminderDraftModal
          isOpen={isReminderOpen}
          customerItem={reminderItem}
          shopName={shopName}
          userId={userId}
          onClose={() => setIsReminderOpen(false)}
        />
      )}
    </>
  )
}
