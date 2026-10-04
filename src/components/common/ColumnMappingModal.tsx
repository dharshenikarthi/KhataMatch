import React, { useState } from 'react'
import { ColumnMapping } from '@/services/csvParserService'
import { Button } from '@/components/ui/button'
import { X, Check, Sliders, AlertCircle } from 'lucide-react'

interface ColumnMappingModalProps {
  isOpen: boolean
  headers: string[]
  currentMapping: ColumnMapping
  onApply: (newMapping: ColumnMapping) => void
  onClose: () => void
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  headers,
  currentMapping,
  onApply,
  onClose,
}) => {
  const [dateCol, setDateCol] = useState<string>(currentMapping.dateCol || '')
  const [payerCol, setPayerCol] = useState<string>(currentMapping.payerCol || '')
  const [amountCol, setAmountCol] = useState<string>(currentMapping.amountCol || '')
  const [debitCol, setDebitCol] = useState<string>(currentMapping.debitCol || '')
  const [refCol, setRefCol] = useState<string>(currentMapping.refCol || '')
  const [directionCol, setDirectionCol] = useState<string>(currentMapping.directionCol || '')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!amountCol) {
      setError('Please select a column for Payment Amount.')
      return
    }

    if (!payerCol && !refCol) {
      setError('Please select at least a Payer Name or Transaction Reference column.')
      return
    }

    onApply({
      dateCol: dateCol || null,
      payerCol: payerCol || null,
      amountCol: amountCol || null,
      debitCol: debitCol || null,
      refCol: refCol || null,
      directionCol: directionCol || null,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Map Statement Columns</h2>
              <p className="text-xs text-slate-500">Match your bank CSV columns to KhataMatch fields</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleApply} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount Column (Required) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Deposit / Credit Amount Column *</span>
              <span className="text-[10px] text-emerald-700 font-bold uppercase">Required</span>
            </label>
            <select
              value={amountCol}
              onChange={(e) => setAmountCol(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Select Amount Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Payer Column */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Payer Name / Description Column</label>
            <select
              value={payerCol}
              onChange={(e) => setPayerCol(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- None / Auto-generate --</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Date Column */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Transaction Date Column</label>
            <select
              value={dateCol}
              onChange={(e) => setDateCol(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- None / No Date --</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Debit/Withdrawal Column (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Debit / Withdrawal Column (Optional)</label>
            <select
              value={debitCol}
              onChange={(e) => setDebitCol(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- No Separate Debit Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">Used to automatically exclude withdrawals from incoming payments.</p>
          </div>

          {/* Reference Column */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Reference / UTR / Txn ID Column</label>
            <select
              value={refCol}
              onChange={(e) => setRefCol(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- None --</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center space-x-3">
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Apply Column Mapping
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-xl text-slate-600"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
