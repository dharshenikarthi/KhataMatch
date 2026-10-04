import { aiMatchService, CandidatePairInput, AiSuggestionOutput } from '../aiMatchService'
import { PaymentMatch, Payment, LedgerEntry } from '../../types'

function runAiMatchTests() {
  console.log('--- STARTING AI MATCHING SERVICE TEST SUITE ---')
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

  // 1. Candidate Selection Tests
  const confirmedMatch: PaymentMatch = {
    id: 'm1',
    payment_id: 'p1',
    ledger_entry_id: 'l1',
    match_type: 'exact',
    confidence: 1.0,
    reason: 'Exact match',
    user_confirmed: true,
    rule: 'RULE_1_EXACT_MATCH',
    payment: { id: 'p1', payer_name: 'Murugan', amount: 1250, paid_at: '2026-09-12', reference: 'UPI1' },
    ledger_entry: { id: 'l1', customer_name: 'Murugan', name_normalized: 'murugan', amount: 1250, entry_date: '2026-09-12', type: 'credit', status: 'active', confidence: 1.0, confirmed: true },
  }

  const strongMatch: PaymentMatch = {
    id: 'm2',
    payment_id: 'p2',
    ledger_entry_id: 'l2',
    match_type: 'exact',
    confidence: 0.98,
    reason: 'Exact rule 1 match',
    user_confirmed: false,
    rule: 'RULE_1_EXACT_MATCH',
    payment: { id: 'p2', payer_name: 'Ravi Kumar', amount: 2000, paid_at: '2026-09-14', reference: 'UPI2' },
    ledger_entry: { id: 'l2', customer_name: 'Ravi Kumar', name_normalized: 'ravi kumar', amount: 2000, entry_date: '2026-09-14', type: 'credit', status: 'active', confidence: 1.0, confirmed: false },
  }

  const ambiguousMatch: PaymentMatch = {
    id: 'm3',
    payment_id: 'p3',
    ledger_entry_id: 'l3',
    match_type: 'ambiguous',
    confidence: 0.72,
    reason: 'Rule 3 different names',
    user_confirmed: false,
    rule: 'RULE_3_AMOUNT_AND_DATE',
    payment: { id: 'p3', payer_name: 'Murugan K', amount: 1250, paid_at: '2026-09-16', reference: 'UPI3' },
    ledger_entry: { id: 'l3', customer_name: 'K. Murugan', name_normalized: 'k murugan', amount: 1250, entry_date: '2026-09-16', type: 'credit', status: 'active', confidence: 0.72, confirmed: false },
  }

  const partialMatch: PaymentMatch = {
    id: 'm4',
    payment_id: 'p4',
    ledger_entry_id: 'l4',
    match_type: 'ambiguous',
    confidence: 0.65,
    reason: 'Rule 4 partial payment',
    user_confirmed: false,
    rule: 'RULE_4_PARTIAL_EVIDENCE',
    payment: { id: 'p4', payer_name: 'Priya', amount: 300, paid_at: '2026-09-16', reference: 'UPI4' },
    ledger_entry: { id: 'l4', customer_name: 'Priya', name_normalized: 'priya', amount: 750, entry_date: '2026-09-13', type: 'credit', status: 'active', confidence: 0.90, confirmed: false },
  }

  const payments = [confirmedMatch.payment!, strongMatch.payment!, ambiguousMatch.payment!, partialMatch.payment!]
  const ledger = [confirmedMatch.ledger_entry!, strongMatch.ledger_entry!, ambiguousMatch.ledger_entry!, partialMatch.ledger_entry!]
  const allMatches = [confirmedMatch, strongMatch, ambiguousMatch, partialMatch]

  const selectedPairs = aiMatchService.selectAmbiguousCandidates(allMatches, payments, ledger)

  assert(
    !selectedPairs.some((p) => p.payment_id === 'p1'),
    'Excludes confirmed match from AI candidates'
  )
  assert(
    !selectedPairs.some((p) => p.payment_id === 'p2'),
    'Excludes strong Rule 1 exact match from AI candidates'
  )
  assert(
    selectedPairs.some((p) => p.payment_id === 'p3' && p.ledger_entry_id === 'l3'),
    'Includes ambiguous naming candidate for Gemini evaluation'
  )
  assert(
    selectedPairs.some((p) => p.payment_id === 'p4' && p.ledger_entry_id === 'l4'),
    'Includes partial payment candidate for Gemini evaluation'
  )

  // 2. AI Suggestions Merge & Update Tests
  const mockSuggestions: AiSuggestionOutput[] = [
    {
      payment_id: 'p3',
      ledger_entry_id: 'l3',
      decision: 'likely_match',
      confidence_category: 'high',
      confidence: 0.93,
      reasons: ['Indian naming permutation match between Murugan K and K. Murugan.'],
      warnings: [],
    },
    {
      payment_id: 'p4',
      ledger_entry_id: 'l4',
      decision: 'likely_match',
      confidence_category: 'high',
      confidence: 0.89,
      reasons: ['Priya installment payment of ₹300 against ₹750 due.'],
      warnings: ['Leaves ₹450 balance due.'],
    },
  ]

  const merged = aiMatchService.mergeAiSuggestionsIntoMatches(allMatches, mockSuggestions, ledger)
  const updatedP3 = merged.find((m) => m.payment_id === 'p3')
  const updatedP4 = merged.find((m) => m.payment_id === 'p4')

  assert(
    updatedP3 !== undefined && updatedP3.confidence === 0.93,
    'Updates confidence score using Gemini assessment'
  )
  assert(
    updatedP3 !== undefined && updatedP3.reason.includes('Murugan'),
    'Appends AI explainable rationale'
  )
  assert(
    updatedP4 !== undefined && updatedP4.reason.includes('installment'),
    'Captures partial payment context in reason'
  )
  assert(
    updatedP3 !== undefined && updatedP3.user_confirmed === false,
    'Human in control: Gemini never automatically sets user_confirmed to true'
  )

  console.log(`\nAI MATCH TEST SUMMARY: ${passed} passed, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

runAiMatchTests()
