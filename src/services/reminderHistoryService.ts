import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  ReminderHistoryItem,
  ReminderHistoryStatus,
  FollowUpStatus,
  ReminderStyle,
  Language,
} from '../types'
import { LedgerBalanceRecord, CustomerSummaryBalance } from './balanceTrackingService'

const LOCAL_STORAGE_REMINDER_HISTORY_KEY = 'khatamatch_reminder_history'

const memoryStore = new Map<string, string>()

const safeStorage = {
  getItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key)
    }
    return memoryStore.get(key) || null
  },
  setItem(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
    } else {
      memoryStore.set(key, value)
    }
  },
}

export interface SaveReminderHistoryInput {
  customer_name: string
  phone?: string | null
  amount_due: number
  ledger_entry_ids?: string[]
  message: string
  style?: ReminderStyle
  language?: Language
  status?: ReminderHistoryStatus
  next_follow_up_at?: string | null
  notes?: string
}

export interface FollowUpSummaryMetrics {
  dueTodayCount: number
  overdueCount: number
  upcomingCount: number
  unscheduledCount: number
  totalActiveDrafts: number
  totalOutstandingInQueue: number
}

export const reminderHistoryService = {
  /**
   * Evaluates the follow-up status based on current date
   */
  calculateFollowUpStatus(
    nextFollowUpAt: string | null | undefined,
    status: ReminderHistoryStatus,
    referenceDateStr?: string
  ): FollowUpStatus {
    if (status === 'archived') {
      return 'completed'
    }
    if (!nextFollowUpAt) {
      return 'unscheduled'
    }

    const todayStr = referenceDateStr || new Date().toISOString().split('T')[0]
    const followUpDateStr = nextFollowUpAt.split('T')[0]

    if (followUpDateStr === todayStr) {
      return 'due_today'
    }
    if (followUpDateStr < todayStr) {
      return 'overdue'
    }
    return 'upcoming'
  },

  /**
   * Fetches all reminder history records for a user
   */
  async getReminderHistory(
    userId: string
  ): Promise<{ data: ReminderHistoryItem[]; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const local = safeStorage.getItem(`${LOCAL_STORAGE_REMINDER_HISTORY_KEY}_${userId}`)
      const parsed: ReminderHistoryItem[] = local ? JSON.parse(local) : []
      return {
        data: parsed.map((item) => ({
          ...item,
          followUpStatus: this.calculateFollowUpStatus(item.next_follow_up_at, item.status),
        })),
        error: null,
      }
    }

    try {
      const { data, error } = await supabase
        .from('reminder_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { data: [], error: new Error('Failed to load reminder history.') }
      }

      const mapped: ReminderHistoryItem[] = (data || []).map((item: any) => ({
        ...item,
        followUpStatus: this.calculateFollowUpStatus(item.next_follow_up_at, item.status),
      }))

      return { data: mapped, error: null }
    } catch (err: any) {
      return { data: [], error: new Error(err.message || 'Failed to fetch reminder history.') }
    }
  },

  /**
   * Saves a new reminder history record
   */
  async saveReminderHistory(
    userId: string,
    input: SaveReminderHistoryInput
  ): Promise<{ data: ReminderHistoryItem | null; error: Error | null }> {
    const now = new Date().toISOString()
    const newItem: ReminderHistoryItem = {
      id: crypto.randomUUID(),
      user_id: userId,
      customer_name: input.customer_name,
      phone: input.phone || null,
      amount_due: Number(input.amount_due) || 0,
      ledger_entry_ids: input.ledger_entry_ids || [],
      message: input.message,
      style: input.style || 'friendly',
      language: input.language || 'english',
      status: input.status || 'draft',
      next_follow_up_at: input.next_follow_up_at || null,
      notes: input.notes || '',
      created_at: now,
      updated_at: now,
    }

    newItem.followUpStatus = this.calculateFollowUpStatus(newItem.next_follow_up_at, newItem.status)

    if (!isSupabaseConfigured) {
      const current = await this.getReminderHistory(userId)
      const updated = [newItem, ...current.data]
      safeStorage.setItem(`${LOCAL_STORAGE_REMINDER_HISTORY_KEY}_${userId}`, JSON.stringify(updated))
      return { data: newItem, error: null }
    }

    try {
      const { data, error } = await supabase
        .from('reminder_history')
        .insert({
          user_id: userId,
          customer_name: newItem.customer_name,
          phone: newItem.phone,
          amount_due: newItem.amount_due,
          ledger_entry_ids: newItem.ledger_entry_ids,
          message: newItem.message,
          style: newItem.style,
          language: newItem.language,
          status: newItem.status,
          next_follow_up_at: newItem.next_follow_up_at,
          notes: newItem.notes,
        })
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error('Failed to save reminder history.') }
      }

      const savedItem: ReminderHistoryItem = {
        ...data,
        followUpStatus: this.calculateFollowUpStatus(data.next_follow_up_at, data.status),
      }

      return { data: savedItem, error: null }
    } catch (err: any) {
      return { data: null, error: new Error(err.message || 'Failed to save reminder history.') }
    }
  },

  /**
   * Updates an existing reminder history record (e.g. edit message, schedule follow-up, archive)
   */
  async updateReminderHistory(
    userId: string,
    id: string,
    updates: Partial<ReminderHistoryItem>
  ): Promise<{ data: ReminderHistoryItem | null; error: Error | null }> {
    const now = new Date().toISOString()

    if (!isSupabaseConfigured) {
      const current = await this.getReminderHistory(userId)
      const idx = current.data.findIndex((item) => item.id === id)
      if (idx !== -1) {
        const merged: ReminderHistoryItem = {
          ...current.data[idx],
          ...updates,
          updated_at: now,
        }
        merged.followUpStatus = this.calculateFollowUpStatus(merged.next_follow_up_at, merged.status)
        current.data[idx] = merged
        safeStorage.setItem(`${LOCAL_STORAGE_REMINDER_HISTORY_KEY}_${userId}`, JSON.stringify(current.data))
        return { data: merged, error: null }
      }
      return { data: null, error: new Error('Reminder record not found.') }
    }

    try {
      const payload: Record<string, any> = {
        ...updates,
        updated_at: now,
      }
      delete payload.followUpStatus
      delete payload.currentOutstandingAmount
      delete payload.isBalanceOutdated

      const { data, error } = await supabase
        .from('reminder_history')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error('Failed to update reminder record.') }
      }

      const updatedItem: ReminderHistoryItem = {
        ...data,
        followUpStatus: this.calculateFollowUpStatus(data.next_follow_up_at, data.status),
      }

      return { data: updatedItem, error: null }
    } catch (err: any) {
      return { data: null, error: new Error(err.message || 'Failed to update reminder record.') }
    }
  },

  /**
   * Deletes a reminder history item
   */
  async deleteReminderHistory(userId: string, id: string): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getReminderHistory(userId)
      const filtered = current.data.filter((item) => item.id !== id)
      safeStorage.setItem(`${LOCAL_STORAGE_REMINDER_HISTORY_KEY}_${userId}`, JSON.stringify(filtered))
      return { success: true, error: null }
    }

    try {
      const { error } = await supabase
        .from('reminder_history')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        return { success: false, error: new Error('Failed to delete reminder record.') }
      }
      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: new Error(err.message || 'Failed to delete reminder record.') }
    }
  },

  /**
   * Enriches reminder history items with live outstanding balance data from Phase 9
   * Flags outdated amounts if payments occurred after the draft was saved
   */
  enrichWithLiveBalances(
    historyItems: ReminderHistoryItem[],
    customerBalances: CustomerSummaryBalance[]
  ): ReminderHistoryItem[] {
    const custMap = new Map<string, CustomerSummaryBalance>()
    for (const c of customerBalances) {
      custMap.set(c.nameNormalized || c.customerName.toLowerCase().trim(), c)
    }

    return historyItems.map((item) => {
      const key = item.customer_name.toLowerCase().trim()
      const liveCust = custMap.get(key)
      const currentOutstandingAmount = liveCust ? liveCust.totalOutstandingAmount : 0
      const isBalanceOutdated =
        liveCust !== undefined && Math.abs(currentOutstandingAmount - item.amount_due) > 0.01

      return {
        ...item,
        currentOutstandingAmount,
        isBalanceOutdated,
      }
    })
  },

  /**
   * Computes follow-up dashboard metrics
   */
  computeFollowUpMetrics(items: ReminderHistoryItem[]): FollowUpSummaryMetrics {
    let dueTodayCount = 0
    let overdueCount = 0
    let upcomingCount = 0
    let unscheduledCount = 0
    let totalActiveDrafts = 0
    let totalOutstandingInQueue = 0

    for (const item of items) {
      if (item.status !== 'archived') {
        totalActiveDrafts++
        totalOutstandingInQueue += item.amount_due

        if (item.followUpStatus === 'due_today') dueTodayCount++
        else if (item.followUpStatus === 'overdue') overdueCount++
        else if (item.followUpStatus === 'upcoming') upcomingCount++
        else if (item.followUpStatus === 'unscheduled') unscheduledCount++
      }
    }

    return {
      dueTodayCount,
      overdueCount,
      upcomingCount,
      unscheduledCount,
      totalActiveDrafts,
      totalOutstandingInQueue,
    }
  },
}
