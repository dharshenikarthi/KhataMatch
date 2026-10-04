import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ledgerService } from '@/services/ledgerService'
import { paymentService } from '@/services/paymentService'
import { matchService } from '@/services/matchService'
import {
  balanceTrackingService,
  LedgerBalanceRecord,
  CustomerSummaryBalance,
} from '@/services/balanceTrackingService'
import { reminderHistoryService } from '@/services/reminderHistoryService'
import {
  analyticsService,
  AnalyticsTimeRange,
  FinancialSummaryKPIs,
  FinancialTrendPoint,
  AgingBucket,
  ReconciliationMethodInsight,
  ReminderAnalyticsMetrics,
} from '@/services/analyticsService'
import { LedgerEntry, Payment, PaymentMatch, ReminderHistoryItem } from '@/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FinancialTrendChart } from '@/components/analytics/FinancialTrendChart'
import { AgingBreakdownCard } from '@/components/analytics/AgingBreakdownCard'
import { ReminderDraftModal } from '@/components/common/ReminderDraftModal'
import { ReminderCustomerItem } from '@/services/reminderService'
import {
  BarChart3,
  TrendingUp,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  RotateCcw,
  Download,
  ShieldCheck,
  Sparkles,
  GitMerge,
  Clock,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Send,
  Loader2,
  MessageSquare,
} from 'lucide-react'
import { formatINR, formatDate } from '@/lib/utils'

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const userId = user?.id || 'demo-shopkeeper-001'

  // Raw Data State
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [matches, setMatches] = useState<PaymentMatch[]>([])
  const [historyItems, setHistoryItems] = useState<ReminderHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filter State
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('30d')
  const [reminderTarget, setReminderTarget] = useState<ReminderCustomerItem | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (text: string) => {
    setToastMessage(text)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load all live dataset records
  const loadData = async () => {
    setLoading(true)
    try {
      const [ledgerRes, paymentsRes, matchesRes, historyRes] = await Promise.all([
        ledgerService.getEntries(userId),
        paymentService.getPayments(userId),
        matchService.getMatches(userId),
        reminderHistoryService.getReminderHistory(userId),
      ])

      setLedgerEntries(ledgerRes.data || [])
      setPayments(paymentsRes.data || [])
      setMatches(matchesRes.data || [])
      setHistoryItems(historyRes.data || [])
    } catch (err) {
      console.error('Failed to load analytics data:', err)
      showToast('Error loading financial analytics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userId])

  // Phase 9 Balances & Customer Aggregation
  const ledgerBalances: LedgerBalanceRecord[] = useMemo(() => {
    return balanceTrackingService.calculateLedgerBalances(ledgerEntries, matches)
  }, [ledgerEntries, matches])

  const customerBalances: CustomerSummaryBalance[] = useMemo(() => {
    return balanceTrackingService.aggregateCustomerBalances(ledgerBalances)
  }, [ledgerBalances])

  // Analytics KPIs
  const kpis: FinancialSummaryKPIs = useMemo(() => {
    return analyticsService.calculateKPIs(ledgerEntries, payments, matches, ledgerBalances)
  }, [ledgerEntries, payments, matches, ledgerBalances])

  // Financial Trend Series
  const trends: FinancialTrendPoint[] = useMemo(() => {
    return analyticsService.generateFinancialTrends(ledgerEntries, payments, matches, timeRange)
  }, [ledgerEntries, payments, matches, timeRange])

  // Aging Breakdown
  const agingBuckets: AgingBucket[] = useMemo(() => {
    return analyticsService.calculateAgingBreakdown(ledgerBalances)
  }, [ledgerBalances])

  // Reconciliation Insights
  const insights: ReconciliationMethodInsight = useMemo(() => {
    return analyticsService.calculateReconciliationInsights(matches, payments, ledgerEntries)
  }, [matches, payments, ledgerEntries])

  // Reminder Metrics
  const reminderMetrics: ReminderAnalyticsMetrics = useMemo(() => {
    return analyticsService.calculateReminderMetrics(historyItems)
  }, [historyItems])

  // Top Debtors
  const topDebtors = useMemo(() => {
    return [...customerBalances]
      .filter((c) => c.totalOutstandingAmount > 0)
      .sort((a, b) => b.totalOutstandingAmount - a.totalOutstandingAmount)
      .slice(0, 5)
  }, [customerBalances])

  // CSV Export Handlers
  const handleExportReconciliationSummary = () => {
    const csv = analyticsService.generateReconciliationCsv(kpis, insights)
    analyticsService.downloadCsvFile(csv, `KhataMatch_Reconciliation_Summary_${new Date().toISOString().split('T')[0]}.csv`)
    showToast('✓ Reconciliation Summary CSV exported.')
  }

  const handleExportConfirmedMatches = () => {
    const csv = analyticsService.generateConfirmedMatchesCsv(matches)
    analyticsService.downloadCsvFile(csv, `KhataMatch_Confirmed_Matches_${new Date().toISOString().split('T')[0]}.csv`)
    showToast('✓ Confirmed Matches CSV exported.')
  }

  const handleExportOutstandingBalances = () => {
    const csv = analyticsService.generateOutstandingBalancesCsv(ledgerBalances)
    analyticsService.downloadCsvFile(csv, `KhataMatch_Outstanding_Balances_${new Date().toISOString().split('T')[0]}.csv`)
    showToast('✓ Outstanding Balances CSV exported.')
  }

  const handleExportRemindersList = () => {
    const csv = analyticsService.generateRemindersCsv(historyItems)
    analyticsService.downloadCsvFile(csv, `KhataMatch_Reminder_Followups_${new Date().toISOString().split('T')[0]}.csv`)
    showToast('✓ Reminder Follow-up List CSV exported.')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              to="/reminders"
              className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-emerald-700"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Step 4: Reminders Hub</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Financial Analytics & Reconciliation Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Real-time analytics for notebook credit, UPI collections, reconciliation rate, and aging dues.
          </p>
        </div>

        {/* Action Header Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="text-xs font-bold rounded-xl border-slate-300 text-slate-700 bg-white"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {/* Export Reports Dropdown / Quick Button */}
          <div className="relative group">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md h-10 px-4 flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV Reports</span>
            </Button>
            <div className="absolute right-0 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 hidden group-hover:block z-30 animate-in fade-in">
              <button
                type="button"
                onClick={handleExportReconciliationSummary}
                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reconciliation Summary</span>
              </button>
              <button
                type="button"
                onClick={handleExportConfirmedMatches}
                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                <span>Confirmed Matches</span>
              </button>
              <button
                type="button"
                onClick={handleExportOutstandingBalances}
                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600" />
                <span>Outstanding Balances</span>
              </button>
              <button
                type="button"
                onClick={handleExportRemindersList}
                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
                <span>Reminder Follow-ups List</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2.5 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Primary Financial Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Ledger Credit */}
        <Card
          onClick={() => navigate('/matches')}
          className="cursor-pointer rounded-2xl border border-slate-200 p-4 shadow-sm bg-white hover:border-slate-300 transition-all"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Ledger Credit</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{formatINR(kpis.totalLedgerAmount)}</span>
            <span className="text-xs font-bold text-slate-500">{kpis.unpaidLedgerCount + kpis.partiallyPaidLedgerCount + kpis.fullyPaidLedgerCount} entries</span>
          </div>
        </Card>

        {/* Total Imported Payments */}
        <Card
          onClick={() => navigate('/matches')}
          className="cursor-pointer rounded-2xl border border-teal-200 bg-teal-50/30 p-4 shadow-sm hover:border-teal-300 transition-all"
        >
          <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wider flex items-center">
            <span className="w-2 h-2 rounded-full bg-teal-500 mr-1.5"></span>
            Imported Payments
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-teal-900">{formatINR(kpis.totalImportedPaymentAmount)}</span>
            <span className="text-xs font-bold text-teal-700">{payments.length} txn</span>
          </div>
        </Card>

        {/* Total Confirmed Matched */}
        <Card
          onClick={() => navigate('/matches')}
          className="cursor-pointer rounded-2xl border border-purple-200 bg-purple-50/30 p-4 shadow-sm hover:border-purple-300 transition-all"
        >
          <p className="text-[10px] font-bold text-purple-800 uppercase tracking-wider flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-1 text-purple-600" />
            Confirmed Matched
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-purple-900">{formatINR(kpis.totalConfirmedMatchedAmount)}</span>
            <span className="text-xs font-bold text-purple-700">{kpis.confirmedMatchesCount} matches</span>
          </div>
        </Card>

        {/* Total Outstanding Balance */}
        <Card
          onClick={() => navigate('/matches')}
          className="cursor-pointer rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm hover:border-rose-300 transition-all"
        >
          <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center">
            <AlertCircle className="w-3 h-3 mr-1 text-rose-600" />
            Outstanding Due
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-rose-900">{formatINR(kpis.totalOutstandingBalance)}</span>
            <span className="text-xs font-bold text-rose-700">{kpis.activeDebtorsCount} debtors</span>
          </div>
        </Card>

        {/* Reconciliation Completion Rate */}
        <Card className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center">
            <Sparkles className="w-3 h-3 mr-1 text-emerald-600" />
            Reconciliation Rate
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-900">{kpis.reconciliationRatePercent}%</span>
            <span className="text-xs font-bold text-emerald-700">Settled</span>
          </div>
        </Card>
      </div>

      {/* Financial Trends Section */}
      <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <CardTitle className="text-sm font-extrabold text-slate-900">
                Financial Reconciliation Trends
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Compare notebook credits, imported UPI payments, and confirmed matches over time
              </CardDescription>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold">
            {[
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '90d', label: '90D' },
              { id: 'year', label: 'This Year' },
              { id: 'all', label: 'All' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeRange(t.id as AnalyticsTimeRange)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  timeRange === t.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <FinancialTrendChart data={trends} height={250} />
        </CardContent>
      </Card>

      {/* Credit Aging Breakdown Card */}
      <AgingBreakdownCard buckets={agingBuckets} totalOutstanding={kpis.totalOutstandingBalance} />

      {/* Reconciliation Insights & Top Debtors Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reconciliation Method Insights */}
        <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/60">
            <CardTitle className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <GitMerge className="w-4 h-4 text-emerald-600" />
              <span>Reconciliation Method Insights</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Breakdown of deterministic vs AI-assisted matched payments
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-1">
                <p className="text-[10px] font-bold text-emerald-800 uppercase">Exact Deterministic</p>
                <p className="text-lg font-black text-emerald-950">{formatINR(insights.exactDeterministicAmount)}</p>
                <p className="text-xs text-emerald-700 font-medium">{insights.exactDeterministicCount} verified matches</p>
              </div>

              <div className="p-3.5 rounded-2xl border border-purple-200 bg-purple-50/30 space-y-1">
                <p className="text-[10px] font-bold text-purple-800 uppercase flex items-center">
                  <Sparkles className="w-3 h-3 mr-1 text-purple-600" />
                  AI-Assisted Confirmed
                </p>
                <p className="text-lg font-black text-purple-950">{formatINR(insights.aiAssistedConfirmedAmount)}</p>
                <p className="text-xs text-purple-700 font-medium">{insights.aiAssistedConfirmedCount} verified matches</p>
              </div>

              <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/30 space-y-1">
                <p className="text-[10px] font-bold text-amber-800 uppercase">Pending Review</p>
                <p className="text-lg font-black text-amber-950">{insights.pendingReviewCount}</p>
                <p className="text-xs text-amber-700 font-medium">Candidates in queue</p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Unmatched Payments</p>
                <p className="text-lg font-black text-slate-900">{formatINR(insights.unmatchedPaymentsAmount)}</p>
                <p className="text-xs text-slate-500 font-medium">{insights.unmatchedPaymentsCount} unmatched txn</p>
              </div>
            </div>

            <div className="pt-1">
              <Button
                variant="outline"
                onClick={() => navigate('/matches')}
                className="w-full text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <span>Review & Reconcile Candidate Matches</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 text-slate-400" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Largest Outstanding Debtors */}
        <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <Users className="w-4 h-4 text-rose-600" />
                <span>Largest Outstanding Debtors</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Customers with the highest pending balances
              </CardDescription>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Top {topDebtors.length}
            </span>
          </CardHeader>

          <CardContent className="p-0 divide-y divide-slate-100">
            {topDebtors.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
                <p className="text-xs font-bold text-slate-700">All customer dues are fully cleared!</p>
              </div>
            ) : (
              topDebtors.map((debtor) => (
                <div
                  key={debtor.nameNormalized}
                  className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-slate-900">{debtor.customerName}</p>
                    <p className="text-[11px] text-slate-500">
                      {debtor.entriesCount} ledger credit{debtor.entriesCount === 1 ? '' : 's'} • Last active: {formatDate(debtor.latestActivityDate)}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 text-right">
                    <div>
                      <p className="text-[10px] font-bold text-rose-700 uppercase">Outstanding</p>
                      <p className="text-xs font-black text-rose-900">{formatINR(debtor.totalOutstandingAmount)}</p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setReminderTarget({
                          customer_name: debtor.customerName,
                          amount_due: debtor.totalOutstandingAmount,
                          original_amount: debtor.totalOriginalAmount,
                          paid_amount: debtor.totalPaidAmount,
                          entries_count: debtor.entriesCount,
                        })
                      }
                      className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      <MessageSquare className="w-3 h-3 mr-1" />
                      <span>Remind</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reminder & Follow-up Analytics Summary Card */}
      <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <CardTitle className="text-sm font-extrabold text-slate-900">
                Reminder Queue & Follow-up Activity
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Observed actions across drafts, WhatsApp click launches, and follow-ups
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reminders')}
            className="rounded-xl text-xs font-bold text-slate-700 border-slate-200"
          >
            <span>Open Follow-up Hub</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </CardHeader>

        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Saved</p>
              <p className="text-base font-black text-slate-900 mt-0.5">{reminderMetrics.totalSaved}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Drafts</p>
              <p className="text-base font-black text-slate-800 mt-0.5">{reminderMetrics.draftCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-teal-50/40 border border-teal-200">
              <p className="text-[10px] font-bold text-teal-800 uppercase">Copied</p>
              <p className="text-base font-black text-teal-900 mt-0.5">{reminderMetrics.copiedCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50/40 border border-emerald-200">
              <p className="text-[10px] font-bold text-emerald-800 uppercase">WhatsApp</p>
              <p className="text-base font-black text-emerald-900 mt-0.5">{reminderMetrics.openedInWhatsAppCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/40 border border-amber-200">
              <p className="text-[10px] font-bold text-amber-800 uppercase">Due Today</p>
              <p className="text-base font-black text-amber-900 mt-0.5">{reminderMetrics.dueTodayCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50/40 border border-rose-200">
              <p className="text-[10px] font-bold text-rose-800 uppercase">Overdue</p>
              <p className="text-base font-black text-rose-900 mt-0.5">{reminderMetrics.overdueCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Archived</p>
              <p className="text-base font-black text-slate-600 mt-0.5">{reminderMetrics.archivedCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reminder Modal */}
      <ReminderDraftModal
        isOpen={Boolean(reminderTarget)}
        customerItem={reminderTarget}
        shopName={profile?.shop_name || 'KhataMatch Shop'}
        userId={userId}
        onClose={() => setReminderTarget(null)}
        onSaved={loadData}
      />
    </div>
  )
}
