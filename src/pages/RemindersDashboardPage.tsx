import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ledgerService } from '@/services/ledgerService'
import { matchService } from '@/services/matchService'
import { balanceTrackingService, CustomerSummaryBalance, LedgerBalanceRecord } from '@/services/balanceTrackingService'
import {
  reminderHistoryService,
  FollowUpSummaryMetrics,
} from '@/services/reminderHistoryService'
import { reminderService, ReminderCustomerItem } from '@/services/reminderService'
import { ReminderHistoryItem, ReminderHistoryStatus, FollowUpStatus, ReminderStyle, Language } from '@/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EditReminderModal } from '@/components/common/EditReminderModal'
import { ReminderDraftModal } from '@/components/common/ReminderDraftModal'
import {
  BellRing,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Search,
  RotateCcw,
  Copy,
  Check,
  Send,
  Loader2,
  MessageSquare,
  Sparkles,
  Phone,
  Receipt,
  FileText,
  AlertCircle,
  Archive,
  Trash2,
  Edit3,
  ExternalLink,
  ShieldCheck,
  Plus,
  ArrowUpDown,
  Filter,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

type HistoryFilterTab =
  | 'all'
  | 'due_today'
  | 'overdue'
  | 'follow_up'
  | 'draft'
  | 'copied'
  | 'opened_in_whatsapp'
  | 'archived'

export const RemindersDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const userId = user?.id || 'demo-shopkeeper-001'

  // Data States
  const [historyItems, setHistoryItems] = useState<ReminderHistoryItem[]>([])
  const [customerBalances, setCustomerBalances] = useState<CustomerSummaryBalance[]>([])
  const [loading, setLoading] = useState(true)

  // Filters, Search & Sorting
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilterTab, setActiveFilterTab] = useState<HistoryFilterTab>('all')
  const [selectedStyle, setSelectedStyle] = useState<string>('all')
  const [sortField, setSortField] = useState<'created_at' | 'follow_up' | 'amount' | 'customer'>('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  // Modals
  const [editItem, setEditItem] = useState<ReminderHistoryItem | null>(null)
  const [draftTarget, setDraftTarget] = useState<ReminderCustomerItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (text: string) => {
    setToastMessage(text)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Load Data: Reminder History + Live Balances
  const loadData = async () => {
    setLoading(true)
    try {
      const [historyRes, ledgerRes, matchesRes] = await Promise.all([
        reminderHistoryService.getReminderHistory(userId),
        ledgerService.getEntries(userId),
        matchService.getMatches(userId),
      ])

      const balances = balanceTrackingService.calculateLedgerBalances(
        ledgerRes.data || [],
        matchesRes.data || []
      )
      const custSummary = balanceTrackingService.aggregateCustomerBalances(balances)
      setCustomerBalances(custSummary)

      const enriched = reminderHistoryService.enrichWithLiveBalances(
        historyRes.data || [],
        custSummary
      )
      setHistoryItems(enriched)
    } catch (err) {
      console.error('Failed to load reminder dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userId])

  // Metrics
  const metrics: FollowUpSummaryMetrics = useMemo(() => {
    return reminderHistoryService.computeFollowUpMetrics(historyItems)
  }, [historyItems])

  // Copy Message Handler
  const handleCopyMessage = async (item: ReminderHistoryItem) => {
    try {
      await navigator.clipboard.writeText(item.message)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 2500)

      if (item.status === 'draft') {
        await reminderHistoryService.updateReminderHistory(userId, item.id, { status: 'copied' })
        setHistoryItems((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, status: 'copied' } : r))
        )
      }
      showToast(`Copied reminder for ${item.customer_name}`)
    } catch {
      // Fallback
    }
  }

  // Open WhatsApp Handler
  const handleOpenWhatsApp = async (item: ReminderHistoryItem) => {
    const url = reminderService.buildWhatsAppClickUrl(item.phone, item.message)
    window.open(url, '_blank', 'noopener,noreferrer')

    if (item.status !== 'archived') {
      await reminderHistoryService.updateReminderHistory(userId, item.id, {
        status: 'opened_in_whatsapp',
      })
      setHistoryItems((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, status: 'opened_in_whatsapp' } : r))
      )
    }
  }

  // Quick Action: Regenerate draft with updated live balance
  const handleRegenerateWithLiveBalance = (item: ReminderHistoryItem) => {
    setDraftTarget({
      customer_name: item.customer_name,
      amount_due: item.currentOutstandingAmount || item.amount_due,
      phone: item.phone,
    })
  }

  // Filtered & Sorted History
  const filteredItems = useMemo(() => {
    return historyItems
      .filter((item) => {
        const q = searchQuery.toLowerCase()
        const matchesQuery =
          item.customer_name.toLowerCase().includes(q) ||
          item.message.toLowerCase().includes(q) ||
          (item.phone && item.phone.includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q))

        if (!matchesQuery) return false

        // Tab filter
        if (activeFilterTab === 'due_today') return item.followUpStatus === 'due_today'
        if (activeFilterTab === 'overdue') return item.followUpStatus === 'overdue'
        if (activeFilterTab === 'follow_up') return item.status === 'follow_up' || item.next_follow_up_at
        if (activeFilterTab === 'draft') return item.status === 'draft'
        if (activeFilterTab === 'copied') return item.status === 'copied'
        if (activeFilterTab === 'opened_in_whatsapp') return item.status === 'opened_in_whatsapp'
        if (activeFilterTab === 'archived') return item.status === 'archived'
        if (activeFilterTab === 'all') return item.status !== 'archived' // Default excludes archived

        return true
      })
      .filter((item) => {
        if (selectedStyle !== 'all') {
          return item.style === selectedStyle
        }
        return true
      })
      .sort((a, b) => {
        if (sortField === 'created_at') {
          return sortAsc
            ? a.created_at.localeCompare(b.created_at)
            : b.created_at.localeCompare(a.created_at)
        }
        if (sortField === 'follow_up') {
          const dateA = a.next_follow_up_at || '9999-99-99'
          const dateB = b.next_follow_up_at || '9999-99-99'
          return sortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
        }
        if (sortField === 'amount') {
          return sortAsc ? a.amount_due - b.amount_due : b.amount_due - a.amount_due
        }
        if (sortField === 'customer') {
          return sortAsc
            ? a.customer_name.localeCompare(b.customer_name)
            : b.customer_name.localeCompare(a.customer_name)
        }
        return 0
      })
  }, [historyItems, searchQuery, activeFilterTab, selectedStyle, sortField, sortAsc])

  // Attention Items: Follow-ups due today or overdue
  const attentionFollowUps = useMemo(() => {
    return historyItems.filter(
      (item) =>
        item.status !== 'archived' &&
        (item.followUpStatus === 'due_today' || item.followUpStatus === 'overdue')
    )
  }, [historyItems])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              to="/matches"
              className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-emerald-700"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Step 3: Matches & Balances</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Reminders & Follow-up Hub
          </h1>
          <p className="text-sm text-slate-500">
            Track saved reminder drafts, organize customer follow-ups, and manage WhatsApp communications.
          </p>
        </div>

        {/* Action Header Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="text-xs font-bold rounded-xl border-slate-300 text-slate-700 bg-white"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Hub</span>
          </Button>

          <Button
            onClick={() => navigate('/matches')}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl shadow-md h-10 px-4"
          >
            <Receipt className="w-4 h-4 mr-1.5 text-emerald-400" />
            <span>View Outstanding Balances</span>
          </Button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2.5 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card
          onClick={() => setActiveFilterTab('due_today')}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition-all ${
            activeFilterTab === 'due_today'
              ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/50'
              : 'border-amber-200 bg-amber-50/30 hover:bg-amber-50/60'
          }`}
        >
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center">
            <BellRing className="w-3 h-3 mr-1 text-amber-600" />
            Due Today
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-900">{metrics.dueTodayCount}</span>
            <span className="text-xs font-bold text-amber-700">Follow-ups</span>
          </div>
        </Card>

        <Card
          onClick={() => setActiveFilterTab('overdue')}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition-all ${
            activeFilterTab === 'overdue'
              ? 'border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/50'
              : 'border-rose-200 bg-rose-50/30 hover:bg-rose-50/60'
          }`}
        >
          <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
            Overdue
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-rose-900">{metrics.overdueCount}</span>
            <span className="text-xs font-bold text-rose-700">Action needed</span>
          </div>
        </Card>

        <Card
          onClick={() => setActiveFilterTab('follow_up')}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition-all ${
            activeFilterTab === 'follow_up'
              ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/50'
              : 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60'
          }`}
        >
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center">
            <Calendar className="w-3 h-3 mr-1 text-emerald-600" />
            Upcoming
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-900">{metrics.upcomingCount}</span>
            <span className="text-xs font-bold text-emerald-700">Scheduled</span>
          </div>
        </Card>

        <Card
          onClick={() => setActiveFilterTab('all')}
          className="cursor-pointer rounded-2xl border border-slate-200 p-4 shadow-sm bg-white hover:bg-slate-50"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Queue</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{metrics.totalActiveDrafts}</span>
            <span className="text-xs font-bold text-slate-500">Drafts & Logs</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total in Queue</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-800">{formatINR(metrics.totalOutstandingInQueue)}</span>
            <span className="text-xs text-slate-500">{metrics.unscheduledCount} unscheduled</span>
          </div>
        </Card>
      </div>

      {/* Immediate Attention Banner: Follow-ups Due Today or Overdue */}
      {attentionFollowUps.length > 0 && activeFilterTab === 'all' && (
        <Card className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50/60 to-orange-50/40 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <BellRing className="w-4 h-4 text-amber-700 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Follow-ups Requiring Attention ({attentionFollowUps.length})
                </h3>
                <p className="text-xs text-slate-600">
                  Customers with follow-up dates scheduled for today or past due.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {attentionFollowUps.map((item) => {
              const isOverdue = item.followUpStatus === 'overdue'
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border bg-white space-y-2 shadow-xs ${
                    isOverdue ? 'border-rose-200' : 'border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900">{item.customer_name}</span>
                    <span className="text-xs font-black text-rose-800">{formatINR(item.amount_due)}</span>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                    "{item.message}"
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span
                      className={`font-bold px-2 py-0.5 rounded-md ${
                        isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isOverdue ? '⚠️ Overdue' : '🔔 Due Today'}: {formatDate(item.next_follow_up_at)}
                    </span>

                    <div className="flex items-center space-x-1.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleOpenWhatsApp(item)}
                        className="h-7 px-2 text-[11px] font-bold rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        <span>WhatsApp</span>
                      </Button>
                      <button
                        type="button"
                        onClick={() => setEditItem(item)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200"
                        title="Edit / Reschedule"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Main Reminder History Workspace */}
      <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        {/* Search, Filter & Sorting Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <Input
                type="text"
                placeholder="Search history by customer name, message text, phone or shop notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-xs rounded-xl bg-white"
              />
            </div>

            {/* Style Filter */}
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500 font-medium">Style:</span>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">All Styles</option>
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="gentle">Gentle</option>
                <option value="short">Short WhatsApp</option>
              </select>
            </div>

            {/* Sorting Controls */}
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500 font-medium">Sort:</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="created_at">Created Date</option>
                <option value="follow_up">Follow-up Date</option>
                <option value="amount">Amount</option>
                <option value="customer">Customer Name</option>
              </select>
              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-1"
              >
                {sortAsc ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { id: 'all', label: 'All Active', count: metrics.totalActiveDrafts },
              { id: 'due_today', label: '🔔 Due Today', count: metrics.dueTodayCount },
              { id: 'overdue', label: '⚠️ Overdue', count: metrics.overdueCount },
              { id: 'follow_up', label: 'Follow-ups Scheduled', count: metrics.upcomingCount + metrics.dueTodayCount + metrics.overdueCount },
              { id: 'draft', label: 'Drafts', count: historyItems.filter((i) => i.status === 'draft').length },
              { id: 'copied', label: 'Copied', count: historyItems.filter((i) => i.status === 'copied').length },
              { id: 'opened_in_whatsapp', label: 'WhatsApp Opened', count: historyItems.filter((i) => i.status === 'opened_in_whatsapp').length },
              { id: 'archived', label: 'Archived', count: historyItems.filter((i) => i.status === 'archived').length },
            ].map((tab) => {
              const isSelected = activeFilterTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilterTab(tab.id as HistoryFilterTab)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="ml-1.5 opacity-75 text-[10px]">({tab.count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* History Records List */}
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
              <p className="text-xs font-semibold">Loading reminder history and follow-ups...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
              <div>
                <p className="text-sm font-bold text-slate-700">No reminder records found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate reminder drafts in the Matches & Outstanding Balances tab.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/matches')}
                className="rounded-xl text-xs font-bold text-emerald-700 border-emerald-200 bg-emerald-50/40"
              >
                Go to Step 3: Matches & Balances
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isArchived = item.status === 'archived'
                const isDueToday = item.followUpStatus === 'due_today'
                const isOverdue = item.followUpStatus === 'overdue'
                const isSettled = item.currentOutstandingAmount === 0

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                      isArchived
                        ? 'bg-slate-50/50 opacity-60'
                        : isOverdue
                        ? 'bg-rose-50/20'
                        : isDueToday
                        ? 'bg-amber-50/25'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Left: Customer, Badges & Message Preview */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {item.customer_name}
                        </span>

                        {/* Style Badge */}
                        <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full capitalize">
                          {item.style}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'opened_in_whatsapp'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'copied'
                              ? 'bg-teal-100 text-teal-800'
                              : item.status === 'follow_up'
                              ? 'bg-amber-100 text-amber-800'
                              : item.status === 'archived'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.status === 'opened_in_whatsapp'
                            ? '✓ WhatsApp Opened'
                            : item.status === 'copied'
                            ? '📋 Copied'
                            : item.status === 'follow_up'
                            ? '🔔 Follow-up'
                            : item.status === 'archived'
                            ? 'Archived'
                            : 'Draft'}
                        </span>

                        {/* Follow-up Date Badge */}
                        {item.next_follow_up_at && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center ${
                              isOverdue
                                ? 'bg-rose-100 text-rose-800'
                                : isDueToday
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            <span>
                              {isOverdue ? 'Overdue: ' : isDueToday ? 'Due Today: ' : 'Follow-up: '}
                              {formatDate(item.next_follow_up_at)}
                            </span>
                          </span>
                        )}

                        <span className="text-[10px] text-slate-400">
                          Created {formatDate(item.created_at)}
                        </span>
                      </div>

                      {/* Message Preview Text */}
                      <p className="text-xs text-slate-700 font-medium bg-slate-50 p-3 rounded-2xl border border-slate-100 leading-relaxed">
                        "{item.message}"
                      </p>

                      {/* Outdated Balance or Notes Notice */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px]">
                        {item.isBalanceOutdated && !isSettled && (
                          <div className="flex items-center space-x-1.5 text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200/60">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>
                              Balance changed: Saved as {formatINR(item.amount_due)}, current balance is{' '}
                              <strong>{formatINR(item.currentOutstandingAmount)}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRegenerateWithLiveBalance(item)}
                              className="ml-1 text-[10px] underline font-bold hover:text-amber-950"
                            >
                              Regenerate
                            </button>
                          </div>
                        )}

                        {isSettled && (
                          <span className="inline-flex items-center text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/60">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Customer has fully paid & settled account
                          </span>
                        )}

                        {item.notes && (
                          <span className="text-slate-500 font-medium italic">
                            Note: {item.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Financial Amount & Actions */}
                    <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
                      <div className="text-right mr-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Drafted Due</p>
                        <p className="text-sm font-black text-rose-900">{formatINR(item.amount_due)}</p>
                      </div>

                      {/* Copy Button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyMessage(item)}
                        className="h-8 px-2.5 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
                        title="Copy Reminder Text"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </Button>

                      {/* WhatsApp Button */}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleOpenWhatsApp(item)}
                        className="h-8 px-3 text-xs font-extrabold rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />
                        <span>WhatsApp</span>
                      </Button>

                      {/* Edit / Reschedule Modal Button */}
                      <button
                        type="button"
                        onClick={() => setEditItem(item)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
                        title="Edit Message / Schedule Follow-up"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit / Follow-up Scheduling Modal */}
      <EditReminderModal
        isOpen={Boolean(editItem)}
        reminder={editItem}
        userId={userId}
        onClose={() => setEditItem(null)}
        onUpdated={loadData}
      />

      {/* Reminder Draft / Regenerate Modal */}
      <ReminderDraftModal
        isOpen={Boolean(draftTarget)}
        customerItem={draftTarget}
        shopName={profile?.shop_name || 'KhataMatch Shop'}
        userId={userId}
        onClose={() => setDraftTarget(null)}
        onSaved={loadData}
      />
    </div>
  )
}
