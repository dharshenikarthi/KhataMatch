import { LedgerEntry, Payment, PaymentMatch, DeterministicRuleType } from '../types'

export interface MatchEngineOptions {
  maxDateWindowDays?: number // Default: 4 days for close date proximity
}

export interface MatchCandidate {
  payment: Payment
  ledgerEntry: LedgerEntry
  rule: DeterministicRuleType
  confidence: number
  reason: string
  dateDiffDays: number | null
}

export interface MatchEngineResult {
  matches: PaymentMatch[]
  unmatchedPayments: Payment[]
  unmatchedLedgerEntries: LedgerEntry[]
  totalConfirmedAmount: number
  matchedCount: number
  unmatchedCount: number
}

/**
 * Normalizes customer or payer names for robust deterministic matching
 * - Removes parentheses/annotations (e.g. "Murugan (முருகன்)" -> "Murugan")
 * - Removes prefixes ("UPI-", "UPI/")
 * - Trims, lowercases, and collapses whitespace
 * - Strips punctuation like dots and dashes
 */
export function normalizeCustomerName(rawName: string | null | undefined): string {
  if (!rawName) return ''

  let str = rawName

  // 1. Strip text inside parentheses e.g. (முருகன் - Rice bag) or (Tailor)
  str = str.replace(/\([^)]*\)/g, ' ')

  // 2. Strip leading UPI prefixes e.g. UPI-Murugan or UPI/1234
  str = str.replace(/^UPI[-/\s]+/i, '')

  // 3. Lowercase & replace punctuation with space
  str = str.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')

  // 4. Collapse whitespace
  str = str.replace(/\s+/g, ' ').trim()

  return str
}

/**
 * Checks if two normalized name strings are considered an exact token or string match
 * e.g. "murugan k" vs "k murugan" or "ravi kumar" vs "ravi kumar"
 */
export function isNameMatch(nameA: string, nameB: string): boolean {
  const normA = normalizeCustomerName(nameA)
  const normB = normalizeCustomerName(nameB)

  if (!normA || !normB) return false
  if (normA === normB) return true

  // Check token set equality for Indian name variations e.g. "Murugan K" vs "K Murugan"
  const tokensA = normA.split(' ').filter(Boolean).sort().join(' ')
  const tokensB = normB.split(' ').filter(Boolean).sort().join(' ')

  if (tokensA === tokensB) return true

  // Check single-token initial match e.g. "murugan" vs "murugan k"
  const setA = new Set(normA.split(' ').filter(Boolean))
  const setB = new Set(normB.split(' ').filter(Boolean))

  const intersect = new Set([...setA].filter((x) => setB.has(x)))
  const longerLength = Math.max(setA.size, setB.size)
  if (intersect.size >= 1 && longerLength <= 2) {
    // Shared primary name token with single-letter initial
    const singleLetterA = [...setA].some((t) => t.length === 1)
    const singleLetterB = [...setB].some((t) => t.length === 1)
    if (singleLetterA || singleLetterB) {
      return true
    }
  }

  return false
}

/**
 * Converts currency amount to integer paise (minor units) to prevent floating-point inequality
 */
export function toPaise(amount: number | null | undefined): number {
  if (amount === null || amount === undefined || isNaN(amount)) return 0
  return Math.round(Number(amount) * 100)
}

/**
 * Calculates absolute calendar day difference between payment date and ledger entry date
 */
export function calculateDateDifference(
  paymentDateStr: string | null | undefined,
  ledgerDateStr: string | null | undefined
): number | null {
  if (!paymentDateStr || !ledgerDateStr) return null

  const pDate = new Date(paymentDateStr)
  const lDate = new Date(ledgerDateStr)

  if (isNaN(pDate.getTime()) || isNaN(lDate.getTime())) return null

  // Normalize to UTC midnight
  const utcP = Date.UTC(pDate.getFullYear(), pDate.getMonth(), pDate.getDate())
  const utcL = Date.UTC(lDate.getFullYear(), lDate.getMonth(), lDate.getDate())

  const diffMs = Math.abs(utcP - utcL)
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export const deterministicMatchService = {
  /**
   * Evaluates candidate match strength between a single payment and a single ledger entry
   */
  evaluateCandidate(
    payment: Payment,
    ledgerEntry: LedgerEntry,
    options: MatchEngineOptions = {}
  ): MatchCandidate | null {
    const maxWindow = options.maxDateWindowDays ?? 4

    const paymentPaise = toPaise(payment.amount)
    const ledgerPaise = toPaise(ledgerEntry.amount)
    const isAmountEqual = paymentPaise === ledgerPaise

    const nameMatches = isNameMatch(payment.payer_name, ledgerEntry.customer_name)
    const dateDiff = calculateDateDifference(payment.paid_at, ledgerEntry.entry_date)
    const isCloseDate = dateDiff !== null && dateDiff <= maxWindow

    // ----------------------------------------------------
    // RULE 1: Exact Match (Name + Amount + Close Date)
    // ----------------------------------------------------
    if (nameMatches && isAmountEqual && (isCloseDate || dateDiff === null)) {
      let confidence = 0.98
      if (dateDiff === 0) confidence = 1.00
      else if (dateDiff === 1) confidence = 0.98
      else if (dateDiff !== null) confidence = Math.max(0.92, 0.98 - dateDiff * 0.02)

      const dateText = dateDiff === 0 ? 'same day' : dateDiff !== null ? `${dateDiff} days apart` : 'dates not specified'

      return {
        payment,
        ledgerEntry,
        rule: 'RULE_1_EXACT_MATCH',
        confidence,
        reason: `Exact customer name and payment amount match (₹${payment.amount}); dates are ${dateText}.`,
        dateDiffDays: dateDiff,
      }
    }

    // ----------------------------------------------------
    // RULE 2: Exact Name and Amount (Larger Date Gap)
    // ----------------------------------------------------
    if (nameMatches && isAmountEqual && dateDiff !== null && dateDiff > maxWindow) {
      const confidence = Math.max(0.80, 0.90 - Math.min(dateDiff, 30) * 0.003)
      return {
        payment,
        ledgerEntry,
        rule: 'RULE_2_NAME_AND_AMOUNT',
        confidence,
        reason: `Customer name and exact amount match (₹${payment.amount}), but payment was made ${dateDiff} days after the ledger date.`,
        dateDiffDays: dateDiff,
      }
    }

    // ----------------------------------------------------
    // RULE 3: Amount and Date Match (Payer Name Differs)
    // ----------------------------------------------------
    if (isAmountEqual && isCloseDate && !nameMatches) {
      const confidence = 0.74 // < 0.75 Needs Review
      const dateText = dateDiff === 0 ? 'same day' : `${dateDiff} days apart`
      return {
        payment,
        ledgerEntry,
        rule: 'RULE_3_AMOUNT_AND_DATE',
        confidence,
        reason: `Payment amount (₹${payment.amount}) and date (${dateText}) match, but payer name '${payment.payer_name}' differs from ledger customer '${ledgerEntry.customer_name}'.`,
        dateDiffDays: dateDiff,
      }
    }

    // ----------------------------------------------------
    // RULE 4: Partial Evidence (Name match with different amount, or amount match with far date)
    // ----------------------------------------------------
    if (nameMatches && !isAmountEqual) {
      const confidence = 0.65 // < 0.75 Needs Review
      const diffAmount = payment.amount - ledgerEntry.amount
      const diffText = diffAmount < 0 ? `Partial payment (₹${Math.abs(diffAmount)} remaining)` : `Overpayment of ₹${diffAmount}`
      return {
        payment,
        ledgerEntry,
        rule: 'RULE_4_PARTIAL_EVIDENCE',
        confidence,
        reason: `Customer name matches, but payment amount (₹${payment.amount}) differs from ledger due (₹${ledgerEntry.amount}). ${diffText}.`,
        dateDiffDays: dateDiff,
      }
    }

    return null
  },

  /**
   * Executes deterministic payment matching for all payments against all active ledger entries
   * Enforces strict 1-to-1 matching constraints without duplicate allocations
   */
  runMatching(
    payments: Payment[],
    ledgerEntries: LedgerEntry[],
    options: MatchEngineOptions = {}
  ): MatchEngineResult {
    // Filter active/confirmed entries (exclude struck-out or deleted entries)
    const validLedgerEntries = ledgerEntries.filter((e) => e.status !== 'struck_out' && e.status !== 'deleted')

    // 1. Generate all candidate match pairs
    const allCandidates: MatchCandidate[] = []

    for (const payment of payments) {
      for (const entry of validLedgerEntries) {
        const candidate = this.evaluateCandidate(payment, entry, options)
        if (candidate) {
          allCandidates.push(candidate)
        }
      }
    }

    // 2. Sort candidate pairs by priority & confidence descending
    const rulePriority: Record<DeterministicRuleType, number> = {
      RULE_1_EXACT_MATCH: 1,
      RULE_2_NAME_AND_AMOUNT: 2,
      RULE_3_AMOUNT_AND_DATE: 3,
      RULE_4_PARTIAL_EVIDENCE: 4,
      UNMATCHED: 5,
    }

    allCandidates.sort((a, b) => {
      const pA = rulePriority[a.rule] || 99
      const pB = rulePriority[b.rule] || 99
      if (pA !== pB) return pA - pB

      if (b.confidence !== a.confidence) return b.confidence - a.confidence

      const diffA = a.dateDiffDays ?? 999
      const diffB = b.dateDiffDays ?? 999
      return diffA - diffB
    })

    // 3. Allocate matches ensuring 1-to-1 constraint (Greedy optimal allocation)
    const allocatedPaymentIds = new Set<string>()
    const allocatedLedgerIds = new Set<string>()
    const matchedResults: PaymentMatch[] = []

    for (const candidate of allCandidates) {
      const pId = candidate.payment.id
      const lId = candidate.ledgerEntry.id

      if (!allocatedPaymentIds.has(pId) && !allocatedLedgerIds.has(lId)) {
        allocatedPaymentIds.add(pId)
        allocatedLedgerIds.add(lId)

        const matchType = candidate.rule === 'RULE_1_EXACT_MATCH' || candidate.rule === 'RULE_2_NAME_AND_AMOUNT'
          ? 'exact'
          : candidate.confidence >= 0.75
          ? 'exact'
          : 'ambiguous'

        matchedResults.push({
          id: `match_${pId}_${lId}`,
          user_id: candidate.payment.user_id,
          payment_id: pId,
          ledger_entry_id: lId,
          match_type: matchType,
          confidence: candidate.confidence,
          reason: candidate.reason,
          user_confirmed: false,
          status: 'suggested',
          rule: candidate.rule,
          date_diff_days: candidate.dateDiffDays,
          payment: candidate.payment,
          ledger_entry: candidate.ledgerEntry,
          created_at: new Date().toISOString(),
        })
      }
    }

    // 4. Handle remaining unmatched payments
    const unmatchedPayments: Payment[] = []
    for (const payment of payments) {
      if (!allocatedPaymentIds.has(payment.id)) {
        unmatchedPayments.push(payment)

        // Find weak/unallocated candidate suggestions for this unmatched payment
        const possibleWeak = allCandidates
          .filter((c) => c.payment.id === payment.id && !allocatedLedgerIds.has(c.ledgerEntry.id))
          .map((c) => c.ledgerEntry)

        matchedResults.push({
          id: `match_unmatched_${payment.id}`,
          user_id: payment.user_id,
          payment_id: payment.id,
          ledger_entry_id: null,
          match_type: 'unmatched',
          confidence: 0,
          reason: 'No matching customer name or ledger due amount identified.',
          user_confirmed: false,
          status: 'suggested',
          rule: 'UNMATCHED',
          date_diff_days: null,
          payment,
          candidate_entries: possibleWeak,
          created_at: new Date().toISOString(),
        })
      }
    }

    // 5. Identify unmatched ledger entries (outstanding dues)
    const unmatchedLedgerEntries = validLedgerEntries.filter((e) => !allocatedLedgerIds.has(e.id))

    const totalConfirmedAmount = matchedResults
      .filter((m) => m.user_confirmed && m.payment)
      .reduce((sum, m) => sum + (m.payment?.amount || 0), 0)

    return {
      matches: matchedResults,
      unmatchedPayments,
      unmatchedLedgerEntries,
      totalConfirmedAmount,
      matchedCount: matchedResults.filter((m) => m.ledger_entry_id !== null).length,
      unmatchedCount: unmatchedPayments.length,
    }
  },
}
