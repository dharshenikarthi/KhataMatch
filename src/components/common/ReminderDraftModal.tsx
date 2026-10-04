import React, { useState, useEffect } from 'react'
import { Language, ReminderStyle } from '@/types'
import { reminderService, ReminderCustomerItem, GeneratedDraftResult } from '@/services/reminderService'
import { reminderHistoryService } from '@/services/reminderHistoryService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Sparkles,
  Copy,
  Check,
  Send,
  Loader2,
  RefreshCw,
  Phone,
  MessageSquare,
  ShieldCheck,
  IndianRupee,
  Calendar,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

interface ReminderDraftModalProps {
  isOpen: boolean
  customerItem: ReminderCustomerItem | null
  shopName?: string
  userId?: string
  onClose: () => void
  onSaved?: () => void
}

export const ReminderDraftModal: React.FC<ReminderDraftModalProps> = ({
  isOpen,
  customerItem,
  shopName = 'KhataMatch Shop',
  userId = 'demo-shopkeeper-001',
  onClose,
  onSaved,
}) => {
  if (!isOpen || !customerItem) return null

  const [style, setStyle] = useState<ReminderStyle>('friendly')
  const [language, setLanguage] = useState<Language>('english')
  const [phone, setPhone] = useState(customerItem.phone || '')
  const [draftMessage, setDraftMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isAiGenerated, setIsAiGenerated] = useState(false)

  // Generate initial draft when modal opens or style/language changes
  const handleGenerateDraft = async (targetStyle = style, targetLang = language) => {
    setIsGenerating(true)
    try {
      const res = await reminderService.generateDrafts({
        items: [customerItem],
        style: targetStyle,
        language: targetLang,
        shop_name: shopName,
        userId,
      })

      if (res.data && res.data.length > 0) {
        setDraftMessage(res.data[0].message)
        setIsAiGenerated(res.isAiGenerated)
      }
    } catch (err) {
      console.error('Failed to generate reminder draft:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (isOpen && customerItem) {
      setPhone(customerItem.phone || '')
      setIsCopied(false)
      setIsSaved(false)
      handleGenerateDraft(style, language)
    }
  }, [isOpen, customerItem])

  const handleCopy = async () => {
    if (!draftMessage) return
    try {
      await navigator.clipboard.writeText(draftMessage)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2500)

      // Also record in history as copied
      await reminderHistoryService.saveReminderHistory(userId, {
        customer_name: customerItem.customer_name,
        phone: phone || null,
        amount_due: customerItem.amount_due,
        message: draftMessage,
        style,
        language,
        status: 'copied',
      })
      if (onSaved) onSaved()
    } catch {
      // Fallback
    }
  }

  const handleOpenWhatsApp = async () => {
    if (!draftMessage) return
    const url = reminderService.buildWhatsAppClickUrl(phone, draftMessage)
    window.open(url, '_blank', 'noopener,noreferrer')

    // Track WhatsApp opened status
    await reminderHistoryService.saveReminderHistory(userId, {
      customer_name: customerItem.customer_name,
      phone: phone || null,
      amount_due: customerItem.amount_due,
      message: draftMessage,
      style,
      language,
      status: 'opened_in_whatsapp',
    })
    if (onSaved) onSaved()
  }

  const handleSaveDraft = async () => {
    if (!draftMessage) return
    try {
      await reminderHistoryService.saveReminderHistory(userId, {
        customer_name: customerItem.customer_name,
        phone: phone || null,
        amount_due: customerItem.amount_due,
        message: draftMessage,
        style,
        language,
        status: 'draft',
      })
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 3000)
      if (onSaved) onSaved()
    } catch (err) {
      console.error('Failed to save reminder:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Draft Payment Reminder
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Customer: <strong className="text-slate-800">{customerItem.customer_name}</strong> • Due:{' '}
                <strong className="text-rose-700">{formatINR(customerItem.amount_due)}</strong>
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
          {/* Controls: Tone/Style & Language Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Reminder Style
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'friendly', label: 'Friendly' },
                  { id: 'professional', label: 'Professional' },
                  { id: 'gentle', label: 'Gentle' },
                  { id: 'short', label: 'Short WhatsApp' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStyle(s.id as ReminderStyle)
                      handleGenerateDraft(s.id as ReminderStyle, language)
                    }}
                    className={`py-1 px-2 text-xs font-bold rounded-lg transition-all ${
                      style === s.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Language
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'english', label: 'English' },
                  { id: 'tamil', label: 'தமிழ்' },
                  { id: 'tanglish', label: 'Tanglish' },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setLanguage(l.id as Language)
                      handleGenerateDraft(style, l.id as Language)
                    }}
                    className={`py-1 px-1.5 text-xs font-bold rounded-lg transition-all ${
                      language === l.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Phone Input */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Customer Phone Number (Optional)
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <Input
                type="tel"
                placeholder="10-digit mobile number (e.g. 9876543210)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-8 h-9 text-xs rounded-xl bg-white"
              />
            </div>
          </div>

          {/* Draft Text Preview & Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600" />
                {isAiGenerated ? 'Gemini AI Drafted Message' : 'Drafted Reminder Message'}
              </span>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => handleGenerateDraft(style, language)}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                rows={4}
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                disabled={isGenerating}
                className="w-full p-3.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none leading-relaxed"
                placeholder="Generating polite payment reminder..."
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Drafting polite reminder...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>{draftMessage.trim().split(/\s+/).filter(Boolean).length} words • Editable</span>
              <span className="text-emerald-700 font-semibold flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Human verified — Never auto-sends
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              disabled={!draftMessage || isGenerating}
              className="h-10 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  <span>Copy Text</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={!draftMessage || isGenerating}
              className="h-10 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save to Queue</span>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!draftMessage || isGenerating}
              className="h-10 text-xs font-extrabold rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white shadow-md shadow-emerald-900/10"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              <span>Open WhatsApp</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
