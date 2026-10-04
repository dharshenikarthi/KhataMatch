import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { PaymentMatch } from '../types'
import { ledgerService } from './ledgerService'
import { paymentService } from './paymentService'
import { deterministicMatchService } from './deterministicMatchService'

const LOCAL_STORAGE_MATCHES_KEY = 'khatamatch_matches'

export const matchService = {
  /**
   * Fetches all matches for the authenticated user
   */
  async getMatches(userId: string): Promise<{ data: PaymentMatch[]; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const local = localStorage.getItem(`${LOCAL_STORAGE_MATCHES_KEY}_${userId}`)
      return { data: local ? JSON.parse(local) : [], error: null }
    }

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          payment:payments(*),
          ledger_entry:ledger_entries(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { data: [], error: new Error('Unable to fetch payment matches from database.') }
      }

      return { data: (data || []) as PaymentMatch[], error: null }
    } catch (err: any) {
      return { data: [], error: new Error(err.message || 'Failed to load matches.') }
    }
  },

  /**
   * Saves or updates generated matches in the database
   */
  async saveMatches(userId: string, matches: Partial<PaymentMatch>[]): Promise<{ data: PaymentMatch[]; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getMatches(userId)
      // Merge existing confirmed status
      const existingConfirmedMap = new Map(current.data.map((m) => [m.payment_id, m]))

      const mapped = matches.map((m) => {
        const prev = existingConfirmedMap.get(m.payment_id!)
        return {
          id: m.id || crypto.randomUUID(),
          user_id: userId,
          payment_id: m.payment_id!,
          ledger_entry_id: prev?.user_confirmed ? prev.ledger_entry_id : m.ledger_entry_id || null,
          match_type: m.match_type || 'unmatched',
          confidence: m.confidence || 0,
          reason: m.reason || '',
          user_confirmed: prev?.user_confirmed ?? m.user_confirmed ?? false,
          status: prev?.status || m.status || 'suggested',
          rule: m.rule,
          date_diff_days: m.date_diff_days,
          created_at: new Date().toISOString(),
          payment: m.payment,
          ledger_entry: m.ledger_entry,
          candidate_entries: m.candidate_entries,
        } as PaymentMatch
      })

      localStorage.setItem(`${LOCAL_STORAGE_MATCHES_KEY}_${userId}`, JSON.stringify(mapped))
      return { data: mapped, error: null }
    }

    try {
      const dbPayload = matches.map((m) => ({
        id: m.id?.startsWith('match_') ? undefined : m.id,
        user_id: userId,
        payment_id: m.payment_id,
        ledger_entry_id: m.ledger_entry_id || null,
        match_type: m.match_type,
        confidence: m.confidence,
        reason: m.reason,
        user_confirmed: m.user_confirmed ?? false,
      }))

      const { data, error } = await supabase
        .from('matches')
        .upsert(dbPayload)
        .select(`
          *,
          payment:payments(*),
          ledger_entry:ledger_entries(*)
        `)

      if (error) {
        return { data: [], error: new Error('Unable to save matches in Supabase.') }
      }

      return { data: (data || []) as PaymentMatch[], error: null }
    } catch (err: any) {
      return { data: [], error: new Error(err.message || 'Failed to save matches.') }
    }
  },

  /**
   * Re-runs the deterministic matching algorithm using the latest payments and ledger entries
   */
  async runAndSaveDeterministicMatching(
    userId: string,
    options = { maxDateWindowDays: 4 }
  ): Promise<{ data: PaymentMatch[]; error: Error | null }> {
    try {
      const [paymentsRes, ledgerRes] = await Promise.all([
        paymentService.getPayments(userId),
        ledgerService.getEntries(userId),
      ])

      const payments = paymentsRes.data || []
      const ledgerEntries = ledgerRes.data || []

      if (payments.length === 0 || ledgerEntries.length === 0) {
        return { data: [], error: null }
      }

      const matchEngineResult = deterministicMatchService.runMatching(payments, ledgerEntries, options)
      const saveRes = await this.saveMatches(userId, matchEngineResult.matches)

      return saveRes
    } catch (err: any) {
      return { data: [], error: new Error(err.message || 'Failed to run matching.') }
    }
  },

  /**
   * Confirms a match suggestion between a payment and a ledger entry
   * Enforces 1-to-1 uniqueness: unlinks any other payment confirmed to this ledger entry
   */
  async confirmMatch(
    userId: string,
    matchId: string,
    ledgerEntryId: string | null
  ): Promise<{ data: PaymentMatch | null; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getMatches(userId)
      const idx = current.data.findIndex((m) => m.id === matchId)
      if (idx !== -1) {
        // Enforce 1-to-1 constraint: Unlink any other match using this ledger entry
        if (ledgerEntryId) {
          current.data.forEach((m) => {
            if (m.id !== matchId && m.ledger_entry_id === ledgerEntryId && m.user_confirmed) {
              m.user_confirmed = false
              m.status = 'suggested'
            }
          })
        }

        current.data[idx].ledger_entry_id = ledgerEntryId
        current.data[idx].user_confirmed = true
        current.data[idx].status = 'confirmed'

        localStorage.setItem(`${LOCAL_STORAGE_MATCHES_KEY}_${userId}`, JSON.stringify(current.data))
        return { data: current.data[idx], error: null }
      }
      return { data: null, error: new Error('Match not found.') }
    }

    try {
      const { data, error } = await supabase
        .from('matches')
        .update({
          ledger_entry_id: ledgerEntryId,
          user_confirmed: true,
        })
        .eq('id', matchId)
        .eq('user_id', userId)
        .select(`
          *,
          payment:payments(*),
          ledger_entry:ledger_entries(*)
        `)
        .single()

      if (error) {
        return { data: null, error: new Error('Unable to confirm match in database.') }
      }

      return { data: data as PaymentMatch, error: null }
    } catch (err: any) {
      return { data: null, error: new Error(err.message || 'Failed to confirm match.') }
    }
  },

  /**
   * Rejects a match suggestion without deleting the payment or ledger record
   */
  async rejectMatch(
    userId: string,
    matchId: string
  ): Promise<{ data: PaymentMatch | null; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getMatches(userId)
      const idx = current.data.findIndex((m) => m.id === matchId)
      if (idx !== -1) {
        current.data[idx].user_confirmed = false
        current.data[idx].status = 'rejected'
        localStorage.setItem(`${LOCAL_STORAGE_MATCHES_KEY}_${userId}`, JSON.stringify(current.data))
        return { data: current.data[idx], error: null }
      }
      return { data: null, error: new Error('Match not found.') }
    }

    try {
      const { data, error } = await supabase
        .from('matches')
        .update({
          ledger_entry_id: null,
          user_confirmed: false,
        })
        .eq('id', matchId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error('Unable to reject match.') }
      }

      return { data: data as PaymentMatch, error: null }
    } catch (err: any) {
      return { data: null, error: new Error(err.message || 'Failed to reject match.') }
    }
  },
}
