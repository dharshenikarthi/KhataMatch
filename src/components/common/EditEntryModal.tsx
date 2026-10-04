import React, { useState, useEffect } from 'react'
import { LedgerEntry } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Save, AlertCircle, Loader2, IndianRupee, Calendar, User, FileText } from 'lucide-react'

interface EditEntryModalProps {
  isOpen: boolean
  entry: LedgerEntry | null
  onClose: () => void
  onSave: (updated: {
    customer_name: string
    amount: number
    entry_date: string | null
    type: 'credit' | 'payment'
    status: 'active' | 'struck_out'
    note?: string | null
  }) => Promise<boolean>
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({
  isOpen,
  entry,
  onClose,
  onSave,
}) => {
  const [customerName, setCustomerName] = useState('')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [type, setType] = useState<'credit' | 'payment'>('credit')
  const [status, setStatus] = useState<'active' | 'struck_out'>('active')
  const [note, setNote] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (entry) {
      setCustomerName(entry.customer_name || '')
      setAmount(String(entry.amount ?? ''))
      setEntryDate(entry.entry_date || '')
      setType(entry.type || 'credit')
      setStatus(entry.status === 'struck_out' ? 'struck_out' : 'active')
      setNote(entry.note || '')
      setErrorMessage(null)
    }
  }, [entry, isOpen])

  if (!isOpen || !entry) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedName = customerName.trim()
    if (!trimmedName) {
      setErrorMessage('Customer name is required.')
      return
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount < 0) {
      setErrorMessage('Please enter a valid non-negative amount.')
      return
    }

    if (entryDate && isNaN(new Date(entryDate).getTime())) {
      setErrorMessage('Please enter a valid date.')
      return
    }

    setIsSaving(true)
    try {
      const success = await onSave({
        customer_name: trimmedName,
        amount: numAmount,
        entry_date: entryDate || null,
        type,
        status,
        note: note.trim() || null,
      })

      if (success) {
        onClose()
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update entry.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit Ledger Entry</h2>
            <p className="text-xs text-slate-500">Correct extracted text, amount or date</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Customer Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Customer Name *</span>
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. Murugan"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                <span>Amount (₹) *</span>
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                required
                placeholder="1250"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Entry Date</span>
              </label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
          </div>

          {/* Type & Status Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Entry Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Entry Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('credit')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    type === 'credit'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Credit (Udhaar)
                </button>
                <button
                  type="button"
                  onClick={() => setType('payment')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    type === 'payment'
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Payment
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('active')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    status === 'active'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('struck_out')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    status === 'struck_out'
                      ? 'border-red-600 bg-red-50 text-red-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Struck Out
                </button>
              </div>
            </div>
          </div>

          {/* Note / Item Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Notes / Item Description</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Rice bag, Oil tin, Provisions"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center space-x-3">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl"
            >
              {isSaving ? (
                <span className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1.5">
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
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
