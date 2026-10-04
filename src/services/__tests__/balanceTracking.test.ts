import { balanceTrackingService } from '../balanceTrackingService'
import { LedgerEntry, Payment, PaymentMatch } from '../../types'

function runTests() {
  console.log('--- STARTING BALANCE TRACKING SERVICE TEST SUITE ---')
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

  // 1. Fully Unpaid Ledger Entry
  const entryUnpaid: LedgerEntry = {
    id: 'l_unpaid',
    customer_name: 'Murugan K',
    name_normalized: 'murugan k',
    amount: 1500,
    entry_date: '2026-09-10',
    type: 'credit',
    status: 'active',
    confidence: 0.95,
    confirmed: true,
  }

  const resUnpaid = balanceTrackingService.calculateLedgerBalances([entryUnpaid], [])
  assert(resUnpaid.length === 1, 'Returns 1 balance record for unpaid entry')
  assert(resUnpaid[0].originalAmount === 1500, 'Original amount is 1500')
  assert(resUnpaid[0].paidAmount === 0, 'Paid amount is 0 for unpaid entry')
  assert(resUnpaid[0].outstandingAmount === 1500, 'Outstanding amount equals original 1500')
  assert(resUnpaid[0].status === 'unpaid', 'Status is "unpaid"')

  // 2. Fully Paid Ledger Entry
  const entryPaid: LedgerEntry = {
    id: 'l_paid',
    customer_name: 'Ravi Kumar',
    name_normalized: 'ravi kumar',
    amount: 2000,
    entry_date: '2026-09-12',
    type: 'credit',
    status: 'active',
    confidence: 0.95,
    confirmed: true,
  }
  const paymentPaid: Payment = {
    id: 'p_paid',
    payer_name: 'Ravi Kumar',
    amount: 2000,
    paid_at: '2026-09-12',
    reference: 'UPI2001',
  }
  const matchConfirmed: PaymentMatch = {
    id: 'm_confirmed',
    payment_id: 'p_paid',
    ledger_entry_id: 'l_paid',
    match_type: 'exact',
    confidence: 0.98,
    reason: 'Exact match',
    user_confirmed: true,
    status: 'confirmed',
    payment: paymentPaid,
    ledger_entry: entryPaid,
  }

  const resPaid = balanceTrackingService.calculateLedgerBalances([entryPaid], [matchConfirmed])
  assert(resPaid[0].paidAmount === 2000, 'Paid amount is 2000')
  assert(resPaid[0].outstandingAmount === 0, 'Outstanding amount is 0 for fully paid')
  assert(resPaid[0].status === 'fully_paid', 'Status is "fully_paid"')
  assert(resPaid[0].latestPaymentDate === '2026-09-12', 'Latest payment date is correctly tracked')

  // 3. Partial Payment
  const entryPartial: LedgerEntry = {
    id: 'l_partial',
    customer_name: 'Priya',
    name_normalized: 'priya',
    amount: 1000,
    entry_date: '2026-09-10',
    type: 'credit',
    status: 'active',
    confidence: 0.95,
    confirmed: true,
  }
  const paymentPartial: Payment = {
    id: 'p_partial',
    payer_name: 'Priya',
    amount: 400,
    paid_at: '2026-09-11',
    reference: 'UPI3001',
  }
  const matchPartial: PaymentMatch = {
    id: 'm_partial',
    payment_id: 'p_partial',
    ledger_entry_id: 'l_partial',
    match_type: 'fuzzy',
    confidence: 0.85,
    reason: 'Partial payment',
    user_confirmed: true,
    status: 'confirmed',
    payment: paymentPartial,
    ledger_entry: entryPartial,
  }

  const resPartial = balanceTrackingService.calculateLedgerBalances([entryPartial], [matchPartial])
  assert(resPartial[0].paidAmount === 400, 'Partial paid amount is 400')
  assert(resPartial[0].outstandingAmount === 600, 'Outstanding balance is 600 (1000 - 400)')
  assert(resPartial[0].status === 'partially_paid', 'Status is "partially_paid"')

  // 4. Multiple Confirmed Payments contributing to one entry
  const paymentPartial2: Payment = {
    id: 'p_partial2',
    payer_name: 'Priya',
    amount: 600,
    paid_at: '2026-09-15',
    reference: 'UPI3002',
  }
  const matchPartial2: PaymentMatch = {
    id: 'm_partial2',
    payment_id: 'p_partial2',
    ledger_entry_id: 'l_partial',
    match_type: 'fuzzy',
    confidence: 0.85,
    reason: 'Second payment instalment',
    user_confirmed: true,
    status: 'confirmed',
    payment: paymentPartial2,
    ledger_entry: entryPartial,
  }

  const resMulti = balanceTrackingService.calculateLedgerBalances([entryPartial], [matchPartial, matchPartial2])
  assert(resMulti[0].paidAmount === 1000, 'Multiple payments sum to 1000 (400 + 600)')
  assert(resMulti[0].outstandingAmount === 0, 'Multiple payments fully settle the 1000 due')
  assert(resMulti[0].status === 'fully_paid', 'Status becomes fully_paid after second instalment')
  assert(resMulti[0].latestPaymentDate === '2026-09-15', 'Latest payment date is updated to newest instalment')

  // 5. Overpayment
  const entryOverpaid: LedgerEntry = {
    id: 'l_over',
    customer_name: 'Suresh',
    name_normalized: 'suresh',
    amount: 500,
    entry_date: '2026-09-10',
    type: 'credit',
    status: 'active',
    confidence: 0.95,
    confirmed: true,
  }
  const paymentOver: Payment = {
    id: 'p_over',
    payer_name: 'Suresh',
    amount: 650,
    paid_at: '2026-09-12',
    reference: 'UPI5001',
  }
  const matchOver: PaymentMatch = {
    id: 'm_over',
    payment_id: 'p_over',
    ledger_entry_id: 'l_over',
    match_type: 'exact',
    confidence: 0.95,
    reason: 'Overpayment received',
    user_confirmed: true,
    status: 'confirmed',
    payment: paymentOver,
    ledger_entry: entryOverpaid,
  }

  const resOver = balanceTrackingService.calculateLedgerBalances([entryOverpaid], [matchOver])
  assert(resOver[0].paidAmount === 650, 'Overpaid amount is 650')
  assert(resOver[0].outstandingAmount === 0, 'Outstanding amount is clamped to 0 (never negative)')
  assert(resOver[0].status === 'overpaid', 'Status is "overpaid"')

  // 6. Unconfirmed and Rejected suggestions do NOT affect balances
  const matchPendingAi: PaymentMatch = {
    id: 'm_pending_ai',
    payment_id: 'p_pend',
    ledger_entry_id: 'l_unpaid',
    match_type: 'fuzzy',
    confidence: 0.80,
    reason: 'AI suggestion awaiting confirmation',
    user_confirmed: false, // NOT confirmed
    status: 'suggested',
    payment: { id: 'p_pend', payer_name: 'Murugan', amount: 1500, paid_at: '2026-09-12', reference: 'UPI_P' },
    ledger_entry: entryUnpaid,
  }
  const matchRejected: PaymentMatch = {
    id: 'm_rej',
    payment_id: 'p_rej',
    ledger_entry_id: 'l_unpaid',
    match_type: 'fuzzy',
    confidence: 0.50,
    reason: 'Rejected wrong match',
    user_confirmed: false,
    status: 'rejected',
    payment: { id: 'p_rej', payer_name: 'Muthu', amount: 1500, paid_at: '2026-09-12', reference: 'UPI_R' },
    ledger_entry: entryUnpaid,
  }

  const resIsolation = balanceTrackingService.calculateLedgerBalances(
    [entryUnpaid],
    [matchPendingAi, matchRejected]
  )
  assert(resIsolation[0].paidAmount === 0, 'Unconfirmed & rejected suggestions do NOT count toward paid amount')
  assert(resIsolation[0].outstandingAmount === 1500, 'Outstanding balance remains 1500')
  assert(resIsolation[0].status === 'unpaid', 'Status remains unpaid')

  // 7. Currency Precision (Paise calculation avoiding floating point leak)
  const entryPrecise: LedgerEntry = {
    id: 'l_prec',
    customer_name: 'Kavitha',
    name_normalized: 'kavitha',
    amount: 1250.75,
    entry_date: '2026-09-10',
    type: 'credit',
    status: 'active',
    confidence: 0.95,
    confirmed: true,
  }
  const paymentPrecise: Payment = {
    id: 'p_prec',
    payer_name: 'Kavitha',
    amount: 250.25,
    paid_at: '2026-09-12',
    reference: 'UPI_PREC',
  }
  const matchPrecise: PaymentMatch = {
    id: 'm_prec',
    payment_id: 'p_prec',
    ledger_entry_id: 'l_prec',
    match_type: 'fuzzy',
    confidence: 0.9,
    reason: 'Partial payment with paise',
    user_confirmed: true,
    status: 'confirmed',
    payment: paymentPrecise,
    ledger_entry: entryPrecise,
  }

  const resPrecise = balanceTrackingService.calculateLedgerBalances([entryPrecise], [matchPrecise])
  assert(resPrecise[0].outstandingAmount === 1000.5, 'Paise math calculates 1250.75 - 250.25 = 1000.50 exactly')

  // 8. Customer Aggregation & Portfolio Summary
  const allBalances = [
    resUnpaid[0],
    resPaid[0],
    resPartial[0],
    resOver[0],
  ]

  const portfolio = balanceTrackingService.calculatePortfolioSummary(allBalances)
  assert(portfolio.totalLedgerEntries === 4, 'Portfolio tracks 4 ledger entries')
  assert(portfolio.unpaidCount === 1, 'Tracks 1 unpaid entry')
  assert(portfolio.fullyPaidCount === 1, 'Tracks 1 fully paid entry')
  assert(portfolio.partiallyPaidCount === 1, 'Tracks 1 partially paid entry')
  assert(portfolio.overpaidCount === 1, 'Tracks 1 overpaid entry')
  assert(portfolio.totalOutstandingAmount === 2100, 'Total outstanding is 1500 (unpaid) + 600 (partial) = 2100')

  const custAgg = balanceTrackingService.aggregateCustomerBalances(allBalances)
  assert(custAgg.length === 4, 'Aggregates across 4 distinct customers')

  console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

runTests()
