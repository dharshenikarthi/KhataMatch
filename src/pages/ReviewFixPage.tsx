import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useWorkflowState } from '@/hooks/useWorkflowState'
import { ledgerReviewService } from '@/services/ledgerReviewService'
import { LedgerEntry } from '@/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EditEntryModal } from '@/components/common/EditEntryModal'
import { ImageLightboxModal } from '@/components/common/ImageLightboxModal'
import { BulkConfirmModal } from '@/components/common/BulkConfirmModal'
import { StatementReviewPanel } from '@/components/common/StatementReviewPanel'
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Edit2,
  RotateCcw,
  Search,
  Filter,
  CheckCheck,
  FileCheck,
  HelpCircle,
  Loader2,
  Unlock,
  Check,
  FileSpreadsheet,
  BookOpen,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

type FilterType = 'all' | 'needs_review' | 'high_confidence' | 'confirmed' | 'pending'
type ReviewViewTab = 'ledger' | 'statement'

export const ReviewFixPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { state, setExtractedData } = useWorkflowState()

  const [activeTab, setActiveTab] = useState<ReviewViewTab>('ledger')
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  // Modals state
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Feedback notifications
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null)

  const showFeedback = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setFeedbackMsg({ text, type })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  const userId = user?.id || 'demo-shopkeeper-001'

  // Load entries and image from database/storage
  const loadEntriesAndImage = async () => {
    setLoading(true)
    try {
      const { data } = await ledgerReviewService.getLedgerEntries(userId)
      if (data && data.length > 0) {
        setEntries(data)
        setExtractedData(data)
      } else if (state.extractedEntries && state.extractedEntries.length > 0) {
        setEntries(state.extractedEntries)
      }

      // Load signed URL for original image
      const imgPath = state.ledger?.storagePath || state.ledger?.previewUrl || '/sample-data/sample-ledger.svg'
      const { url } = await ledgerReviewService.getSignedImageUrl(imgPath)
      setSignedImageUrl(url || state.ledger?.previewUrl || '/sample-data/sample-ledger.svg')
    } catch (err) {
      console.error('Failed to load review data:', err)
      showFeedback('Unable to load extracted entries. Please refresh.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntriesAndImage()
  }, [userId])

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75))
  const handleZoomReset = () => setZoomLevel(1)

  // --- INDIVIDUAL ACTIONS ---
  const handleSaveEdit = async (updated: {
    customer_name: string
    amount: number
    entry_date: string | null
    type: 'credit' | 'payment'
    status: 'active' | 'struck_out'
    note?: string | null
  }): Promise<boolean> => {
    if (!editingEntry) return false

    const { data, error } = await ledgerReviewService.updateLedgerEntry(userId, editingEntry.id, updated)
    if (error || !data) {
      showFeedback(error?.message || 'Failed to save changes.', 'error')
      return false
    }

    setEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)))
    showFeedback('Entry updated successfully. You can now confirm it.')
    return true
  }

  const handleConfirmSingle = async (entry: LedgerEntry) => {
    if (entry.status === 'struck_out') {
      showFeedback('Cannot confirm a struck-out entry.', 'warning')
      return
    }

    setConfirmingId(entry.id)
    try {
      const { data, error } = await ledgerReviewService.confirmLedgerEntry(userId, entry.id)
      if (error || !data) {
        showFeedback(error?.message || 'Unable to confirm entry.', 'error')
      } else {
        setEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)))
        showFeedback(`✓ Confirmed ${data.customer_name} (${formatINR(data.amount)})`)
      }
    } finally {
      setConfirmingId(null)
    }
  }

  const handleReopenSingle = async (entry: LedgerEntry) => {
    const { data, error } = await ledgerReviewService.reopenLedgerEntry(userId, entry.id)
    if (error || !data) {
      showFeedback('Unable to reopen entry.', 'error')
    } else {
      setEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)))
      showFeedback(`Reopened ${data.customer_name} for editing.`, 'warning')
    }
  }

  // --- BULK CONFIRMATION ---
  const eligibleEntries = useMemo(
    () => entries.filter((e) => !e.confirmed && e.status !== 'struck_out' && e.confidence >= 0.75),
    [entries]
  )
  const needsReviewEntries = useMemo(
    () => entries.filter((e) => !e.confirmed && e.status !== 'struck_out' && e.confidence < 0.75),
    [entries]
  )
  const struckOutEntries = useMemo(
    () => entries.filter((e) => e.status === 'struck_out'),
    [entries]
  )

  const handleBulkConfirmExecution = async () => {
    setIsBulkModalOpen(false)
    const eligibleIds = eligibleEntries.map((e) => e.id)
    if (eligibleIds.length === 0) return

    setLoading(true)
    try {
      const { confirmedCount, failedCount, error } = await ledgerReviewService.confirmEligibleEntries(
        userId,
        eligibleIds
      )

      if (error) {
        showFeedback('Bulk confirmation encountered an error.', 'error')
      } else {
        await loadEntriesAndImage()
        showFeedback(`Successfully confirmed ${confirmedCount} entries.${failedCount > 0 ? ` (${failedCount} failed)` : ''}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // --- METRICS & COUNTS ---
  const stats = useMemo(() => {
    const total = entries.length
    const highConf = entries.filter((e) => e.confidence >= 0.90).length
    const goodConf = entries.filter((e) => e.confidence >= 0.75 && e.confidence < 0.90).length
    const needsReview = entries.filter((e) => e.confidence < 0.75 || (!e.confirmed && e.status !== 'struck_out' && e.confidence < 0.75)).length
    const confirmed = entries.filter((e) => e.confirmed).length
    const totalAmount = entries
      .filter((e) => e.status !== 'struck_out')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

    return { total, highConf, goodConf, needsReview, confirmed, totalAmount }
  }, [entries])

  // --- FILTERED ENTRIES ---
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        entry.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.name_normalized.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(entry.amount).includes(searchQuery)

      if (!matchesSearch) return false

      if (activeFilter === 'needs_review') return entry.confidence < 0.75 || !entry.confirmed
      if (activeFilter === 'high_confidence') return entry.confidence >= 0.75
      if (activeFilter === 'confirmed') return entry.confirmed
      if (activeFilter === 'pending') return !entry.confirmed && entry.status !== 'struck_out'

      return true
    })
  }, [entries, searchQuery, activeFilter])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link to="/" className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-emerald-700">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Upload</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Review & Fix
          </h1>
          <p className="text-sm text-slate-500">
            Check ledger entries and verify bank statements before reconciling payments.
          </p>
        </div>

        {/* Global Action Header */}
        <div className="flex items-center space-x-3">
          {activeTab === 'ledger' && (
            <Button
              type="button"
              variant="outline"
              disabled={eligibleEntries.length === 0}
              onClick={() => setIsBulkModalOpen(true)}
              className="text-xs font-bold rounded-xl border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50"
            >
              <CheckCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
              <span>Confirm All Valid ({eligibleEntries.length})</span>
            </Button>
          )}

          <Button
            onClick={() => navigate('/matches')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md h-10 px-4"
          >
            <span>Proceed to Step 3: Matches</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* Main Review View Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center space-x-2 pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'ledger'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>1. Handwritten Ledger Entries ({entries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('statement')}
          className={`flex items-center space-x-2 pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'statement'
              ? 'border-teal-600 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-teal-600" />
          <span>2. Bank / UPI Statement CSV</span>
        </button>
      </div>

      {/* Tab 1: Ledger Review View */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Feedback Toast Banner */}
          {feedbackMsg && (
            <div
              className={`p-4 rounded-2xl flex items-center space-x-3 text-xs font-semibold animate-in fade-in ${
                feedbackMsg.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : feedbackMsg.type === 'warning'
                  ? 'bg-amber-50 border border-amber-200 text-amber-800'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}
            >
              {feedbackMsg.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Dynamic Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border border-slate-200 p-4 shadow-sm bg-white">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Entries</p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                <span className="text-xs font-bold text-slate-500">{formatINR(stats.totalAmount)}</span>
              </div>
            </Card>

            <Card className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                High Confidence
              </p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-900">{stats.highConf + stats.goodConf}</span>
                <span className="text-xs text-emerald-700 font-medium">≥ 75% Score</span>
              </div>
            </Card>

            <Card className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 shadow-sm">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>
                Needs Review
              </p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-amber-900">{stats.needsReview}</span>
                <span className="text-xs text-amber-700 font-medium">&lt; 75% Score</span>
              </div>
            </Card>

            <Card className="rounded-2xl border border-slate-200 p-4 shadow-sm bg-white">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Confirmed
              </p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-700">{stats.confirmed}</span>
                <span className="text-xs text-slate-400 font-medium">of {stats.total} total</span>
              </div>
            </Card>
          </div>

          {/* Split-Screen Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Original Ledger Image */}
            <div className="lg:col-span-5 space-y-3">
              <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden sticky top-20">
                <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/70 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>Original Ledger Image</span>
                  </CardTitle>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      title="Zoom Out"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleZoomReset}
                      title="Reset Zoom"
                      className="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-200 bg-white text-slate-600"
                    >
                      {Math.round(zoomLevel * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      title="Zoom In"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      title="Full Screen Preview"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 ml-1"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 bg-slate-950/5 min-h-[380px] max-h-[580px] overflow-auto flex items-center justify-center">
                  {signedImageUrl ? (
                    <div
                      className="transition-transform duration-150 ease-out origin-top-left"
                      style={{ transform: `scale(${zoomLevel})` }}
                    >
                      <img
                        src={signedImageUrl}
                        alt="Original Handwritten Ledger Preview"
                        className="max-w-full rounded-lg shadow-md border border-slate-200 bg-white cursor-zoom-in"
                        onClick={() => setIsLightboxOpen(true)}
                      />
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 p-8 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                      <p className="text-xs">Loading secure ledger preview...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Extracted Ledger Entries Table */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <Input
                        type="text"
                        placeholder="Search by customer name or amount..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 text-xs rounded-xl bg-white"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {[
                        { id: 'all', label: 'All', count: entries.length },
                        { id: 'needs_review', label: 'Needs Review', count: stats.needsReview },
                        { id: 'confirmed', label: 'Confirmed', count: stats.confirmed },
                        { id: 'pending', label: 'Pending', count: entries.length - stats.confirmed },
                      ].map((tab) => {
                        const isSelected = activeFilter === tab.id
                        return (
                          <button
                            type="button"
                            key={tab.id}
                            onClick={() => setActiveFilter(tab.id as FilterType)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200/80'
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span className="ml-1.5 opacity-80 text-[10px]">({tab.count})</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-100/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-3">Amount</th>
                          <th className="py-3 px-3 hidden sm:table-cell">Date</th>
                          <th className="py-3 px-3">Confidence</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                              <p className="text-xs font-semibold">Loading ledger entries...</p>
                            </td>
                          </tr>
                        ) : filteredEntries.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400">
                              <p className="text-sm font-semibold">No entries match the current filter.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredEntries.map((entry) => {
                            const isHigh = entry.confidence >= 0.90
                            const isGood = entry.confidence >= 0.75 && entry.confidence < 0.90
                            const isLow = entry.confidence < 0.75
                            const isStruckOut = entry.status === 'struck_out'
                            const isConfirmed = entry.confirmed

                            return (
                              <tr
                                key={entry.id}
                                className={`transition-colors ${
                                  isConfirmed
                                    ? 'bg-emerald-50/20 text-slate-900'
                                    : isStruckOut
                                    ? 'bg-slate-50/70 text-slate-400 line-through'
                                    : isLow
                                    ? 'bg-amber-50/60 hover:bg-amber-50 text-slate-900'
                                    : 'hover:bg-slate-50/80 text-slate-900'
                                }`}
                              >
                                <td className="py-3.5 px-4 font-semibold">
                                  <div className="flex flex-col">
                                    <span>{entry.customer_name}</span>
                                    {entry.note && (
                                      <span className="text-[10px] text-slate-400 font-normal no-underline">
                                        {entry.note}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-3.5 px-3 font-bold text-slate-900">
                                  {formatINR(entry.amount)}
                                </td>

                                <td className="py-3.5 px-3 text-xs text-slate-500 hidden sm:table-cell">
                                  {formatDate(entry.entry_date)}
                                </td>

                                <td className="py-3.5 px-3">
                                  {isHigh ? (
                                    <Badge variant="success" className="font-bold text-[10px]">
                                      {Math.round(entry.confidence * 100)}% High
                                    </Badge>
                                  ) : isGood ? (
                                    <Badge variant="info" className="font-bold text-[10px]">
                                      {Math.round(entry.confidence * 100)}% Good
                                    </Badge>
                                  ) : (
                                    <Badge variant="warning" className="font-bold text-[10px] flex items-center w-fit">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      <span>{Math.round(entry.confidence * 100)}% Review</span>
                                    </Badge>
                                  )}
                                </td>

                                <td className="py-3.5 px-3">
                                  {isConfirmed ? (
                                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                      Confirmed
                                    </span>
                                  ) : isStruckOut ? (
                                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded-md">
                                      Struck Out
                                    </span>
                                  ) : (
                                    <span className="text-xs font-medium text-slate-400">
                                      Unconfirmed
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    {!isConfirmed ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setEditingEntry(entry)}
                                          title="Edit Entry"
                                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs transition-colors"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>

                                        <Button
                                          size="sm"
                                          disabled={isStruckOut || confirmingId === entry.id}
                                          onClick={() => handleConfirmSingle(entry)}
                                          className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
                                        >
                                          {confirmingId === entry.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <span className="flex items-center">
                                              <Check className="w-3 h-3 mr-1" />
                                              Confirm
                                            </span>
                                          )}
                                        </Button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleReopenSingle(entry)}
                                        title="Reopen Confirmed Entry"
                                        className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-900 border border-transparent hover:border-slate-200"
                                      >
                                        <Unlock className="w-3 h-3" />
                                        <span className="text-[10px]">Reopen</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Bank Statement CSV Review & Import */}
      {activeTab === 'statement' && (
        <StatementReviewPanel onImportComplete={() => showFeedback('Statement payments imported successfully!')} />
      )}

      {/* Edit Entry Modal */}
      <EditEntryModal
        isOpen={Boolean(editingEntry)}
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={handleSaveEdit}
      />

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        imageUrl={signedImageUrl}
        onClose={() => setIsLightboxOpen(false)}
      />

      {/* Bulk Confirm Modal */}
      <BulkConfirmModal
        isOpen={isBulkModalOpen}
        eligibleCount={eligibleEntries.length}
        needsReviewCount={needsReviewEntries.length}
        struckOutCount={struckOutEntries.length}
        onConfirm={handleBulkConfirmExecution}
        onReviewRemaining={() => {
          setIsBulkModalOpen(false)
          setActiveFilter('needs_review')
        }}
        onClose={() => setIsBulkModalOpen(false)}
      />
    </div>
  )
}
