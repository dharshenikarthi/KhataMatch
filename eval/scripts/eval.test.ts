import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  normalizeEvalString,
  normalizeEvalDate,
  evaluateExtraction,
  evaluateMatching,
  calculatePrecisionRecallF1,
} from './calculate-metrics'
import { runFullEvaluation } from './run-evaluation'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let passCount = 0
let failCount = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passCount++
    console.log(`✓ PASS: ${testName}`)
  } else {
    failCount++
    console.error(`✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`)
  }
}

console.log('--- STARTING EVALUATION & ACCURACY FRAMEWORK TEST SUITE ---')

// 1. Text normalization tests
assert(normalizeEvalString('  Ravi   Kumar  ') === 'ravi kumar', 'Normalizes whitespace and case')
assert(normalizeEvalString('Murugan (Tailor)') === 'murugan (tailor)', 'Preserves text tokens in lowercase')
assert(normalizeEvalString('') === '', 'Handles empty string safely')
assert(normalizeEvalString(null) === '', 'Handles null string safely')

// 2. Date normalization tests
assert(normalizeEvalDate('2026-09-15') === '2026-09-15', 'Preserves standard ISO YYYY-MM-DD date')
assert(normalizeEvalDate('15/09/2026') === '2026-09-15', 'Normalizes DD/MM/YYYY slash format to ISO')
assert(normalizeEvalDate('15-09-2026') === '2026-09-15', 'Normalizes DD-MM-YYYY dash format to ISO')
assert(normalizeEvalDate('') === '', 'Handles empty date safely')
assert(normalizeEvalDate(null) === '', 'Handles null date safely')

// 3. Extraction evaluation logic
const actualExt = [
  { customer_name: 'Suresh Kumar', amount: 1200, entry_date: '2026-09-01' },
  { customer_name: 'Priya', amount: 800, entry_date: '2026-09-02' }
]
const expectedExt = {
  entries_count: 2,
  entries: [
    { customer_name: 'SURESH KUMAR', amount: 1200, entry_date: '2026-09-01' },
    { customer_name: 'Priya', amount: 800, entry_date: '2026-09-02' }
  ]
}
const extResult = evaluateExtraction(actualExt, expectedExt)
assert(extResult.isCorrect === true, 'Extraction comparison succeeds with case-insensitive name match')
assert(extResult.metrics.length === 2, 'Evaluates all 2 expected rows')
assert(extResult.metrics[0].completeRow === true, 'Flags row 1 as complete row match')

// 4. Extraction mismatch detection
const badExt = [
  { customer_name: 'Suresh Kumar', amount: 1100, entry_date: '2026-09-01' } // Wrong amount 1100 != 1200
]
const badExtResult = evaluateExtraction(badExt, expectedExt)
assert(badExtResult.isCorrect === false, 'Detects amount mismatch correctly')
assert(badExtResult.metrics[0].correctAmount === false, 'Flags incorrect amount')

// 5. Matching precision, recall, and F1 calculation
const prf1 = calculatePrecisionRecallF1(20, 0, 0)
assert(prf1.precision === 1.0, 'Precision is 1.0 when 0 False Positives')
assert(prf1.recall === 1.0, 'Recall is 1.0 when 0 False Negatives')
assert(prf1.f1_score === 1.0, 'F1 score is 1.0 for perfect matching')

const imperfectPrf = calculatePrecisionRecallF1(8, 2, 0) // 8 TP, 2 FP -> Precision 8/10 = 0.8
assert(imperfectPrf.precision === 0.8, 'Precision is 0.8 when 2 FP exist')
assert(imperfectPrf.recall === 1.0, 'Recall remains 1.0 with 0 FN')
assert(imperfectPrf.f1_score === 0.8889, 'Calculates correct harmonic mean F1 score')

// 6. Matching evaluation logic
const actualMatches = [
  { payment_id: 'p1', ledger_entry_id: 'l1' },
  { payment_id: 'p2', ledger_entry_id: 'l2' }
]
const expectedMatching = {
  matches: [
    { payment_id: 'p1', ledger_entry_id: 'l1' },
    { payment_id: 'p2', ledger_entry_id: 'l2' }
  ],
  unmatched_payments: [],
  unmatched_ledger_entries: []
}
const matchEval = evaluateMatching(actualMatches, [], [], expectedMatching)
assert(matchEval.isCorrect === true, 'Matches evaluated correctly for exact pairs')
assert(matchEval.tp === 2, 'Calculates 2 True Positives')
assert(matchEval.fp === 0, 'Calculates 0 False Positives')
assert(matchEval.fn === 0, 'Calculates 0 False Negatives')

// 7. Dataset schema validation (All 25 cases present & valid)
const datasetPath = path.resolve(__dirname, '../dataset/cases.json')
assert(fs.existsSync(datasetPath), 'Dataset file cases.json exists on disk')
const rawCases = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'))
assert(Array.isArray(rawCases), 'Dataset parses into an array')
assert(rawCases.length === 25, 'Dataset contains exactly 25 synthetic test cases')

for (let i = 0; i < rawCases.length; i++) {
  const c = rawCases[i]
  assert(Boolean(c.id && c.name && c.category && c.inputs && c.expected), `Case ${c.id || i + 1} has valid schema structure`)
  assert(Array.isArray(c.inputs.ledger_raw), `Case ${c.id} contains ledger_raw array`)
  assert(Array.isArray(c.inputs.payments_raw), `Case ${c.id} contains payments_raw array`)
  assert(typeof c.expected.extraction === 'object', `Case ${c.id} contains extraction expectations`)
  assert(typeof c.expected.matching === 'object', `Case ${c.id} contains matching expectations`)
}

// 8. One-to-one matching constraint test on competing payments
const case11 = rawCases.find((c: any) => c.id === 'case11')
assert(Boolean(case11), 'Case 11 (competing payments) is in dataset')
assert(case11.inputs.payments_raw.length === 2, 'Case 11 provides 2 competing payments')
assert(case11.expected.matching.matches.length === 1, 'Case 11 expects exactly 1 positive match (enforcing 1-to-1)')
assert(case11.expected.matching.unmatched_payments.length === 1, 'Case 11 flags remaining payment as unmatched')

// 9. Full evaluation runner execution
async function runAsyncTests() {
  const report = await runFullEvaluation()
  assert(report.total_cases === 25, 'Full evaluation reports 25 total cases')
  assert(report.passed_cases === 25, 'All 25 synthetic cases pass evaluation')
  assert(report.failed_cases === 0, 'Zero failed cases in evaluation run')
  assert(report.overall_pass_rate_pct === 100, 'Overall pass rate is 100%')
  assert(report.deterministic_matching.precision === 1.0, 'Matching precision is 1.0')
  assert(report.deterministic_matching.recall === 1.0, 'Matching recall is 1.0')
  assert(report.deterministic_matching.f1_score === 1.0, 'Matching F1 is 1.0')
  assert(report.extraction.complete_row_accuracy === 1.0, 'Complete row extraction accuracy is 1.0')
  assert(report.gemini_matching.overall_ai_accuracy === 1.0, 'Gemini ambiguous decision accuracy is 1.0')
  assert(fs.existsSync(path.resolve(__dirname, '../results/latest-report.json')), 'Saved latest-report.json successfully')

  console.log(`\nTEST SUMMARY: ${passCount} passed, ${failCount} failed.`)
  if (failCount > 0) {
    process.exit(1)
  }
}

runAsyncTests().catch((err) => {
  console.error('Async eval tests failed:', err)
  process.exit(1)
})
