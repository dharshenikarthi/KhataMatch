import { LedgerEntry, Payment, PaymentMatch } from '../types'
import { toPaise } from './deterministicMatchService'

export type PaymentSettlementStatus = 'unpaid' | 'partially_paid' | 'fully_paid' | 'overpaid'

export interface LedgerBalanceRecord {
  ledgerEntry: LedgerEntry
  customerId: string
  customerName: string
  ledgerDate: string | null
  originalAmount: number
  paidAmount: number
  outstandingAmount: number
  status: PaymentSettlementStatus
  latestPaymentDate: string | null
  allocatedMatches: PaymentMatch[]
}

export interface CustomerSummaryBalance {
  customerName: string
  nameNormalized: string
  totalOriginalAmount: number
  totalPaidAmount: number
  totalOutstandingAmount: number
  overallStatus: PaymentSettlementStatus
  entriesCount: number
  unpaidEntriesCount: number
  latestActivityDate: string | null
  ledgerEntries: LedgerEntry[]
  allocatedPayments: Payment[]
}

export interface OverallPortfolioSummary {
  totalLedgerCreditAmount: number
  totalConfirmedPaidAmount: number
  totalOutstandingAmount: number
  totalLedgerEntries: number
  unpaidCount: number
  partiallyPaidCount: number
  fullyPaidCount: number
  overpaidCount: number
  customersWithPendingBalance: number
}

export const balanceTrackingService = {
  /**
   * Calculates ledger entry balances based only on user-confirmed matches
   * Unconfirmed suggestions and rejected matches have zero effect on balances
   */
  calculateLedgerBalances(
    ledgerEntries: LedgerEntry[],
    matches: PaymentMatch[]
  ): LedgerBalanceRecord[] {
    const validEntries = ledgerEntries.filter(
      (e) => e.status !== 'struck_out' && e.status !== 'deleted'
    )

    // Map confirmed matches by ledger_entry_id
    const confirmedMatchesByLedgerId = new Map<string, PaymentMatch[]>()

    for (const match of matches) {
      if (match.user_confirmed && match.ledger_entry_id && match.payment) {
        const list = confirmedMatchesByLedgerId.get(match.ledger_entry_id) || []
        list.push(match)
        confirmedMatchesByLedgerId.set(match.ledger_entry_id, list)
      }
    }

    return validEntries.map((entry) => {
      const allocated = confirmedMatchesByLedgerId.get(entry.id) || []

      // Calculate paid amount in paise to avoid floating-point inaccuracy
      const paidPaise = allocated.reduce((sum, m) => sum + toPaise(m.payment?.amount || 0), 0)
      const originalPaise = toPaise(entry.amount)

      const paidAmount = paidPaise / 100
      const originalAmount = entry.amount
      const outstandingPaise = Math.max(0, originalPaise - paidPaise)
      const outstandingAmount = outstandingPaise / 100

      let status: PaymentSettlementStatus = 'unpaid'
      if (paidPaise === 0) {
        status = 'unpaid'
      } else if (paidPaise < originalPaise) {
        status = 'partially_paid'
      } else if (paidPaise === originalPaise) {
        status = 'fully_paid'
      } else {
        status = 'overpaid'
      }

      // Find latest confirmed payment date
      let latestPaymentDate: string | null = null
      if (allocated.length > 0) {
        const sortedDates = allocated
          .map((m) => m.payment?.paid_at)
          .filter(Boolean)
          .sort()
        if (sortedDates.length > 0) {
          latestPaymentDate = sortedDates[sortedDates.length - 1] || null
        }
      }

      return {
        ledgerEntry: entry,
        customerId: entry.id,
        customerName: entry.customer_name,
        ledgerDate: entry.entry_date,
        originalAmount,
        paidAmount,
        outstandingAmount,
        status,
        latestPaymentDate,
        allocatedMatches: allocated,
      }
    })
  },

  /**
   * Groups balances by normalized customer name to show cumulative dues per person
   */
  aggregateCustomerBalances(balances: LedgerBalanceRecord[]): CustomerSummaryBalance[] {
    const customerMap = new Map<string, CustomerSummaryBalance>()

    for (const record of balances) {
      const norm = record.ledgerEntry.name_normalized || record.customerName.toLowerCase().trim()
      const existing = customerMap.get(norm)

      if (!existing) {
        customerMap.set(norm, {
          customerName: record.customerName,
          nameNormalized: norm,
          totalOriginalAmount: record.originalAmount,
          totalPaidAmount: record.paidAmount,
          totalOutstandingAmount: record.outstandingAmount,
          overallStatus: record.status,
          entriesCount: 1,
          unpaidEntriesCount: record.status !== 'fully_paid' ? 1 : 0,
          latestActivityDate: record.latestPaymentDate || record.ledgerDate,
          ledgerEntries: [record.ledgerEntry],
          allocatedPayments: record.allocatedMatches.map((m) => m.payment!).filter(Boolean),
        })
      } else {
        const origPaise = toPaise(existing.totalOriginalAmount) + toPaise(record.originalAmount)
        const paidPaise = toPaise(existing.totalPaidAmount) + toPaise(record.paidAmount)
        const outPaise = Math.max(0, origPaise - paidPaise)

        let overallStatus: PaymentSettlementStatus = 'unpaid'
        if (paidPaise === 0) overallStatus = 'unpaid'
        else if (paidPaise < origPaise) overallStatus = 'partially_paid'
        else if (paidPaise === origPaise) overallStatus = 'fully_paid'
        else overallStatus = 'overpaid'

        existing.totalOriginalAmount = origPaise / 100
        existing.totalPaidAmount = paidPaise / 100
        existing.totalOutstandingAmount = outPaise / 100
        existing.overallStatus = overallStatus
        existing.entriesCount += 1
        if (record.status !== 'fully_paid') existing.unpaidEntriesCount += 1
        existing.ledgerEntries.push(record.ledgerEntry)

        for (const m of record.allocatedMatches) {
          if (m.payment && !existing.allocatedPayments.some((p) => p.id === m.payment!.id)) {
            existing.allocatedPayments.push(m.payment)
          }
        }
      }
    }

    return Array.from(customerMap.values())
  },

  /**
   * Calculates overall shop portfolio financial metrics
   */
  calculatePortfolioSummary(balances: LedgerBalanceRecord[]): OverallPortfolioSummary {
    let totalOrigPaise = 0
    let totalPaidPaise = 0
    let totalOutPaise = 0
    let unpaidCount = 0
    let partiallyPaidCount = 0
    let fullyPaidCount = 0
    let overpaidCount = 0

    const customerPendingSet = new Set<string>()

    for (const b of balances) {
      totalOrigPaise += toPaise(b.originalAmount)
      totalPaidPaise += toPaise(b.paidAmount)
      totalOutPaise += toPaise(b.outstandingAmount)

      if (b.status === 'unpaid') unpaidCount++
      else if (b.status === 'partially_paid') partiallyPaidCount++
      else if (b.status === 'fully_paid') fullyPaidCount++
      else if (b.status === 'overpaid') overpaidCount++

      if (b.outstandingAmount > 0) {
        customerPendingSet.add(b.ledgerEntry.name_normalized || b.customerName.toLowerCase())
      }
    }

    return {
      totalLedgerCreditAmount: totalOrigPaise / 100,
      totalConfirmedPaidAmount: totalPaidPaise / 100,
      totalOutstandingAmount: totalOutPaise / 100,
      totalLedgerEntries: balances.length,
      unpaidCount,
      partiallyPaidCount,
      fullyPaidCount,
      overpaidCount,
      customersWithPendingBalance: customerPendingSet.size,
    }
  },
}
