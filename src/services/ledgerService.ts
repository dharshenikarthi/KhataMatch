import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { LedgerEntry } from '../types'

const LOCAL_STORAGE_LEDGER_KEY = 'khatamatch_ledger_entries'

export const ledgerService = {
  async getEntries(userId: string): Promise<{ data: LedgerEntry[]; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const local = localStorage.getItem(`${LOCAL_STORAGE_LEDGER_KEY}_${userId}`)
      return { data: local ? JSON.parse(local) : [], error: null }
    }

    try {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { data: [], error: new Error("Unable to fetch ledger entries.") }
      }

      return { data: (data || []) as LedgerEntry[], error: null }
    } catch (err: any) {
      return { data: [], error: new Error(err.message || "Failed to load ledger.") }
    }
  },

  async saveEntries(userId: string, entries: Partial<LedgerEntry>[]): Promise<{ data: LedgerEntry[]; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getEntries(userId)
      const mapped = entries.map((e) => ({
        id: e.id || crypto.randomUUID(),
        user_id: userId,
        customer_name: e.customer_name || '',
        name_normalized: (e.customer_name || '').toLowerCase().trim(),
        amount: Number(e.amount) || 0,
        entry_date: e.entry_date || new Date().toISOString().split('T')[0],
        type: e.type || 'credit',
        status: e.status || 'active',
        confidence: e.confidence !== undefined ? e.confidence : 1.0,
        source_image_path: e.source_image_path || null,
        confirmed: e.confirmed ?? false,
        created_at: new Date().toISOString(),
      })) as LedgerEntry[]

      const updated = [...mapped, ...current.data.filter(c => !mapped.some(m => m.id === c.id))]
      localStorage.setItem(`${LOCAL_STORAGE_LEDGER_KEY}_${userId}`, JSON.stringify(updated))
      return { data: mapped, error: null }
    }

    try {
      const formatted = entries.map((e) => ({
        ...e,
        user_id: userId,
        name_normalized: (e.customer_name || '').toLowerCase().trim(),
      }))

      const { data, error } = await supabase
        .from('ledger_entries')
        .insert(formatted)
        .select()

      if (error) {
        return { data: [], error: new Error("Unable to save extracted ledger entries.") }
      }

      return { data: (data || []) as LedgerEntry[], error: null }
    } catch (err: any) {
      return { data: [], error: new Error(err.message || "Failed to save ledger entries.") }
    }
  },

  async updateEntry(userId: string, entryId: string, updates: Partial<LedgerEntry>): Promise<{ data: LedgerEntry | null; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getEntries(userId)
      const itemIndex = current.data.findIndex((e) => e.id === entryId)
      if (itemIndex === -1) return { data: null, error: new Error("Entry not found") }

      const updatedItem = {
        ...current.data[itemIndex],
        ...updates,
        ...(updates.customer_name ? { name_normalized: updates.customer_name.toLowerCase().trim() } : {}),
      }
      current.data[itemIndex] = updatedItem
      localStorage.setItem(`${LOCAL_STORAGE_LEDGER_KEY}_${userId}`, JSON.stringify(current.data))
      return { data: updatedItem, error: null }
    }

    try {
      const payload: Record<string, any> = { ...updates }
      if (updates.customer_name) {
        payload.name_normalized = updates.customer_name.toLowerCase().trim()
      }

      const { data, error } = await supabase
        .from('ledger_entries')
        .update(payload)
        .eq('id', entryId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error("Unable to update ledger entry.") }
      }

      return { data: data as LedgerEntry, error: null }
    } catch (err: any) {
      return { data: null, error: new Error(err.message || "Failed to update entry.") }
    }
  },

  async deleteEntry(userId: string, entryId: string): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getEntries(userId)
      const filtered = current.data.filter((e) => e.id !== entryId)
      localStorage.setItem(`${LOCAL_STORAGE_LEDGER_KEY}_${userId}`, JSON.stringify(filtered))
      return { success: true, error: null }
    }

    try {
      const { error } = await supabase
        .from('ledger_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId)

      if (error) {
        return { success: false, error: new Error("Unable to delete ledger entry.") }
      }

      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: new Error(err.message || "Failed to delete entry.") }
    }
  },

  async clearAllUserData(userId: string): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(`${LOCAL_STORAGE_LEDGER_KEY}_${userId}`)
      localStorage.removeItem(`khatamatch_payments_${userId}`)
      localStorage.removeItem(`khatamatch_matches_${userId}`)
      localStorage.removeItem(`khatamatch_reminders_${userId}`)
      return { success: true, error: null }
    }

    try {
      await supabase.from('reminders').delete().eq('user_id', userId)
      await supabase.from('matches').delete().eq('user_id', userId)
      await supabase.from('payments').delete().eq('user_id', userId)
      await supabase.from('ledger_entries').delete().eq('user_id', userId)
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: new Error("Failed to clear data.") }
    }
  }
}
