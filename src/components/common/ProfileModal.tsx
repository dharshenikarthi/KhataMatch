import React, { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ledgerService } from '@/services/ledgerService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Store, Languages, Volume2, Trash2, X, Check, Loader2, AlertTriangle } from 'lucide-react'
import { Language, ReminderTone } from '@/types'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, updateProfile, signOut } = useAuth()
  const [shopName, setShopName] = useState(profile?.shop_name || '')
  const [language, setLanguage] = useState<Language>(profile?.preferred_language || 'english')
  const [tone, setTone] = useState<ReminderTone>(profile?.tone || 'polite')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const { error } = await updateProfile({
      shop_name: shopName,
      preferred_language: language,
      tone: tone,
    })

    setIsSaving(false)
    if (error) {
      setErrorMsg(error)
    } else {
      setSuccessMsg('Shop settings updated successfully!')
      setTimeout(() => setSuccessMsg(null), 3000)
    }
  }

  const handleDeleteAllData = async () => {
    if (!user?.id) return
    setIsDeleting(true)
    try {
      const { success, error } = await ledgerService.clearAllUserData(user.id)
      if (success) {
        setShowConfirmDelete(false)
        setSuccessMsg('All your ledger, payments and match records have been deleted.')
        setTimeout(() => {
          onClose()
          window.location.reload()
        }, 1500)
      } else {
        setErrorMsg(error?.message || 'Failed to clear data.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Shop Settings & Profile</h2>
              <p className="text-[11px] text-slate-500">{user?.email || 'Logged In User'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Shop Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <span>Shop / Business Name</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Murugan Provision Store"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">Included in AI generated polite reminder messages.</p>
          </div>

          {/* Preferred Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <Languages className="w-3.5 h-3.5 text-emerald-600" />
              <span>Default Reminder Language</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['english', 'tamil', 'tanglish'] as Language[]).map((lang) => (
                <button
                  type="button"
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                    language === lang
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {lang === 'tanglish' ? 'Tanglish (தமிழ்)' : lang}
                </button>
              ))}
            </div>
          </div>

          {/* Reminder Tone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Default Reminder Tone</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['polite', 'friendly', 'firm'] as ReminderTone[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTone(t)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                    tone === t
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center space-x-3">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Settings'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-xl text-slate-600"
            >
              Close
            </Button>
          </div>

          {/* Privacy & Danger Zone */}
          <div className="pt-4 border-t border-slate-100">
            {!showConfirmDelete ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700">Delete All My Data</p>
                  <p className="text-[11px] text-slate-400">Permanently wipes all your ledger and matches.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 text-xs font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete Data
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <p className="text-xs font-bold text-red-800">Are you sure you want to delete all your data?</p>
                <p className="text-[11px] text-red-700">This action cannot be undone.</p>
                <div className="flex items-center space-x-2 pt-1">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isDeleting}
                    onClick={handleDeleteAllData}
                    className="text-xs font-bold"
                  >
                    {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, Delete Everything'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirmDelete(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
