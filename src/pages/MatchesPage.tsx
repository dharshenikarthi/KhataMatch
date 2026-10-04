import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { matchService } from '@/services/matchService'
import { paymentService } from '@/services/paymentService'
import { ledgerService } from '@/services/ledgerService'
import { deterministicMatchService } from '@/services/deterministicMatchService'
import { aiMatchService } from '@/services/aiMatchService'
import {
  balanceTrackingService,
  LedgerBalanceRecord,
  CustomerSummaryBalance,
  OverallPortfolioSummary,
  PaymentSettlementStatus,
} from '@/services/balanceTrackingService'
import { PaymentMatch, Payment, LedgerEntry } from '@/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MatchDetailsModal } from '@/components/common/MatchDetailsModal'
import { BalanceDetailsModal } from '@/components/common/BalanceDetailsModal'
import { ReminderDraftModal } from '@/components/common/ReminderDraftModal'
import { ReminderCustomerItem } from '@/services/reminderService'
import {
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Search,
  RotateCcw,
  Check,
  X,
  Eye,
  Calendar,
  IndianRupee,
  Clock,
  Sparkles,
  ShieldCheck,
  Loader2,
  Receipt,
  Users,
  AlertCircle,
  ArrowUpDown,
  BookOpen,
  Filter,
  MessageSquare,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

type MainTab = 'matches' | 'balances'

type MatchFilterCategory =
  | 'all'
  | 'confirmed'
  | 'needs_review'
  | 'strong'
  | 'ai_matches'
  | 'rejected'
  | 'unmatched_payments'
  | 'unmatched_ledger'

type BalanceFilterCategory = 'all' | 'unpaid' | 'partially_paid' | 'fully_paid' | 'overpaid'

export const MatchesPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Navigation & Sub-views
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('matches')
  const [balanceViewMode, setBalanceViewMode] = useState<'entries' | 'customers'>('entries')

  // Raw Data State
  const [matches, setMatches] = useState<PaymentMatch[]>([])
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [unmatchedLedger, setUnmatchedLedger] = useState<LedgerEntry[]>([])
  const [unmatchedPayments, setUnmatchedPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  // Matching Configuration & Running states
  const [isRerunning, setIsRerunning] = useState(false)
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false)
  const [lastAiTime, setLastAiTime] = useState<string | null>(null)
  const [dateWindowDays, setDateWindowDays] = useState<number>(4)

  // Matches Tab Filters & Sorting
  const [matchSearchQuery, setMatchSearchQuery] = useState('')
  const [matchFilter, setMatchFilter] = useState<MatchFilterCategory>('all')
  const [matchSortField, setMatchSortField] = useState<'date' | 'amount' | 'customer' | 'status'>('status')
  const [matchSortAsc, setMatchSortAsc] = useState(false)

  // Balances Tab Filters & Sorting
  const [balanceSearchQuery, setBalanceSearchQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilterCategory>('all')
  const [balanceSortField, setBalanceSortField] = useState<'outstanding' | 'original' | 'date' | 'name'>('outstanding')
  const [balanceSortAsc, setBalanceSortAsc] = useState(false)

  // Modals & Feedback
  const [inspectMatch, setInspectMatch] = useState<PaymentMatch | null>(null)
  const [inspectBalance, setInspectBalance] = useState<LedgerBalanceRecord | CustomerSummaryBalance | null>(null)
  const [inspectIsCustomerSummary, setInspectIsCustomerSummary] = useState(false)
  const [reminderTarget, setReminderTarget] = useState<ReminderCustomerItem | null>(null)
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setFeedback({ text, type })
    setTimeout(() => setFeedback(null), 4500)
  }

  const userId = user?.id || 'demo-shopkeeper-001'

  // Load and execute matching
  const loadMatchesData = async () => {
    setLoading(true)
    try {
      const [paymentsRes, ledgerRes, existingMatchesRes] = await Promise.all([
        paymentService.getPayments(userId),
        ledgerService.getEntries(userId),
        matchService.getMatches(userId),
      ])

      const fetchedPayments = paymentsRes.data || []
      const fetchedLedger = ledgerRes.data || []

      setPayments(fetchedPayments)
      setLedgerEntries(fetchedLedger)

      if (existingMatchesRes.data.length === 0 && fetchedPayments.length > 0 && fetchedLedger.length > 0) {
        const engineResult = deterministicMatchService.runMatching(fetchedPayments, fetchedLedger, {
          maxDateWindowDays: dateWindowDays,
        })
        const saved = await matchService.saveMatches(userId, engineResult.matches)
        setMatches(saved.data)
        setUnmatchedLedger(engineResult.unmatchedLedgerEntries)
        setUnmatchedPayments(engineResult.unmatchedPayments)
      } else {
        const engineResult = deterministicMatchService.runMatching(fetchedPayments, fetchedLedger, {
          maxDateWindowDays: dateWindowDays,
        })
        setMatches(existingMatchesRes.data.length > 0 ? existingMatchesRes.data : engineResult.matches)
        setUnmatchedLedger(engineResult.unmatchedLedgerEntries)
        setUnmatchedPayments(engineResult.unmatchedPayments)
      }
    } catch (err: any) {
      console.error('Failed to load matches data:', err)
      showToast('Error loading payment matches.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMatchesData()
  }, [userId, dateWindowDays])

  // Re-run matching action
  const handleRerunMatching = async () => {
    setIsRerunning(true)
    try {
      const [paymentsRes, ledgerRes] = await Promise.all([
        paymentService.getPayments(userId),
        ledgerService.getEntries(userId),
      ])
      const fetchedPayments = paymentsRes.data || []
      const fetchedLedger = ledgerRes.data || []
      setPayments(fetchedPayments)
      setLedgerEntries(fetchedLedger)

      const engineResult = deterministicMatchService.runMatching(fetchedPayments, fetchedLedger, {
        maxDateWindowDays: dateWindowDays,
      })
      const saved = await matchService.saveMatches(userId, engineResult.matches)
      setMatches(saved.data)
      setUnmatchedLedger(engineResult.unmatchedLedgerEntries)
      setUnmatchedPayments(engineResult.unmatchedPayments)
      showToast('Deterministic matching recalculated successfully.')
    } finally {
      setIsRerunning(false)
    }
  }

  // --- GEMINI AI AMBIGUOUS MATCHING ACTION ---
  const handleRunAiAnalysis = async () => {
    setIsAnalyzingAi(true)
    try {
      const candidatePairs = aiMatchService.selectAmbiguousCandidates(matches, payments, ledgerEntries)

      if (candidatePairs.length === 0) {
        showToast('No ambiguous candidate pairs found requiring AI analysis.', 'warning')
        setIsAnalyzingAi(false)
        return
      }

      const { data, error } = await aiMatchService.analyzeWithGemini(userId, candidatePairs)

      if (error || !data) {
        showToast(error?.message || 'Gemini AI matching failed.', 'error')
      } else {
        const mergedMatches = aiMatchService.mergeAiSuggestionsIntoMatches(
          matches,
          data.suggestions,
          ledgerEntries
        )
        const saved = await matchService.saveMatches(userId, mergedMatches)
        setMatches(saved.data)
        setLastAiTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        showToast(`✨ Gemini AI analyzed ${data.analyzedCount} ambiguous candidate pairs.`)
      }
    } catch (err: any) {
      console.error('AI matching error:', err)
      showToast('An error occurred during Gemini matching.', 'error')
    } finally {
      setIsAnalyzingAi(false)
    }
  }

  // --- CONFIRM / REJECT ACTIONS ---
  const handleConfirmMatch = async (match: PaymentMatch) => {
    const { data, error } = await matchService.confirmMatch(
      userId,
      match.id,
      match.ledger_entry_id
    )

    if (error || !data) {
      showToast(error?.message || 'Failed to confirm match.', 'error')
    } else {
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, user_confirmed: true, status: 'confirmed' } : m))
      )
      showToast(`✓ Match confirmed for ${match.payment?.payer_name} (${formatINR(match.payment?.amount)})`)
    }
  }

  const handleRejectMatch = async (match: PaymentMatch) => {
    const { data, error } = await matchService.rejectMatch(userId, match.id)
    if (error || !data) {
      showToast('Failed to reject match.', 'error')
    } else {
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, status: 'rejected', user_confirmed: false } : m))
      )
      showToast('Match suggestion rejected.', 'warning')
    }
  }

  // --- OUTSTANDING BALANCES CALCULATION ---
  const ledgerBalances: LedgerBalanceRecord[] = useMemo(() => {
    return balanceTrackingService.calculateLedgerBalances(ledgerEntries, matches)
  }, [ledgerEntries, matches])

  const customerBalances: CustomerSummaryBalance[] = useMemo(() => {
    return balanceTrackingService.aggregateCustomerBalances(ledgerBalances)
  }, [ledgerBalances])

  const portfolioSummary: OverallPortfolioSummary = useMemo(() => {
    return balanceTrackingService.calculatePortfolioSummary(ledgerBalances)
  }, [ledgerBalances])

  // --- DYNAMIC SUMMARY METRICS ---
  const matchStats = useMemo(() => {
    const total = matches.length
    const strong = matches.filter((m) => m.confidence >= 0.75 && m.ledger_entry_id !== null && m.match_type !== 'fuzzy').length
    const aiMatches = matches.filter((m) => m.match_type === 'fuzzy' || m.reason.includes('AI') || m.reason.includes('Gemini')).length
    const needsReview = matches.filter((m) => m.confidence < 0.75 && m.ledger_entry_id !== null && !m.user_confirmed).length
    const confirmed = matches.filter((m) => m.user_confirmed).length
    const rejected = matches.filter((m) => m.status === 'rejected').length
    const unmatchedCount = unmatchedPayments.length
    const unmatchedLedgerCount = unmatchedLedger.length

    const confirmedSum = matches
      .filter((m) => m.user_confirmed && m.payment)
      .reduce((sum, m) => sum + (m.payment?.amount || 0), 0)

    return { total, strong, aiMatches, needsReview, confirmed, rejected, unmatchedCount, unmatchedLedgerCount, confirmedSum }
  }, [matches, unmatchedPayments, unmatchedLedger])

  // --- FILTERED & SORTED MATCHES ---
  const filteredMatches = useMemo(() => {
    return matches
      .filter((m) => {
        const payer = m.payment?.payer_name || ''
        const customer = m.ledger_entry?.customer_name || ''
        const ref = m.payment?.reference || ''
        const q = matchSearchQuery.toLowerCase()

        const matchesQuery =
          payer.toLowerCase().includes(q) ||
          customer.toLowerCase().includes(q) ||
          ref.toLowerCase().includes(q) ||
          String(m.payment?.amount).includes(q)

        if (!matchesQuery) return false

        if (matchFilter === 'confirmed') return m.user_confirmed
        if (matchFilter === 'needs_review') return m.confidence < 0.75 && m.ledger_entry_id !== null && !m.user_confirmed
        if (matchFilter === 'strong') return m.confidence >= 0.75 && m.ledger_entry_id !== null && m.match_type !== 'fuzzy'
        if (matchFilter === 'ai_matches') return m.match_type === 'fuzzy' || m.reason.includes('AI')
        if (matchFilter === 'rejected') return m.status === 'rejected'
        if (matchFilter === 'unmatched_payments') return m.match_type === 'unmatched' || !m.ledger_entry_id

        return true
      })
      .sort((a, b) => {
        if (matchSortField === 'date') {
          const dateA = a.payment?.paid_at || a.ledger_entry?.entry_date || ''
          const dateB = b.payment?.paid_at || b.ledger_entry?.entry_date || ''
          return matchSortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
        }
        if (matchSortField === 'amount') {
          const amtA = a.payment?.amount || a.ledger_entry?.amount || 0
          const amtB = b.payment?.amount || b.ledger_entry?.amount || 0
          return matchSortAsc ? amtA - amtB : amtB - amtA
        }
        if (matchSortField === 'customer') {
          const nameA = a.ledger_entry?.customer_name || a.payment?.payer_name || ''
          const nameB = b.ledger_entry?.customer_name || b.payment?.payer_name || ''
          return matchSortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
        }
        if (matchSortField === 'status') {
          return matchSortAsc ? a.confidence - b.confidence : b.confidence - a.confidence
        }
        return 0
      })
  }, [matches, matchSearchQuery, matchFilter, matchSortField, matchSortAsc])

  // --- FILTERED & SORTED BALANCES ---
  const filteredLedgerBalances = useMemo(() => {
    return ledgerBalances
      .filter((b) => {
        const q = balanceSearchQuery.toLowerCase()
        const matchesQuery = b.customerName.toLowerCase().includes(q) || String(b.originalAmount).includes(q)
        if (!matchesQuery) return false

        if (balanceFilter === 'unpaid') return b.status === 'unpaid'
        if (balanceFilter === 'partially_paid') return b.status === 'partially_paid'
        if (balanceFilter === 'fully_paid') return b.status === 'fully_paid'
        if (balanceFilter === 'overpaid') return b.status === 'overpaid'
        return true
      })
      .sort((a, b) => {
        if (balanceSortField === 'outstanding') {
          return balanceSortAsc ? a.outstandingAmount - b.outstandingAmount : b.outstandingAmount - a.outstandingAmount
        }
        if (balanceSortField === 'original') {
          return balanceSortAsc ? a.originalAmount - b.originalAmount : b.originalAmount - a.originalAmount
        }
        if (balanceSortField === 'date') {
          const dateA = a.ledgerDate || ''
          const dateB = b.ledgerDate || ''
          return balanceSortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
        }
        if (balanceSortField === 'name') {
          return balanceSortAsc ? a.customerName.localeCompare(b.customerName) : b.customerName.localeCompare(a.customerName)
        }
        return 0
      })
  }, [ledgerBalances, balanceSearchQuery, balanceFilter, balanceSortField, balanceSortAsc])

  const filteredCustomerBalances = useMemo(() => {
    return customerBalances
      .filter((c) => {
        const q = balanceSearchQuery.toLowerCase()
        const matchesQuery = c.customerName.toLowerCase().includes(q) || String(c.totalOutstandingAmount).includes(q)
        if (!matchesQuery) return false

        if (balanceFilter === 'unpaid') return c.overallStatus === 'unpaid'
        if (balanceFilter === 'partially_paid') return c.overallStatus === 'partially_paid'
        if (balanceFilter === 'fully_paid') return c.overallStatus === 'fully_paid'
        if (balanceFilter === 'overpaid') return c.overallStatus === 'overpaid'
        return true
      })
      .sort((a, b) => {
        if (balanceSortField === 'outstanding') {
          return balanceSortAsc ? a.totalOutstandingAmount - b.totalOutstandingAmount : b.totalOutstandingAmount - a.totalOutstandingAmount
        }
        if (balanceSortField === 'original') {
          return balanceSortAsc ? a.totalOriginalAmount - b.totalOriginalAmount : b.totalOriginalAmount - a.totalOriginalAmount
        }
        if (balanceSortField === 'date') {
          const dateA = a.latestActivityDate || ''
          const dateB = b.latestActivityDate || ''
          return balanceSortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
        }
        if (balanceSortField === 'name') {
          return balanceSortAsc ? a.customerName.localeCompare(b.customerName) : b.customerName.localeCompare(a.customerName)
        }
        return 0
      })
  }, [customerBalances, balanceSearchQuery, balanceFilter, balanceSortField, balanceSortAsc])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link to="/review" className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-emerald-700">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Review & Fix</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Matches & Outstanding Balances
          </h1>
          <p className="text-sm text-slate-500">
            Reconcile notebook credit dues with bank/UPI statements and track real-time customer balances.
          </p>
        </div>

        {/* Action Header Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Gemini AI Trigger Button */}
          <Button
            type="button"
            disabled={isAnalyzingAi || loading}
            onClick={handleRunAiAnalysis}
            className="text-xs font-bold rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white shadow-md shadow-purple-900/10"
          >
            {isAnalyzingAi ? (
              <span className="flex items-center space-x-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Gemini Analyzing...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze Ambiguous with Gemini AI</span>
              </span>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isRerunning || loading}
            onClick={handleRerunMatching}
            className="text-xs font-bold rounded-xl border-slate-300 text-slate-700 bg-white"
          >
            {isRerunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            )}
            <span>Re-run Rules</span>
          </Button>

          <Button
            onClick={() => navigate('/reminders')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md h-10 px-4"
          >
            <span>Proceed to Step 4: Reminders</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* Toast Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl flex items-center space-x-2.5 text-xs font-semibold animate-in fade-in ${
            feedback.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : feedback.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
          {lastAiTime && (
            <span className="ml-auto text-[10px] opacity-70 font-mono">Last AI Analysis: {lastAiTime}</span>
          )}
        </div>
      )}

      {/* Dynamic Summary Cards (Consistent Across Entire Module) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="rounded-2xl border border-slate-200 p-4 shadow-sm bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Matched</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{formatINR(matchStats.confirmedSum)}</span>
            <span className="text-xs font-bold text-slate-500">{matchStats.confirmed} confirmed</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Confirmed Matches
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-900">{matchStats.confirmed}</span>
            <span className="text-xs font-bold text-emerald-700">{matchStats.strong} exact</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center">
            <Clock className="w-3 h-3 mr-1 text-amber-600" />
            Pending Review
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-900">{matchStats.needsReview}</span>
            <span className="text-xs font-bold text-amber-700">{matchStats.aiMatches} AI-assisted</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unmatched Records</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-700">{matchStats.unmatchedCount + matchStats.unmatchedLedgerCount}</span>
            <span className="text-xs text-slate-500">{matchStats.unmatchedCount} pay / {matchStats.unmatchedLedgerCount} dues</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center">
            <AlertCircle className="w-3 h-3 mr-1 text-rose-600" />
            Outstanding Due
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-rose-900">{formatINR(portfolioSummary.totalOutstandingAmount)}</span>
            <span className="text-xs font-bold text-rose-700">{portfolioSummary.customersWithPendingBalance} debtors</span>
          </div>
        </Card>
      </div>

      {/* Main View Mode Selector (Sub-Tabs) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveMainTab('matches')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeMainTab === 'matches'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitMerge className="w-4 h-4 text-emerald-600" />
            <span>Reconciliation Matches</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
              {matches.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('balances')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeMainTab === 'balances'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span>Outstanding Balances & Customer Ledger</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800">
              {portfolioSummary.unpaidCount + portfolioSummary.partiallyPaidCount} pending
            </span>
          </button>
        </div>

        {/* Proximity window selector for matches */}
        {activeMainTab === 'matches' && (
          <div className="hidden sm:flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Date Proximity:</span>
            <select
              value={dateWindowDays}
              onChange={(e) => setDateWindowDays(Number(e.target.value))}
              className="font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value={3}>± 3 Days</option>
              <option value={4}>± 4 Days</option>
              <option value={7}>± 7 Days</option>
              <option value={14}>± 14 Days</option>
            </select>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RECONCILIATION MATCHES WORKSPACE */}
      {/* ========================================================================= */}
      {activeMainTab === 'matches' && (
        <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          {/* Controls: Search, Filter Tabs & Sorting */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <Input
                  type="text"
                  placeholder="Search by payer, ledger customer or transaction reference..."
                  value={matchSearchQuery}
                  onChange={(e) => setMatchSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-xs rounded-xl bg-white"
                />
              </div>

              {/* Sorting Controls */}
              <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">Sort by:</span>
                <select
                  value={matchSortField}
                  onChange={(e) => setMatchSortField(e.target.value as any)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="status">Confidence & Status</option>
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="customer">Customer Name</option>
                </select>
                <button
                  type="button"
                  onClick={() => setMatchSortAsc(!matchSortAsc)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-1"
                >
                  {matchSortAsc ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { id: 'all', label: 'All Suggestions', count: matches.length },
                { id: 'confirmed', label: 'Confirmed', count: matchStats.confirmed },
                { id: 'needs_review', label: 'Pending Review', count: matchStats.needsReview },
                { id: 'strong', label: 'Exact Matches', count: matchStats.strong },
                { id: 'ai_matches', label: 'AI Analyzed', count: matchStats.aiMatches },
                { id: 'rejected', label: 'Rejected', count: matchStats.rejected },
                { id: 'unmatched_payments', label: 'Unmatched Payments', count: matchStats.unmatchedCount },
                { id: 'unmatched_ledger', label: 'Unmatched Ledger Dues', count: matchStats.unmatchedLedgerCount },
              ].map((tab) => {
                const isSelected = matchFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMatchFilter(tab.id as MatchFilterCategory)}
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

          {/* Matches List */}
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                <p className="text-xs font-semibold">Loading payment reconciliation matches...</p>
              </div>
            ) : matchFilter === 'unmatched_ledger' ? (
              <div className="p-6 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Outstanding Ledger Dues Without Matching Bank Payment</span>
                </h3>
                {unmatchedLedger.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">All ledger dues have matched payments!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {unmatchedLedger.map((item) => (
                      <div key={item.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900">{item.customer_name}</span>
                          <span className="text-xs font-black text-amber-900">{formatINR(item.amount)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">Date: {formatDate(item.entry_date)}</p>
                        <span className="inline-block text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          Pending Collection
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-1">
                <p className="text-sm font-semibold">No matches found for current filter.</p>
                <p className="text-xs">Try selecting 'All Suggestions' or clearing your search query.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredMatches.map((match) => {
                  const isConfirmed = match.user_confirmed
                  const isRejected = match.status === 'rejected'
                  const isAiAssisted = match.match_type === 'fuzzy' || match.reason.includes('AI') || match.reason.includes('Gemini')
                  const isStrong = match.confidence >= 0.75
                  const isUnmatched = match.match_type === 'unmatched' || !match.ledger_entry

                  return (
                    <div
                      key={match.id}
                      className={`p-4 sm:p-5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isConfirmed
                          ? 'bg-emerald-50/20'
                          : isRejected
                          ? 'bg-slate-50/70 opacity-60'
                          : isAiAssisted
                          ? 'bg-purple-50/30 hover:bg-purple-50/50'
                          : !isStrong
                          ? 'bg-amber-50/30'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Left: Matched Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {isConfirmed ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                              Confirmed Match
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded-full">
                              Rejected Suggestion
                            </span>
                          ) : isAiAssisted ? (
                            <Badge variant="purple" className="text-[10px] font-bold flex items-center">
                              <Sparkles className="w-3 h-3 mr-1 text-purple-600" />
                              <span>{Math.round(match.confidence * 100)}% AI Verified Match</span>
                            </Badge>
                          ) : isStrong ? (
                            <Badge variant="success" className="text-[10px] font-bold">
                              {Math.round(match.confidence * 100)}% Exact Match
                            </Badge>
                          ) : isUnmatched ? (
                            <Badge variant="outline" className="text-[10px] font-bold text-slate-500 bg-white">
                              Unmatched Payment
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px] font-bold flex items-center">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              <span>{Math.round(match.confidence * 100)}% Pending Review</span>
                            </Badge>
                          )}

                          {match.date_diff_days !== null && match.date_diff_days !== undefined && (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {match.date_diff_days === 0 ? 'Same Day' : `${match.date_diff_days}d apart`}
                            </span>
                          )}
                        </div>

                        {/* Side-by-Side Comparison */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* Bank Payment */}
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 font-bold text-xs">
                              UPI
                            </div>
                            <div>
                              <p className="text-xs font-extrabold text-slate-900 truncate">
                                {match.payment?.payer_name || 'Unknown'}
                              </p>
                              <p className="text-[11px] text-teal-700 font-bold">
                                {formatINR(match.payment?.amount)} • {formatDate(match.payment?.paid_at)}
                              </p>
                            </div>
                          </div>

                          {/* Ledger Customer */}
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                              K
                            </div>
                            <div>
                              {match.ledger_entry ? (
                                <>
                                  <p className="text-xs font-extrabold text-slate-900 truncate">
                                    {match.ledger_entry.customer_name}
                                  </p>
                                  <p className="text-[11px] text-emerald-700 font-bold">
                                    {formatINR(match.ledger_entry.amount)} • {formatDate(match.ledger_entry.entry_date)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-slate-400 italic font-medium">
                                  No matching ledger entry found
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Rationale */}
                        <p className="text-xs text-slate-600 font-medium pt-0.5 line-clamp-2">
                          "{match.reason}"
                        </p>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center space-x-2 self-end md:self-center shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectMatch(match)}
                          className="h-8 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          <span>View Details</span>
                        </Button>

                        {!isUnmatched && !isConfirmed && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleConfirmMatch(match)}
                            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            <span>Confirm</span>
                          </Button>
                        )}

                        {!isUnmatched && !isRejected && !isConfirmed && (
                          <button
                            type="button"
                            onClick={() => handleRejectMatch(match)}
                            title="Reject Suggestion"
                            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: OUTSTANDING BALANCES & CUSTOMER LEDGER */}
      {/* ========================================================================= */}
      {activeMainTab === 'balances' && (
        <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          {/* Controls: Mode Switch, Search, Filter Tabs & Sorting */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <Input
                  type="text"
                  placeholder="Search customer balance by name or amount..."
                  value={balanceSearchQuery}
                  onChange={(e) => setBalanceSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-xs rounded-xl bg-white"
                />
              </div>

              {/* View Sub-mode Switcher */}
              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setBalanceViewMode('entries')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    balanceViewMode === 'entries'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Ledger Entry
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceViewMode('customers')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    balanceViewMode === 'customers'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Grouped by Customer
                </button>
              </div>

              {/* Sorting Controls */}
              <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">Sort by:</span>
                <select
                  value={balanceSortField}
                  onChange={(e) => setBalanceSortField(e.target.value as any)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="outstanding">Outstanding Amount</option>
                  <option value="original">Original Amount</option>
                  <option value="date">Date</option>
                  <option value="name">Customer Name</option>
                </select>
                <button
                  type="button"
                  onClick={() => setBalanceSortAsc(!balanceSortAsc)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-1"
                >
                  {balanceSortAsc ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { id: 'all', label: 'All Dues', count: ledgerBalances.length },
                { id: 'unpaid', label: 'Unpaid', count: portfolioSummary.unpaidCount },
                { id: 'partially_paid', label: 'Partially Paid', count: portfolioSummary.partiallyPaidCount },
                { id: 'fully_paid', label: 'Fully Paid & Settled', count: portfolioSummary.fullyPaidCount },
                { id: 'overpaid', label: 'Overpaid', count: portfolioSummary.overpaidCount },
              ].map((tab) => {
                const isSelected = balanceFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setBalanceFilter(tab.id as BalanceFilterCategory)}
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

          {/* Balances List */}
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                <p className="text-xs font-semibold">Calculating live outstanding balances...</p>
              </div>
            ) : balanceViewMode === 'entries' ? (
              filteredLedgerBalances.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-700">No outstanding balances found matching filter.</p>
                  <p className="text-xs">All accounts in this category are clear.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredLedgerBalances.map((record) => {
                    const isUnpaid = record.status === 'unpaid'
                    const isPartial = record.status === 'partially_paid'
                    const isSettled = record.status === 'fully_paid'
                    const isOver = record.status === 'overpaid'

                    return (
                      <div
                        key={record.ledgerEntry.id}
                        className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                          isSettled
                            ? 'bg-emerald-50/15'
                            : isPartial
                            ? 'bg-amber-50/20'
                            : isOver
                            ? 'bg-purple-50/20'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Customer & Ledger Info */}
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center space-x-2.5">
                            <span className="text-sm font-extrabold text-slate-900">
                              {record.customerName}
                            </span>
                            {isSettled ? (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                ✓ Fully Paid
                              </span>
                            ) : isPartial ? (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                Partially Paid ({Math.round((record.paidAmount / record.originalAmount) * 100)}%)
                              </span>
                            ) : isOver ? (
                              <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full">
                                Overpaid / Advance
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full">
                                Unpaid Due
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center">
                              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                              Ledger Date: {formatDate(record.ledgerDate)}
                            </span>
                            {record.latestPaymentDate && (
                              <span className="flex items-center text-teal-700 font-medium">
                                <Clock className="w-3.5 h-3.5 mr-1" />
                                Last Paid: {formatDate(record.latestPaymentDate)}
                              </span>
                            )}
                            {record.allocatedMatches.length > 0 && (
                              <span className="text-emerald-700 font-medium">
                                ({record.allocatedMatches.length} payment allocated)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Financial Columns */}
                        <div className="flex items-center space-x-4 sm:space-x-6 text-right">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Original</p>
                            <p className="text-xs font-bold text-slate-700">{formatINR(record.originalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-emerald-700 uppercase">Paid</p>
                            <p className="text-xs font-bold text-emerald-800">{formatINR(record.paidAmount)}</p>
                          </div>
                          <div>
                            <p className={`text-[10px] font-bold uppercase ${
                              record.outstandingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }`}>
                              Outstanding
                            </p>
                            <p className={`text-sm font-black ${
                              record.outstandingAmount > 0 ? 'text-rose-900' : 'text-emerald-800'
                            }`}>
                              {formatINR(record.outstandingAmount)}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center space-x-1.5 ml-2">
                            {record.outstandingAmount > 0 && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  setReminderTarget({
                                    customer_name: record.customerName,
                                    amount_due: record.outstandingAmount,
                                    original_amount: record.originalAmount,
                                    paid_amount: record.paidAmount,
                                    ledger_date: record.ledgerDate,
                                    entries_count: 1,
                                  })
                                }
                                className="h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              >
                                <MessageSquare className="w-3.5 h-3.5 mr-1" />
                                <span>Remind</span>
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setInspectBalance(record)
                                setInspectIsCustomerSummary(false)
                              }}
                              className="h-8 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                              <span>Details</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              /* Grouped by Customer View */
              filteredCustomerBalances.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-700">No customer records match this filter.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredCustomerBalances.map((cust) => {
                    const isSettled = cust.overallStatus === 'fully_paid'
                    const isPartial = cust.overallStatus === 'partially_paid'
                    const isOver = cust.overallStatus === 'overpaid'

                    return (
                      <div
                        key={cust.nameNormalized}
                        className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                          isSettled
                            ? 'bg-emerald-50/15'
                            : isPartial
                            ? 'bg-amber-50/20'
                            : isOver
                            ? 'bg-purple-50/20'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Customer Info */}
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center space-x-2.5">
                            <span className="text-sm font-extrabold text-slate-900">
                              {cust.customerName}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {cust.entriesCount} ledger entr{cust.entriesCount === 1 ? 'y' : 'ies'}
                            </span>
                            {isSettled ? (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                Fully Settled
                              </span>
                            ) : isPartial ? (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                Partially Paid
                              </span>
                            ) : isOver ? (
                              <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full">
                                Advance / Overpaid
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full">
                                Dues Pending
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500">
                            {cust.allocatedPayments.length} payment{cust.allocatedPayments.length === 1 ? '' : 's'} recorded • Latest Activity: {formatDate(cust.latestActivityDate)}
                          </p>
                        </div>

                        {/* Financial Columns */}
                        <div className="flex items-center space-x-4 sm:space-x-6 text-right">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Dues</p>
                            <p className="text-xs font-bold text-slate-700">{formatINR(cust.totalOriginalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-emerald-700 uppercase">Total Paid</p>
                            <p className="text-xs font-bold text-emerald-800">{formatINR(cust.totalPaidAmount)}</p>
                          </div>
                          <div>
                            <p className={`text-[10px] font-bold uppercase ${
                              cust.totalOutstandingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }`}>
                              Net Balance
                            </p>
                            <p className={`text-sm font-black ${
                              cust.totalOutstandingAmount > 0 ? 'text-rose-900' : 'text-emerald-800'
                            }`}>
                              {formatINR(cust.totalOutstandingAmount)}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center space-x-1.5 ml-2">
                            {cust.totalOutstandingAmount > 0 && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  setReminderTarget({
                                    customer_name: cust.customerName,
                                    amount_due: cust.totalOutstandingAmount,
                                    original_amount: cust.totalOriginalAmount,
                                    paid_amount: cust.totalPaidAmount,
                                    entries_count: cust.entriesCount,
                                  })
                                }
                                className="h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              >
                                <MessageSquare className="w-3.5 h-3.5 mr-1" />
                                <span>Remind</span>
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setInspectBalance(cust)
                                setInspectIsCustomerSummary(true)
                              }}
                              className="h-8 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                              <span>Details</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Match Details Inspection Modal */}
      <MatchDetailsModal
        isOpen={Boolean(inspectMatch)}
        match={inspectMatch}
        onConfirm={() => inspectMatch && handleConfirmMatch(inspectMatch)}
        onReject={() => inspectMatch && handleRejectMatch(inspectMatch)}
        onClose={() => setInspectMatch(null)}
      />

      {/* Outstanding Balance Details Modal */}
      <BalanceDetailsModal
        isOpen={Boolean(inspectBalance)}
        record={inspectBalance}
        isCustomerSummary={inspectIsCustomerSummary}
        onClose={() => setInspectBalance(null)}
      />

      {/* Reminder Draft Modal */}
      <ReminderDraftModal
        isOpen={Boolean(reminderTarget)}
        customerItem={reminderTarget}
        userId={userId}
        onClose={() => setReminderTarget(null)}
      />
    </div>
  )
}
