import React, { useState, useEffect } from 'react'
import { ReminderHistoryItem, ReminderHistoryStatus, ReminderStyle, Language } from '@/types'
import { reminderHistoryService } from '@/services/reminderHistoryService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Calendar,
  Clock,
  Check,
  Trash2,
  Archive,
  MessageSquare,
  Sparkles,
  Phone,
  FileText,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

interface EditReminderModalProps {
  isOpen: boolean
  reminder: ReminderHistoryItem | null
  userId?: string
  onClose: () => void
  onUpdated: () => void
}

export const EditReminderModal: React.FC<EditReminderModalProps> = ({
  isOpen,
  reminder,
  userId = 'demo-shopkeeper-001',
  onClose,
  onUpdated,
}) => {
  if (!isOpen || !reminder) return null

  const [message, setMessage] = useState(reminder.message || '')
  const [phone, setPhone] = useState(reminder.phone || '')
  const [notes, setNotes] = useState(reminder.notes || '')
  const [status, setStatus] = useState<ReminderHistoryStatus>(reminder.status || 'draft')
  const [followUpDate, setFollowUpDate] = useState(
    reminder.next_follow_up_at ? reminder.next_follow_up_at.split('T')[0] : ''
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (reminder) {
      setMessage(reminder.message || '')
      setPhone(reminder.phone || '')
      setNotes(reminder.notes || '')
      setStatus(reminder.status || 'draft')
      setFollowUpDate(reminder.next_follow_up_at ? reminder.next_follow_up_at.split('T')[0] : '')
    }
  }, [reminder])

  const handleQuickFollowUp = (daysAhead: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    setFollowUpDate(d.toISOString().split('T')[0])
    if (status === 'draft') setStatus('follow_up')
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await reminderHistoryService.updateReminderHistory(userId, reminder.id, {
        message,
        phone: phone || null,
        notes,
        status,
        next_follow_up_at: followUpDate ? `${followUpDate}T00:00:00.000Z` : null,
      })
      onUpdated()
      onClose()
    } catch (err) {
      console.error('Failed to update reminder:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete reminder draft for ${reminder.customer_name}?`)) return
    setIsSaving(true)
    try {
      await reminderHistoryService.deleteReminderHistory(userId, reminder.id)
      onUpdated()
      onClose()
    } catch (err) {
      console.error('Failed to delete reminder:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchiveToggle = async () => {
    const newStatus: ReminderHistoryStatus = reminder.status === 'archived' ? 'draft' : 'archived'
    setIsSaving(true)
    try {
      await reminderHistoryService.updateReminderHistory(userId, reminder.id, {
        status: newStatus,
      })
      onUpdated()
      onClose()
    } catch (err) {
      console.error('Failed to archive reminder:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Edit Reminder & Follow-up
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Customer: <strong className="text-slate-800">{reminder.customer_name}</strong> • Amount:{' '}
                <strong className="text-rose-700">{formatINR(reminder.amount_due)}</strong>
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
        <div className="p-6 space-y-4">
          {/* Outdated Balance Notice if applicable */}
          {reminder.isBalanceOutdated && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Account Balance Has Changed</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Saved draft amount is <strong>{formatINR(reminder.amount_due)}</strong>, but the current live outstanding balance is{' '}
                  <strong>{formatINR(reminder.currentOutstandingAmount)}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Status Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Current Status
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {[
                { id: 'draft', label: 'Draft' },
                { id: 'copied', label: 'Copied' },
                { id: 'opened_in_whatsapp', label: 'WhatsApp' },
                { id: 'follow_up', label: 'Follow-up' },
                { id: 'archived', label: 'Archived' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatus(st.id as ReminderHistoryStatus)}
                  className={`py-1 px-1.5 rounded-lg text-center transition-all ${
                    status === st.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Follow-up Date Picker & Shortcuts */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Next Follow-up Date
              </label>
              <div className="flex items-center space-x-1.5 text-[10px] font-bold text-emerald-700">
                <button
                  type="button"
                  onClick={() => handleQuickFollowUp(3)}
                  className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200/60"
                >
                  +3 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFollowUp(7)}
                  className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200/60"
                >
                  +7 Days
                </button>
                {followUpDate && (
                  <button
                    type="button"
                    onClick={() => setFollowUpDate('')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => {
                  setFollowUpDate(e.target.value)
                  if (status === 'draft' && e.target.value) setStatus('follow_up')
                }}
                className="pl-8 h-9 text-xs rounded-xl bg-white"
              />
            </div>
          </div>

          {/* Message Editor */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Reminder Message Text
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Internal Shop Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Internal Shop Notes (Private)
            </label>
            <Input
              type="text"
              placeholder="e.g. Promised to clear next Tuesday after salary"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-xs rounded-xl bg-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleArchiveToggle}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200"
                title={reminder.status === 'archived' ? 'Restore from Archive' : 'Archive Reminder'}
              >
                <Archive className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200"
                title="Delete Draft"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 text-xs font-bold rounded-xl border-slate-200 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="h-10 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 shadow-sm"
              >
                <Check className="w-4 h-4 mr-1.5" />
                <span>Save Changes</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
