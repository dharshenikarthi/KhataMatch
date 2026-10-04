import React, { useState, useEffect } from 'react'
import { ParsedTransactionRow, TransactionDirection } from '@/services/csvParserService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Save, AlertCircle, IndianRupee, Calendar, User, Tag } from 'lucide-react'

interface EditStatementRowModalProps {
  isOpen: boolean
  row: ParsedTransactionRow | null
  onClose: () => void
  onSave: (updated: {
    payerName: string
    amount: number
    date: string | null
    reference: string | null
    direction: TransactionDirection
  }) => void
}

export const EditStatementRowModal: React.FC<EditStatementRowModalProps> = ({
  isOpen,
  row,
  onClose,
  onSave,
}) => {
  const [payerName, setPayerName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [reference, setReference] = useState('')
  const [direction, setDirection] = useState<TransactionDirection>('incoming')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (row) {
      setPayerName(row.payerName || '')
      setAmount(String(row.amount || ''))
      setDate(row.date || '')
      setReference(row.reference || '')
      setDirection(row.direction || 'incoming')
      setError(null)
    }
  }, [row, isOpen])

  if (!isOpen || !row) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a valid positive number.')
      return
    }

    if (!payerName.trim() && !reference.trim()) {
      setError('Either Payer Name or Transaction Reference is required.')
      return
    }

    onSave({
      payerName: payerName.trim() || `UPI ${reference.trim()}`,
      amount: numAmount,
      date: date || null,
      reference: reference.trim() || null,
      direction,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit Statement Row #{row.rowNumber}</h2>
            <p className="text-xs text-slate-500">Correct payment details before importing</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Payer Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Payer Name / Sender</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Murugan K"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
            />
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                <span>Amount (₹) *</span>
              </label>
              <Input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Date</span>
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Reference & Direction */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>UTR / Reference ID</span>
              </label>
              <Input
                type="text"
                placeholder="UPI982347101"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Direction</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('incoming')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    direction === 'incoming'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Deposit (In)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('outgoing')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    direction === 'outgoing'
                      ? 'border-red-600 bg-red-50 text-red-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Debit (Out)
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex items-center space-x-3">
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl"
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save Row Changes
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
