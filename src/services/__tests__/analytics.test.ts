import { analyticsService } from '../analyticsService'
import { balanceTrackingService } from '../balanceTrackingService'
import { LedgerEntry, Payment, PaymentMatch, ReminderHistoryItem } from '../../types'

function runTests() {
  console.log('--- STARTING FINANCIAL ANALYTICS TEST SUITE ---')
  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`)
      passed++
    } else {
      console.error(`✗ FAIL: ${testName}`)
      failed++
    }
  }

  // 1. Fixtures
  const entries: LedgerEntry[] = [
    {
      id: 'l1',
      customer_name: 'Murugan',
      name_normalized: 'murugan',
      amount: 1500,
      entry_date: '2026-09-10',
      type: 'credit',
      status: 'active',
      confidence: 0.95,
      confirmed: true,
    },
    {
      id: 'l2',
      customer_name: 'Priya',
      name_normalized: 'priya',
      amount: 1000,
      entry_date: '2026-09-20',
      type: 'credit',
      status: 'active',
      confidence: 0.95,
      confirmed: true,
    },
    {
      id: 'l3',
      customer_name: 'Suresh',
      name_normalized: 'suresh',
      amount: 500,
      entry_date: '2026-07-01', // 90+ days old relative to 2026-10-04
      type: 'credit',
      status: 'active',
      confidence: 0.95,
      confirmed: true,
    },
  ]

  const payments: Payment[] = [
    {
      id: 'p1',
      payer_name: 'Murugan K',
      amount: 1500,
      paid_at: '2026-09-12',
      reference: 'UPI101',
    },
    {
      id: 'p2',
      payer_name: 'Priya',
      amount: 400,
      paid_at: '2026-09-21',
      reference: 'UPI102',
    },
    {
      id: 'p3',
      payer_name: 'Unknown Person',
      amount: 300,
      paid_at: '2026-09-25',
      reference: 'UPI103',
    },
  ]

  const matches: PaymentMatch[] = [
    {
      id: 'm1',
      payment_id: 'p1',
      ledger_entry_id: 'l1',
      match_type: 'exact',
      confidence: 0.98,
      reason: 'Rule 1 exact match',
      user_confirmed: true,
      status: 'confirmed',
      payment: payments[0],
      ledger_entry: entries[0],
    },
    {
      id: 'm2',
      payment_id: 'p2',
      ledger_entry_id: 'l2',
      match_type: 'fuzzy',
      confidence: 0.85,
      reason: 'AI confirmed partial payment',
      user_confirmed: true,
      status: 'confirmed',
      payment: payments[1],
      ledger_entry: entries[1],
    },
  ]

  const balances = balanceTrackingService.calculateLedgerBalances(entries, matches)

  // 2. Financial Summary KPIs Test
  const kpis = analyticsService.calculateKPIs(entries, payments, matches, balances)
  assert(kpis.totalLedgerAmount === 3000, 'Calculates total ledger credit 3000 (1500 + 1000 + 500)')
  assert(kpis.totalImportedPaymentAmount === 2200, 'Calculates total imported payments 2200 (1500 + 400 + 300)')
  assert(kpis.totalConfirmedMatchedAmount === 1900, 'Calculates confirmed matched amount 1900 (1500 + 400)')
  assert(kpis.totalOutstandingBalance === 1100, 'Calculates live outstanding balance 1100 (600 + 500)')
  assert(kpis.confirmedMatchesCount === 2, 'Counts 2 confirmed matches')
  assert(kpis.unmatchedPaymentsCount === 1, 'Counts 1 unmatched payment (p3)')
  assert(kpis.unpaidLedgerCount === 1, 'Counts 1 fully unpaid ledger due (l3)')
  assert(kpis.partiallyPaidLedgerCount === 1, 'Counts 1 partially paid ledger due (l2)')
  assert(kpis.fullyPaidLedgerCount === 1, 'Counts 1 fully paid ledger due (l1)')
  assert(kpis.reconciliationRatePercent === 63.3, 'Reconciliation rate is 63.3% (1900 / 3000 * 100)')
  assert(kpis.activeDebtorsCount === 2, 'Counts 2 active debtors (Priya, Suresh)')

  // 3. Date Range Filtering Tests
  const referenceDate = '2026-10-04'
  const filter7d = analyticsService.filterByDateRange(entries, '7d', referenceDate)
  assert(filter7d.length === 0, 'No entries in last 7 days')

  const filter30d = analyticsService.filterByDateRange(entries, '30d', referenceDate)
  assert(filter30d.length === 2, 'Includes 2 entries in last 30 days (Sept 10, Sept 20)')

  const filterAll = analyticsService.filterByDateRange(entries, 'all', referenceDate)
  assert(filterAll.length === 3, 'Includes all 3 entries for all-time range')

  // 4. Financial Trends Series Generation
  const trends30d = analyticsService.generateFinancialTrends(entries, payments, matches, '30d', referenceDate)
  assert(trends30d.length > 0, 'Generates time-series trend points for 30d range')
  const totalTrendCredit = trends30d.reduce((sum, t) => sum + t.ledgerCreditAmount, 0)
  assert(totalTrendCredit === 2500, 'Sums 30d credit amount accurately (1500 + 1000 = 2500)')

  // 5. Aging Breakdown Tests
  const aging = analyticsService.calculateAgingBreakdown(balances, referenceDate)
  assert(aging.length === 5, 'Generates 5 aging buckets (0-15d, 16-30d, 31-60d, 61-90d, 90+d)')

  const bucket90Plus = aging.find((b) => b.rangeLabel === '90+ Days')
  assert(bucket90Plus !== undefined && bucket90Plus.totalAmount === 500, 'Places July entry (500) in 90+ Days bucket')

  const bucket0To15 = aging.find((b) => b.rangeLabel === '0–15 Days')
  assert(bucket0To15 !== undefined && bucket0To15.totalAmount === 600, 'Places Priya remaining due (600, 14 days old) in 0-15 Days bucket')

  // 6. Reconciliation Method Insights
  const insights = analyticsService.calculateReconciliationInsights(matches, payments, entries)
  assert(insights.exactDeterministicCount === 1, 'Counts 1 exact deterministic match')
  assert(insights.exactDeterministicAmount === 1500, 'Exact deterministic matched amount is 1500')
  assert(insights.aiAssistedConfirmedCount === 1, 'Counts 1 AI-assisted match')
  assert(insights.aiAssistedConfirmedAmount === 400, 'AI-assisted matched amount is 400')
  assert(insights.unmatchedPaymentsCount === 1, 'Counts 1 unmatched payment')
  assert(insights.unmatchedLedgerCount === 1, 'Counts 1 unmatched active ledger credit')

  // 7. Reminder Analytics Aggregation
  const reminders: ReminderHistoryItem[] = [
    {
      id: 'r1',
      customer_name: 'Priya',
      amount_due: 600,
      message: 'Draft 1',
      style: 'friendly',
      language: 'english',
      status: 'draft',
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
    },
    {
      id: 'r2',
      customer_name: 'Suresh',
      amount_due: 500,
      message: 'Draft 2',
      style: 'professional',
      language: 'english',
      status: 'follow_up',
      followUpStatus: 'due_today',
      next_follow_up_at: '2026-10-04T00:00:00Z',
      created_at: '2026-09-20T00:00:00Z',
      updated_at: '2026-09-20T00:00:00Z',
    },
    {
      id: 'r3',
      customer_name: 'Ravi',
      amount_due: 200,
      message: 'Archived draft',
      style: 'short',
      language: 'tamil',
      status: 'archived',
      followUpStatus: 'completed',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ]

  const rMetrics = analyticsService.calculateReminderMetrics(reminders)
  assert(rMetrics.totalSaved === 3, 'Tracks 3 total saved reminders')
  assert(rMetrics.draftCount === 1, 'Counts 1 draft')
  assert(rMetrics.dueTodayCount === 1, 'Counts 1 follow-up due today')
  assert(rMetrics.archivedCount === 1, 'Counts 1 archived reminder')

  // 8. CSV Export Formatting & Spreadsheet Formula Injection Protection
  const dangerousCell = '=cmd|"/C calc"!A0'
  const escapedDangerous = analyticsService.escapeCsvCell(dangerousCell)
  assert(escapedDangerous.startsWith("\"'="), 'Escapes leading "=" with single quote to prevent formula injection')

  const plusDangerous = '+123456'
  const escapedPlus = analyticsService.escapeCsvCell(plusDangerous)
  assert(escapedPlus.startsWith("\"'+"), 'Escapes leading "+" with single quote to prevent CSV injection')

  const normalCell = 'Murugan Textiles'
  const escapedNormal = analyticsService.escapeCsvCell(normalCell)
  assert(escapedNormal === '"Murugan Textiles"', 'Properly quotes standard string')

  const csvSummary = analyticsService.generateReconciliationCsv(kpis, insights)
  assert(csvSummary.includes('Total Ledger Credit Due (Rs)'), 'Generates Reconciliation Summary CSV header')
  assert(csvSummary.includes('3000.00'), 'Contains formatted ledger amount in CSV')
  assert(csvSummary.includes('63.3%'), 'Contains reconciliation rate in CSV')

  const csvBalances = analyticsService.generateOutstandingBalancesCsv(balances)
  assert(csvBalances.includes('Outstanding Due (Rs)'), 'Generates Outstanding Balances CSV header')
  assert(csvBalances.includes('Priya'), 'Contains debtor name in CSV')

  // 9. Empty Dataset & Zero State Handling
  const emptyKpis = analyticsService.calculateKPIs([], [], [], [])
  assert(emptyKpis.totalLedgerAmount === 0, 'Handles empty ledger entries cleanly (0)')
  assert(emptyKpis.reconciliationRatePercent === 0, 'Reconciliation rate is 0% when no ledger entries exist')

  const emptyTrends = analyticsService.generateFinancialTrends([], [], [], '30d')
  assert(emptyTrends.length === 0, 'Returns empty array for empty trends')

  console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

runTests()
