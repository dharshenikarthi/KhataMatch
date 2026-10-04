import { toPaise } from '../../src/services/deterministicMatchService'

export interface CaseExtractionInput {
  customer_name: string
  amount: number
  entry_date: string
  type?: string
  status?: string
  confidence?: number
}

export interface CaseExpectedExtraction {
  entries_count: number
  entries: {
    customer_name: string
    amount: number
    entry_date: string
    type?: string
  }[]
}

export interface CaseMatchingResult {
  payment_id: string
  ledger_entry_id: string
  rule?: string
  match_type?: string
}

export interface CaseExpectedMatching {
  matches: {
    payment_id: string
    ledger_entry_id: string
    rule?: string
    expected_type?: string
  }[]
  unmatched_payments: string[]
  unmatched_ledger_entries: string[]
}

export interface CaseAiDecisionExpected {
  expected_decision: 'likely_match' | 'uncertain' | 'unlikely_match'
  min_confidence?: number
  max_confidence?: number
}

export interface ExtractionMetrics {
  name_accuracy: number
  amount_accuracy: number
  date_accuracy: number
  complete_row_accuracy: number
  total_evaluated_rows: number
  correct_rows: number
  correct_names: number
  correct_amounts: number
  correct_dates: number
  missing_fields: number
  extra_entries: number
}

export interface MatchingMetrics {
  true_positives: number
  false_positives: number
  false_negatives: number
  precision: number
  recall: number
  f1_score: number
  unmatched_payments_precision: number
  unmatched_ledger_precision: number
}

export interface GeminiMetrics {
  total_ai_cases: number
  correct_decisions: number
  likely_match_accuracy: number
  uncertain_decision_accuracy: number
  rejection_accuracy: number
  overall_ai_accuracy: number
}

export interface EvaluationReport {
  dataset_version: string
  evaluation_mode: 'fixture_deterministic' | 'live_gemini'
  timestamp: string
  total_cases: number
  passed_cases: number
  failed_cases: number
  overall_pass_rate_pct: number
  extraction: ExtractionMetrics
  deterministic_matching: MatchingMetrics
  gemini_matching: GeminiMetrics
  case_results: {
    case_id: string
    name: string
    category: string
    passed: boolean
    extraction_passed: boolean
    matching_passed: boolean
    ai_passed: boolean
    failures: string[]
  }[]
}

/**
 * Normalizes text for extraction evaluation
 * Strips whitespace, case, and benign punctuation
 */
export function normalizeEvalString(val: string | null | undefined): string {
  if (!val) return ''
  return val.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Normalizes date for extraction evaluation (YYYY-MM-DD)
 */
export function normalizeEvalDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const clean = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  // Handle DD/MM/YYYY or DD-MM-YYYY
  const parts = clean.split(/[-/]/)
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
    if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return clean
}

/**
 * Evaluates extraction results against expected ground truth
 */
export function evaluateExtraction(
  actual: CaseExtractionInput[],
  expected: CaseExpectedExtraction
): {
  isCorrect: boolean
  metrics: {
    correctName: boolean
    correctAmount: boolean
    correctDate: boolean
    completeRow: boolean
  }[]
  errors: string[]
} {
  const errors: string[] = []
  const metrics: {
    correctName: boolean
    correctAmount: boolean
    correctDate: boolean
    completeRow: boolean
  }[] = []

  if (actual.length !== expected.entries.length) {
    errors.push(`Row count mismatch: extracted ${actual.length} vs expected ${expected.entries.length}`)
  }

  for (let i = 0; i < expected.entries.length; i++) {
    const expRow = expected.entries[i]
    const actRow = actual[i]

    if (!actRow) {
      metrics.push({ correctName: false, correctAmount: false, correctDate: false, completeRow: false })
      errors.push(`Missing expected row ${i + 1} (${expRow.customer_name})`)
      continue
    }

    const normActName = normalizeEvalString(actRow.customer_name)
    const normExpName = normalizeEvalString(expRow.customer_name)
    const correctName = normActName.length > 0 && (normActName === normExpName || normActName.includes(normExpName) || normExpName.includes(normActName))

    const actPaise = toPaise(actRow.amount)
    const expPaise = toPaise(expRow.amount)
    const correctAmount = actPaise === expPaise

    const normActDate = normalizeEvalDate(actRow.entry_date)
    const normExpDate = normalizeEvalDate(expRow.entry_date)
    const correctDate = !expRow.entry_date || normActDate === normExpDate

    const completeRow = correctName && correctAmount && correctDate

    if (!correctName) errors.push(`Row ${i + 1} name mismatch: "${actRow.customer_name}" vs "${expRow.customer_name}"`)
    if (!correctAmount) errors.push(`Row ${i + 1} amount mismatch: ₹${actRow.amount} vs ₹${expRow.amount}`)
    if (!correctDate) errors.push(`Row ${i + 1} date mismatch: "${actRow.entry_date}" vs "${expRow.entry_date}"`)

    metrics.push({ correctName, correctAmount, correctDate, completeRow })
  }

  const isCorrect = errors.length === 0
  return { isCorrect, metrics, errors }
}

/**
 * Evaluates deterministic matching pairings against expected ground truth
 */
export function evaluateMatching(
  actualMatches: CaseMatchingResult[],
  actualUnmatchedPayments: string[],
  actualUnmatchedLedger: string[],
  expected: CaseExpectedMatching
): {
  isCorrect: boolean
  tp: number
  fp: number
  fn: number
  errors: string[]
} {
  const errors: string[] = []
  let tp = 0
  let fp = 0
  let fn = 0

  const actualPairKeys = new Set(actualMatches.map((m) => `${m.payment_id}:${m.ledger_entry_id}`))
  const expectedPairKeys = new Set(expected.matches.map((m) => `${m.payment_id}:${m.ledger_entry_id}`))

  // Calculate TP and FP
  for (const actualKey of actualPairKeys) {
    if (expectedPairKeys.has(actualKey)) {
      tp++
    } else {
      fp++
      errors.push(`False Positive match generated: ${actualKey}`)
    }
  }

  // Calculate FN
  for (const expectedKey of expectedPairKeys) {
    if (!actualPairKeys.has(expectedKey)) {
      fn++
      errors.push(`False Negative: missed expected match ${expectedKey}`)
    }
  }

  // Check unmatched lists
  const expectedUnmatchedP = new Set(expected.unmatched_payments)
  const actualUnmatchedP = new Set(actualUnmatchedPayments)
  for (const pId of expectedUnmatchedP) {
    if (!actualUnmatchedP.has(pId)) {
      errors.push(`Expected payment ${pId} to be unmatched, but it was matched or missing`)
    }
  }

  const expectedUnmatchedL = new Set(expected.unmatched_ledger_entries)
  const actualUnmatchedL = new Set(actualUnmatchedLedger)
  for (const lId of expectedUnmatchedL) {
    if (!actualUnmatchedL.has(lId)) {
      errors.push(`Expected ledger entry ${lId} to be unmatched, but it was matched or missing`)
    }
  }

  const isCorrect = errors.length === 0
  return { isCorrect, tp, fp, fn, errors }
}

/**
 * Calculates Precision, Recall, and F1 Score
 */
export function calculatePrecisionRecallF1(tp: number, fp: number, fn: number): { precision: number; recall: number; f1_score: number } {
  const precision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(4)) : 1.0
  const recall = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(4)) : 1.0
  const f1_score = precision + recall > 0 ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4)) : 1.0
  return { precision, recall, f1_score }
}
