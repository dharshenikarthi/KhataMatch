import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Payment } from '../types'

const LOCAL_STORAGE_PAYMENTS_KEY = 'khatamatch_payments'

export const paymentService = {
  async getPayments(userId: string): Promise<{ data: Payment[]; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const local = localStorage.getItem(`${LOCAL_STORAGE_PAYMENTS_KEY}_${userId}`)
      return { data: local ? JSON.parse(local) : [], error: null }
    }

    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('paid_at', { ascending: false })

      if (error) {
        return { data: [], error: new Error("Unable to fetch statement payments.") }
      }

      return { data: (data || []) as Payment[], error: null }
    } catch (err: any) {
      return { data: [], error: new Error(err.message || "Failed to load payments.") }
    }
  },

  async savePayments(userId: string, payments: Partial<Payment>[]): Promise<{ data: Payment[]; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getPayments(userId)
      const mapped = payments.map((p) => ({
        id: p.id || crypto.randomUUID(),
        user_id: userId,
        payer_name: p.payer_name || '',
        amount: Number(p.amount) || 0,
        paid_at: p.paid_at || new Date().toISOString(),
        reference: p.reference || null,
        raw_row: p.raw_row || null,
        created_at: new Date().toISOString(),
      })) as Payment[]

      const updated = [...mapped, ...current.data.filter(c => !mapped.some(m => m.id === c.id))]
      localStorage.setItem(`${LOCAL_STORAGE_PAYMENTS_KEY}_${userId}`, JSON.stringify(updated))
      return { data: mapped, error: null }
    }

    try {
      const formatted = payments.map((p) => ({
        ...p,
        user_id: userId,
      }))

      const { data, error } = await supabase
        .from('payments')
        .insert(formatted)
        .select()

      if (error) {
        return { data: [], error: new Error("Unable to save statement payments.") }
      }

      return { data: (data || []) as Payment[], error: null }
    } catch (err: any) {
      return { data: [], error: new Error(err.message || "Failed to save payments.") }
    }
  },
}
