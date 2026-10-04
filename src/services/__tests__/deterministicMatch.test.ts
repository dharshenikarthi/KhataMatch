import {
  deterministicMatchService,
  normalizeCustomerName,
  isNameMatch,
  toPaise,
  calculateDateDifference,
} from '../deterministicMatchService'
import { LedgerEntry, Payment } from '../../types'

function runTests() {
  console.log('--- STARTING DETERMINISTIC MATCH ENGINE TEST SUITE ---')
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

  // 1. Name Normalization Tests
  assert(
    normalizeCustomerName('Murugan (முருகன் - Rice bag)') === 'murugan',
    'Strips parentheses and annotations'
  )
  assert(
    normalizeCustomerName('UPI-Murugan K') === 'murugan k',
    'Strips UPI prefixes and lowercases'
  )
  assert(
    isNameMatch('Murugan K', 'K. Murugan'),
    'Matches Indian name token permutations'
  )
  assert(
    isNameMatch('Ravi Kumar', 'Ravi Kumar'),
    'Matches identical names'
  )
  assert(
    !isNameMatch('Murugan', 'Lakshmi'),
    'Rejects different names'
  )

  // 2. Currency Precision Tests
  assert(toPaise(1250) === 125000, 'Converts 1250 to 125000 paise')
  assert(toPaise(1250.50) === 125050, 'Converts 1250.50 to 125050 paise accurately')

  // 3. Date Difference Tests
  assert(
    calculateDateDifference('2026-09-12', '2026-09-12') === 0,
    'Calculates same-day difference as 0'
  )
  assert(
    calculateDateDifference('2026-09-14', '2026-09-12') === 2,
    'Calculates 2-day difference correctly'
  )

  // 4. Rule 1: Exact Match Test
  const payment1: Payment = {
    id: 'p1',
    payer_name: 'Murugan K',
    amount: 1250,
    paid_at: '2026-09-12',
    reference: 'UPI1001',
  }
  const entry1: LedgerEntry = {
    id: 'l1',
    customer_name: 'Murugan',
    name_normalized: 'murugan',
    amount: 1250,
    entry_date: '2026-09-10',
    type: 'credit',
    status: 'active',
    confidence: 0.95,
    confirmed: true,
  }

  const cand1 = deterministicMatchService.evaluateCandidate(payment1, entry1, { maxDateWindowDays: 4 })
  assert(cand1 !== null && cand1.rule === 'RULE_1_EXACT_MATCH', 'Rule 1 Exact Match generated')
  assert(cand1 !== null && cand1.confidence >= 0.90, 'Rule 1 Confidence >= 0.90')

  // 5. Rule 2: Exact Name & Amount (Far Date)
  const payment2: Payment = {
    id: 'p2',
    payer_name: 'Ravi Kumar',
    amount: 2000,
    paid_at: '2026-09-28', // 16 days after ledger entry
    reference: 'UPI1002',
  }
  const entry2: LedgerEntry = {
    id: 'l2',
    customer_name: 'Ravi Kumar',
    name_normalized: 'ravi kumar',
    amount: 2000,
    entry_date: '2026-09-12',
    type: 'credit',
    status: 'active',
    confidence: 0.95,
    confirmed: true,
  }

  const cand2 = deterministicMatchService.evaluateCandidate(payment2, entry2, { maxDateWindowDays: 4 })
  assert(cand2 !== null && cand2.rule === 'RULE_2_NAME_AND_AMOUNT', 'Rule 2 Name and Amount with far date gap')

  // 6. Rule 3: Amount & Date Match (Different Name)
  const payment3: Payment = {
    id: 'p3',
    payer_name: 'Unknown Person',
    amount: 800,
    paid_at: '2026-09-13',
    reference: 'UPI1003',
  }
  const entry3: LedgerEntry = {
    id: 'l3',
    customer_name: 'Lakshmi',
    name_normalized: 'lakshmi',
    amount: 800,
    entry_date: '2026-09-11',
    type: 'credit',
    status: 'active',
    confidence: 0.90,
    confirmed: true,
  }

  const cand3 = deterministicMatchService.evaluateCandidate(payment3, entry3, { maxDateWindowDays: 4 })
  assert(cand3 !== null && cand3.rule === 'RULE_3_AMOUNT_AND_DATE', 'Rule 3 Amount and Date match with different name')

  // 7. Rule 4: Partial Evidence (Different Amount)
  const payment4: Payment = {
    id: 'p4',
    payer_name: 'Priya',
    amount: 300,
    paid_at: '2026-09-16',
    reference: 'UPI1004',
  }
  const entry4: LedgerEntry = {
    id: 'l4',
    customer_name: 'Priya',
    name_normalized: 'priya',
    amount: 750,
    entry_date: '2026-09-13',
    type: 'credit',
    status: 'active',
    confidence: 0.90,
    confirmed: true,
  }

  const cand4 = deterministicMatchService.evaluateCandidate(payment4, entry4, { maxDateWindowDays: 4 })
  assert(cand4 !== null && cand4.rule === 'RULE_4_PARTIAL_EVIDENCE', 'Rule 4 Partial payment detection')

  // 8. One-to-One Allocation & Competing Payments Test
  const competingP1: Payment = { id: 'cp1', payer_name: 'Suresh', amount: 1500, paid_at: '2026-09-14', reference: 'UPI901' }
  const competingP2: Payment = { id: 'cp2', payer_name: 'Suresh', amount: 1500, paid_at: '2026-09-14', reference: 'UPI902' }
  const singleEntry: LedgerEntry = {
    id: 'single_l',
    customer_name: 'Suresh',
    name_normalized: 'suresh',
    amount: 1500,
    entry_date: '2026-09-14',
    type: 'credit',
    status: 'active',
    confidence: 0.95,
    confirmed: true,
  }

  const fullResult = deterministicMatchService.runMatching([competingP1, competingP2], [singleEntry])
  const confirmedAllocations = fullResult.matches.filter((m) => m.ledger_entry_id === 'single_l')
  assert(
    confirmedAllocations.length === 1,
    'Enforces 1-to-1 matching constraint (single ledger entry allocated to exactly 1 payment)'
  )
  assert(
    fullResult.unmatchedPayments.length === 1,
    'Unallocated competing payment flagged as unmatched'
  )

  console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

runTests()
