import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ledgerService } from '@/services/ledgerService'
import { LedgerEntry } from '@/types'

export const ledgerReviewService = {
  /**
   * Fetch all ledger entries for the authenticated user from Supabase (or local store)
   */
  async getLedgerEntries(userId: string): Promise<{ data: LedgerEntry[]; error: Error | null }> {
    return ledgerService.getEntries(userId)
  },

  /**
   * Get a temporary secure signed URL for the original ledger image from Supabase Storage
   */
  async getSignedImageUrl(storagePath: string | null | undefined): Promise<{ url: string | null; error: Error | null }> {
    if (!storagePath) {
      return { url: null, error: null }
    }

    if (storagePath.startsWith('http://') || storagePath.startsWith('https://') || storagePath.startsWith('/') || storagePath.startsWith('data:')) {
      return { url: storagePath, error: null }
    }

    if (!isSupabaseConfigured) {
      return { url: '/sample-data/sample-ledger.svg', error: null }
    }

    try {
      const { data, error } = await supabase.storage
        .from('ledger-images')
        .createSignedUrl(storagePath, 3600) // 1 hour expiration

      if (error || !data?.signedUrl) {
        console.warn('Could not generate signed URL for ledger image:', error)
        return { url: null, error: new Error('Original ledger image unavailable.') }
      }

      return { url: data.signedUrl, error: null }
    } catch (err: any) {
      return { url: null, error: new Error(err.message || 'Failed to retrieve ledger preview.') }
    }
  },

  /**
   * Update an unconfirmed ledger entry with user corrections and update normalized name
   */
  async updateLedgerEntry(
    userId: string,
    entryId: string,
    updates: {
      customer_name: string
      amount: number
      entry_date: string | null
      type: 'credit' | 'payment'
      status: 'active' | 'struck_out'
      note?: string | null
    }
  ): Promise<{ data: LedgerEntry | null; error: Error | null }> {
    // Validate required fields
    const trimmedName = updates.customer_name.trim()
    if (!trimmedName) {
      return { data: null, error: new Error('Customer name cannot be empty.') }
    }

    const numAmount = Number(updates.amount)
    if (isNaN(numAmount) || numAmount < 0) {
      return { data: null, error: new Error('Amount must be a valid non-negative number.') }
    }

    if (updates.entry_date && isNaN(new Date(updates.entry_date).getTime())) {
      return { data: null, error: new Error('Invalid date format.') }
    }

    const payload: Partial<LedgerEntry> = {
      customer_name: trimmedName,
      name_normalized: trimmedName.toLowerCase(),
      amount: numAmount,
      entry_date: updates.entry_date || null,
      type: updates.type,
      status: updates.status,
      note: updates.note || null,
    }

    return ledgerService.updateEntry(userId, entryId, payload)
  },

  /**
   * Confirm an individual ledger entry
   */
  async confirmLedgerEntry(
    userId: string,
    entryId: string
  ): Promise<{ data: LedgerEntry | null; error: Error | null }> {
    return ledgerService.updateEntry(userId, entryId, { confirmed: true })
  },

  /**
   * Reopen a confirmed ledger entry for editing
   */
  async reopenLedgerEntry(
    userId: string,
    entryId: string
  ): Promise<{ data: LedgerEntry | null; error: Error | null }> {
    return ledgerService.updateEntry(userId, entryId, { confirmed: false })
  },

  /**
   * Bulk confirm multiple eligible ledger entries
   */
  async confirmEligibleEntries(
    userId: string,
    entryIds: string[]
  ): Promise<{ confirmedCount: number; failedCount: number; error: Error | null }> {
    if (!entryIds || entryIds.length === 0) {
      return { confirmedCount: 0, failedCount: 0, error: null }
    }

    let confirmedCount = 0
    let failedCount = 0

    for (const id of entryIds) {
      const { data, error } = await ledgerService.updateEntry(userId, id, { confirmed: true })
      if (!error && data) {
        confirmedCount++
      } else {
        failedCount++
      }
    }

    return { confirmedCount, failedCount, error: null }
  },
}
