import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { paymentService } from '@/services/paymentService'
import { Payment } from '@/types'
import { ParsedTransactionRow } from '@/services/csvParserService'

export interface ImportSummary {
  totalRows: number
  importedCount: number
  invalidCount: number
  duplicatesSkipped: number
  excludedCount: number
  failedCount: number
  totalImportedAmount: number
  importedPayments: Payment[]
}

export const paymentImportService = {
  /**
   * Fetch all existing payments for the user
   */
  async getExistingPayments(userId: string): Promise<Payment[]> {
    const { data } = await paymentService.getPayments(userId)
    return data || []
  },

  /**
   * Identifies duplicates against already imported payments in the database
   */
  async checkDuplicatePayments(
    userId: string,
    rows: ParsedTransactionRow[]
  ): Promise<ParsedTransactionRow[]> {
    const existing = await this.getExistingPayments(userId)
    if (existing.length === 0) return rows

    const existingRefs = new Set(
      existing.filter((p) => p.reference).map((p) => p.reference!.toLowerCase().trim())
    )

    return rows.map((row) => {
      // Don't re-check already excluded/invalid rows
      if (row.status === 'excluded' || row.status === 'invalid') {
        return row
      }

      // Check 1: Exact Reference Match
      if (row.reference && existingRefs.has(row.reference.toLowerCase().trim())) {
        return {
          ...row,
          status: 'possible_duplicate',
          isDuplicate: true,
          duplicateReason: `Transaction reference '${row.reference}' already imported.`,
        }
      }

      // Check 2: Same Date, Payer Name, and Amount
      const sameExactMatch = existing.find(
        (p) =>
          p.amount === row.amount &&
          p.payer_name.toLowerCase().trim() === row.payerName.toLowerCase().trim() &&
          p.paid_at &&
          row.date &&
          p.paid_at.startsWith(row.date)
      )

      if (sameExactMatch) {
        return {
          ...row,
          status: 'possible_duplicate',
          isDuplicate: true,
          duplicateReason: `Similar payment of ${row.amount} from '${row.payerName}' already exists on this date.`,
        }
      }

      return row
    })
  },

  /**
   * Imports valid, non-excluded payment rows into the payments database table
   */
  async importPayments(
    userId: string,
    rows: ParsedTransactionRow[],
    options: {
      includeDuplicates?: boolean
    } = {}
  ): Promise<{ summary: ImportSummary; error: Error | null }> {
    const eligibleRows = rows.filter((r) => {
      if (r.status === 'invalid' || r.status === 'excluded') return false
      if (r.status === 'possible_duplicate' && !options.includeDuplicates) return false
      return r.direction === 'incoming' && r.amount > 0
    })

    const duplicatesSkipped = rows.filter(
      (r) => r.status === 'possible_duplicate' && !options.includeDuplicates
    ).length
    const invalidCount = rows.filter((r) => r.status === 'invalid').length
    const excludedCount = rows.filter((r) => r.status === 'excluded').length

    if (eligibleRows.length === 0) {
      return {
        summary: {
          totalRows: rows.length,
          importedCount: 0,
          invalidCount,
          duplicatesSkipped,
          excludedCount,
          failedCount: 0,
          totalImportedAmount: 0,
          importedPayments: [],
        },
        error: null,
      }
    }

    const payload: Partial<Payment>[] = eligibleRows.map((r) => ({
      user_id: userId,
      payer_name: r.payerName,
      amount: r.amount,
      paid_at: r.date ? new Date(r.date).toISOString() : new Date().toISOString(),
      reference: r.reference,
      raw_row: r.rawRow,
    }))

    try {
      const { data, error } = await paymentService.savePayments(userId, payload)

      if (error) {
        return {
          summary: {
            totalRows: rows.length,
            importedCount: 0,
            invalidCount,
            duplicatesSkipped,
            excludedCount,
            failedCount: eligibleRows.length,
            totalImportedAmount: 0,
            importedPayments: [],
          },
          error,
        }
      }

      const totalImportedAmount = data.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

      return {
        summary: {
          totalRows: rows.length,
          importedCount: data.length,
          invalidCount,
          duplicatesSkipped,
          excludedCount,
          failedCount: 0,
          totalImportedAmount,
          importedPayments: data,
        },
        error: null,
      }
    } catch (err: any) {
      return {
        summary: {
          totalRows: rows.length,
          importedCount: 0,
          invalidCount,
          duplicatesSkipped,
          excludedCount,
          failedCount: eligibleRows.length,
          totalImportedAmount: 0,
          importedPayments: [],
        },
        error: new Error(err.message || 'Payment import failed.'),
      }
    }
  },
}
