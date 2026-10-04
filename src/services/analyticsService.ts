import { LedgerEntry, Payment, PaymentMatch, ReminderHistoryItem } from '../types'
import { toPaise } from './deterministicMatchService'
import {
  LedgerBalanceRecord,
  CustomerSummaryBalance,
  balanceTrackingService,
} from './balanceTrackingService'

export type AnalyticsTimeRange = '7d' | '30d' | '90d' | 'year' | 'all'
export type AnalyticsGrouping = 'day' | 'week' | 'month'

export interface FinancialSummaryKPIs {
  totalLedgerAmount: number
  totalImportedPaymentAmount: number
  totalConfirmedMatchedAmount: number
  totalOutstandingBalance: number
  confirmedMatchesCount: number
  unmatchedPaymentsCount: number
  unpaidLedgerCount: number
  partiallyPaidLedgerCount: number
  fullyPaidLedgerCount: number
  reconciliationRatePercent: number
  activeDebtorsCount: number
}

export interface FinancialTrendPoint {
  periodKey: string // YYYY-MM-DD or Month/Year label
  label: string
  ledgerCreditAmount: number
  importedPaymentAmount: number
  confirmedMatchedAmount: number
  ledgerCount: number
  paymentCount: number
}

export interface AgingBucket {
  rangeLabel: string
  minDays: number
  maxDays: number | null
  totalAmount: number
  entriesCount: number
  percentageOfTotal: number
}

export interface ReconciliationMethodInsight {
  exactDeterministicCount: number
  exactDeterministicAmount: number
  aiAssistedConfirmedCount: number
  aiAssistedConfirmedAmount: number
  pendingReviewCount: number
  rejectedCount: number
  unmatchedPaymentsCount: number
  unmatchedPaymentsAmount: number
  unmatchedLedgerCount: number
  unmatchedLedgerAmount: number
}

export interface ReminderAnalyticsMetrics {
  totalSaved: number
  draftCount: number
  copiedCount: number
  openedInWhatsAppCount: number
  followUpScheduledCount: number
  dueTodayCount: number
  overdueCount: number
  upcomingCount: number
  archivedCount: number
}

export const analyticsService = {
  /**
   * Calculates high-level Financial KPI Summary metrics
   */
  calculateKPIs(
    ledgerEntries: LedgerEntry[],
    payments: Payment[],
    matches: PaymentMatch[],
    ledgerBalances: LedgerBalanceRecord[]
  ): FinancialSummaryKPIs {
    const validEntries = ledgerEntries.filter(
      (e) => e.status !== 'struck_out' && e.status !== 'deleted'
    )

    const totalLedgerPaise = validEntries.reduce((sum, e) => sum + toPaise(e.amount), 0)
    const totalPaymentPaise = payments.reduce((sum, p) => sum + toPaise(p.amount), 0)

    const confirmedMatches = matches.filter((m) => m.user_confirmed && m.payment)
    const totalConfirmedMatchedPaise = confirmedMatches.reduce(
      (sum, m) => sum + toPaise(m.payment?.amount || 0),
      0
    )

    const totalOutstandingPaise = ledgerBalances.reduce(
      (sum, b) => sum + toPaise(b.outstandingAmount),
      0
    )

    let unpaidLedgerCount = 0
    let partiallyPaidLedgerCount = 0
    let fullyPaidLedgerCount = 0
    const debtorSet = new Set<string>()

    for (const b of ledgerBalances) {
      if (b.status === 'unpaid') unpaidLedgerCount++
      else if (b.status === 'partially_paid') partiallyPaidLedgerCount++
      else if (b.status === 'fully_paid') fullyPaidLedgerCount++

      if (b.outstandingAmount > 0) {
        debtorSet.add(b.ledgerEntry.name_normalized || b.customerName.toLowerCase().trim())
      }
    }

    const matchedPaymentIds = new Set(
      matches.filter((m) => m.ledger_entry_id !== null).map((m) => m.payment_id)
    )
    const unmatchedPaymentsCount = payments.filter((p) => !matchedPaymentIds.has(p.id)).length

    // Reconciliation rate based on ledger credit covered by confirmed payments
    const reconciliationRatePercent =
      totalLedgerPaise > 0
        ? Math.min(100, Math.round((totalConfirmedMatchedPaise / totalLedgerPaise) * 1000) / 10)
        : 0

    return {
      totalLedgerAmount: totalLedgerPaise / 100,
      totalImportedPaymentAmount: totalPaymentPaise / 100,
      totalConfirmedMatchedAmount: totalConfirmedMatchedPaise / 100,
      totalOutstandingBalance: totalOutstandingPaise / 100,
      confirmedMatchesCount: confirmedMatches.length,
      unmatchedPaymentsCount,
      unpaidLedgerCount,
      partiallyPaidLedgerCount,
      fullyPaidLedgerCount,
      reconciliationRatePercent,
      activeDebtorsCount: debtorSet.size,
    }
  },

  /**
   * Filters records by a date range ('7d' | '30d' | '90d' | 'year' | 'all')
   */
  filterByDateRange<T extends { entry_date?: string | null; paid_at?: string | null; created_at?: string }>(
    items: T[],
    range: AnalyticsTimeRange,
    referenceDateStr?: string
  ): T[] {
    if (range === 'all') return items

    const now = referenceDateStr ? new Date(referenceDateStr) : new Date()
    let cutoffDate = new Date(now)

    if (range === '7d') {
      cutoffDate.setDate(now.getDate() - 7)
    } else if (range === '30d') {
      cutoffDate.setDate(now.getDate() - 30)
    } else if (range === '90d') {
      cutoffDate.setDate(now.getDate() - 90)
    } else if (range === 'year') {
      cutoffDate = new Date(now.getFullYear(), 0, 1)
    }

    const cutoffStr = cutoffDate.toISOString().split('T')[0]

    return items.filter((item) => {
      const dateVal = (item.entry_date || item.paid_at || item.created_at || '').split('T')[0]
      if (!dateVal) return true // Include if undated
      return dateVal >= cutoffStr
    })
  },

  /**
   * Generates time-series trend data grouped by day, week, or month
   */
  generateFinancialTrends(
    ledgerEntries: LedgerEntry[],
    payments: Payment[],
    matches: PaymentMatch[],
    range: AnalyticsTimeRange = '30d',
    referenceDateStr?: string
  ): FinancialTrendPoint[] {
    const filteredLedger = this.filterByDateRange(ledgerEntries, range, referenceDateStr)
    const filteredPayments = this.filterByDateRange(payments, range, referenceDateStr)

    const confirmedMatches = matches.filter((m) => m.user_confirmed && m.payment)
    const confirmedMatchesMap = new Map<string, PaymentMatch>()
    for (const m of confirmedMatches) {
      if (m.payment) confirmedMatchesMap.set(m.payment.id, m)
    }

    const grouping: AnalyticsGrouping =
      range === '7d' || range === '30d' ? 'day' : range === '90d' ? 'week' : 'month'

    const trendMap = new Map<string, FinancialTrendPoint>()

    const getGroupKey = (dateStr: string | null | undefined): { key: string; label: string } => {
      if (!dateStr) return { key: 'Undated', label: 'Undated' }
      const cleanDate = dateStr.split('T')[0]
      const d = new Date(cleanDate)

      if (grouping === 'day') {
        const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        return { key: cleanDate, label }
      }
      if (grouping === 'week') {
        // Start of week (Sunday)
        const day = d.getDay()
        const diff = d.getDate() - day
        const weekStart = new Date(d.setDate(diff))
        const key = weekStart.toISOString().split('T')[0]
        const label = `Week of ${weekStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`
        return { key, label }
      }
      // Month
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      return { key, label }
    }

    // Accumulate ledger credits
    for (const entry of filteredLedger) {
      if (entry.status === 'struck_out' || entry.status === 'deleted') continue
      const { key, label } = getGroupKey(entry.entry_date)
      const existing = trendMap.get(key) || {
        periodKey: key,
        label,
        ledgerCreditAmount: 0,
        importedPaymentAmount: 0,
        confirmedMatchedAmount: 0,
        ledgerCount: 0,
        paymentCount: 0,
      }
      existing.ledgerCreditAmount += entry.amount
      existing.ledgerCount++
      trendMap.set(key, existing)
    }

    // Accumulate payments and matched amounts
    for (const payment of filteredPayments) {
      const { key, label } = getGroupKey(payment.paid_at)
      const existing = trendMap.get(key) || {
        periodKey: key,
        label,
        ledgerCreditAmount: 0,
        importedPaymentAmount: 0,
        confirmedMatchedAmount: 0,
        ledgerCount: 0,
        paymentCount: 0,
      }
      existing.importedPaymentAmount += payment.amount
      existing.paymentCount++

      if (confirmedMatchesMap.has(payment.id)) {
        existing.confirmedMatchedAmount += payment.amount
      }
      trendMap.set(key, existing)
    }

    return Array.from(trendMap.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey))
  },

  /**
   * Calculates credit aging breakdown (time since ledger credit entry)
   */
  calculateAgingBreakdown(
    ledgerBalances: LedgerBalanceRecord[],
    referenceDateStr?: string
  ): AgingBucket[] {
    const today = referenceDateStr ? new Date(referenceDateStr) : new Date()

    const buckets: { rangeLabel: string; minDays: number; maxDays: number | null; paise: number; count: number }[] = [
      { rangeLabel: '0–15 Days', minDays: 0, maxDays: 15, paise: 0, count: 0 },
      { rangeLabel: '16–30 Days', minDays: 16, maxDays: 30, paise: 0, count: 0 },
      { rangeLabel: '31–60 Days', minDays: 31, maxDays: 60, paise: 0, count: 0 },
      { rangeLabel: '61–90 Days', minDays: 61, maxDays: 90, paise: 0, count: 0 },
      { rangeLabel: '90+ Days', minDays: 91, maxDays: null, paise: 0, count: 0 },
    ]

    let totalPendingPaise = 0

    for (const balance of ledgerBalances) {
      if (balance.outstandingAmount <= 0) continue

      const outPaise = toPaise(balance.outstandingAmount)
      totalPendingPaise += outPaise

      let ageDays = 0
      if (balance.ledgerDate) {
        const entryDate = new Date(balance.ledgerDate.split('T')[0])
        const diffMs = today.getTime() - entryDate.getTime()
        ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      }

      const bucket = buckets.find((b) => {
        if (b.maxDays === null) return ageDays >= b.minDays
        return ageDays >= b.minDays && ageDays <= b.maxDays
      }) || buckets[buckets.length - 1]

      bucket.paise += outPaise
      bucket.count++
    }

    return buckets.map((b) => ({
      rangeLabel: b.rangeLabel,
      minDays: b.minDays,
      maxDays: b.maxDays,
      totalAmount: b.paise / 100,
      entriesCount: b.count,
      percentageOfTotal:
        totalPendingPaise > 0 ? Math.round((b.paise / totalPendingPaise) * 1000) / 10 : 0,
    }))
  },

  /**
   * Categorizes reconciliation insight metadata
   */
  calculateReconciliationInsights(
    matches: PaymentMatch[],
    payments: Payment[],
    ledgerEntries: LedgerEntry[]
  ): ReconciliationMethodInsight {
    let exactDeterministicCount = 0
    let exactDeterministicPaise = 0
    let aiAssistedConfirmedCount = 0
    let aiAssistedConfirmedPaise = 0
    let pendingReviewCount = 0
    let rejectedCount = 0

    const matchedPaymentIds = new Set<string>()
    const matchedLedgerIds = new Set<string>()

    for (const m of matches) {
      if (m.ledger_entry_id) matchedLedgerIds.add(m.ledger_entry_id)
      if (m.payment_id) matchedPaymentIds.add(m.payment_id)

      const isAi = m.match_type === 'fuzzy' || m.reason.includes('AI') || m.reason.includes('Gemini')
      const amtPaise = toPaise(m.payment?.amount || 0)

      if (m.user_confirmed) {
        if (isAi) {
          aiAssistedConfirmedCount++
          aiAssistedConfirmedPaise += amtPaise
        } else {
          exactDeterministicCount++
          exactDeterministicPaise += amtPaise
        }
      } else if (m.status === 'rejected') {
        rejectedCount++
      } else if (m.ledger_entry_id !== null) {
        pendingReviewCount++
      }
    }

    // Unmatched payments
    const unmatchedPayments = payments.filter((p) => !matchedPaymentIds.has(p.id))
    const unmatchedPaymentsPaise = unmatchedPayments.reduce((sum, p) => sum + toPaise(p.amount), 0)

    // Unmatched active ledger credits
    const activeEntries = ledgerEntries.filter(
      (e) => e.status !== 'struck_out' && e.status !== 'deleted'
    )
    const unmatchedLedger = activeEntries.filter((e) => !matchedLedgerIds.has(e.id))
    const unmatchedLedgerPaise = unmatchedLedger.reduce((sum, e) => sum + toPaise(e.amount), 0)

    return {
      exactDeterministicCount,
      exactDeterministicAmount: exactDeterministicPaise / 100,
      aiAssistedConfirmedCount,
      aiAssistedConfirmedAmount: aiAssistedConfirmedPaise / 100,
      pendingReviewCount,
      rejectedCount,
      unmatchedPaymentsCount: unmatchedPayments.length,
      unmatchedPaymentsAmount: unmatchedPaymentsPaise / 100,
      unmatchedLedgerCount: unmatchedLedger.length,
      unmatchedLedgerAmount: unmatchedLedgerPaise / 100,
    }
  },

  /**
   * Analyzes reminder history metrics
   */
  calculateReminderMetrics(historyItems: ReminderHistoryItem[]): ReminderAnalyticsMetrics {
    let draftCount = 0
    let copiedCount = 0
    let openedInWhatsAppCount = 0
    let followUpScheduledCount = 0
    let dueTodayCount = 0
    let overdueCount = 0
    let upcomingCount = 0
    let archivedCount = 0

    for (const item of historyItems) {
      if (item.status === 'archived') {
        archivedCount++
        continue
      }

      if (item.status === 'draft') draftCount++
      else if (item.status === 'copied') copiedCount++
      else if (item.status === 'opened_in_whatsapp') openedInWhatsAppCount++
      else if (item.status === 'follow_up') followUpScheduledCount++

      if (item.followUpStatus === 'due_today') dueTodayCount++
      else if (item.followUpStatus === 'overdue') overdueCount++
      else if (item.followUpStatus === 'upcoming') upcomingCount++
    }

    return {
      totalSaved: historyItems.length,
      draftCount,
      copiedCount,
      openedInWhatsAppCount,
      followUpScheduledCount,
      dueTodayCount,
      overdueCount,
      upcomingCount,
      archivedCount,
    }
  },

  /**
   * Sanitizes string to prevent CSV spreadsheet formula injection
   * Escapes leading '=', '+', '-', '@', '\t', '\r'
   */
  escapeCsvCell(val: any): string {
    if (val === null || val === undefined) return '""'
    let str = String(val)

    // Formula injection protection
    const dangerousChars = ['=', '+', '-', '@', '\t', '\r']
    if (dangerousChars.some((char) => str.startsWith(char))) {
      str = `'${str}`
    }

    return `"${str.replace(/"/g, '""')}"`
  },

  /**
   * Exports reconciliation summary report as CSV string
   */
  generateReconciliationCsv(
    kpis: FinancialSummaryKPIs,
    insights: ReconciliationMethodInsight
  ): string {
    const rows = [
      ['KhataMatch Financial Reconciliation Summary Report'],
      ['Generated At', new Date().toLocaleString('en-IN')],
      [],
      ['Metric', 'Value'],
      ['Total Ledger Credit Due (Rs)', kpis.totalLedgerAmount.toFixed(2)],
      ['Total Imported Payments (Rs)', kpis.totalImportedPaymentAmount.toFixed(2)],
      ['Total Confirmed Matched (Rs)', kpis.totalConfirmedMatchedAmount.toFixed(2)],
      ['Total Outstanding Balance (Rs)', kpis.totalOutstandingBalance.toFixed(2)],
      ['Reconciliation Completion Rate', `${kpis.reconciliationRatePercent}%`],
      ['Confirmed Matches Count', kpis.confirmedMatchesCount],
      ['Exact Deterministic Matches', insights.exactDeterministicCount],
      ['AI-Assisted Confirmed Matches', insights.aiAssistedConfirmedCount],
      ['Pending Review Matches', insights.pendingReviewCount],
      ['Unmatched Payments Count', kpis.unmatchedPaymentsCount],
      ['Unpaid Ledger Dues Count', kpis.unpaidLedgerCount],
      ['Active Debtors Count', kpis.activeDebtorsCount],
    ]

    return rows.map((row) => row.map(this.escapeCsvCell).join(',')).join('\r\n')
  },

  /**
   * Exports confirmed matches as CSV
   */
  generateConfirmedMatchesCsv(matches: PaymentMatch[]): string {
    const confirmed = matches.filter((m) => m.user_confirmed && m.payment)
    const header = [
      'Payment ID',
      'Payer Name',
      'Payment Date',
      'Payment Amount (Rs)',
      'Reference',
      'Matched Customer Name',
      'Ledger Date',
      'Ledger Amount (Rs)',
      'Matching Method',
      'Confidence',
    ]

    const rows = confirmed.map((m) => {
      const isAi = m.match_type === 'fuzzy' || m.reason.includes('AI') || m.reason.includes('Gemini')
      return [
        m.payment?.id || m.payment_id,
        m.payment?.payer_name || 'Unknown',
        m.payment?.paid_at || '',
        m.payment?.amount.toFixed(2) || '0.00',
        m.payment?.reference || '',
        m.ledger_entry?.customer_name || '',
        m.ledger_entry?.entry_date || '',
        m.ledger_entry?.amount.toFixed(2) || '0.00',
        isAi ? 'AI-Assisted' : 'Deterministic',
        `${Math.round(m.confidence * 100)}%`,
      ]
    })

    return [header.map(this.escapeCsvCell).join(','), ...rows.map((r) => r.map(this.escapeCsvCell).join(','))].join(
      '\r\n'
    )
  },

  /**
   * Exports live outstanding balances as CSV
   */
  generateOutstandingBalancesCsv(balances: LedgerBalanceRecord[]): string {
    const header = [
      'Customer Name',
      'Ledger Date',
      'Original Amount (Rs)',
      'Paid Amount (Rs)',
      'Outstanding Due (Rs)',
      'Status',
      'Latest Payment Date',
      'Allocated Payments Count',
    ]

    const rows = balances.map((b) => [
      b.customerName,
      b.ledgerDate || '',
      b.originalAmount.toFixed(2),
      b.paidAmount.toFixed(2),
      b.outstandingAmount.toFixed(2),
      b.status.replace(/_/g, ' ').toUpperCase(),
      b.latestPaymentDate || 'N/A',
      b.allocatedMatches.length,
    ])

    return [header.map(this.escapeCsvCell).join(','), ...rows.map((r) => r.map(this.escapeCsvCell).join(','))].join(
      '\r\n'
    )
  },

  /**
   * Exports reminder follow-up list as CSV
   */
  generateRemindersCsv(items: ReminderHistoryItem[]): string {
    const header = [
      'Customer Name',
      'Phone',
      'Amount Due (Rs)',
      'Style',
      'Language',
      'Status',
      'Follow-up Status',
      'Next Follow-up Date',
      'Message Text',
      'Shop Notes',
      'Created Date',
    ]

    const rows = items.map((item) => [
      item.customer_name,
      item.phone || '',
      item.amount_due.toFixed(2),
      item.style,
      item.language,
      item.status.replace(/_/g, ' ').toUpperCase(),
      item.followUpStatus || 'unscheduled',
      item.next_follow_up_at || '',
      item.message,
      item.notes || '',
      item.created_at,
    ])

    return [header.map(this.escapeCsvCell).join(','), ...rows.map((r) => r.map(this.escapeCsvCell).join(','))].join(
      '\r\n'
    )
  },

  /**
   * Browser file download helper for CSV
   */
  downloadCsvFile(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },
}
