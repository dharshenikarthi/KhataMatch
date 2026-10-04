import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Reminder, Language, ReminderStyle } from '../types'

const LOCAL_STORAGE_REMINDERS_KEY = 'khatamatch_reminders'

export interface ReminderCustomerItem {
  customer_name: string
  amount_due: number
  original_amount?: number
  paid_amount?: number
  ledger_date?: string | null
  due_date?: string | null
  entries_count?: number
  phone?: string | null
}

export interface GenerateDraftsOptions {
  items: ReminderCustomerItem[]
  style?: ReminderStyle
  language?: Language
  shop_name?: string
  userId?: string
}

export interface GeneratedDraftResult {
  customer_name: string
  amount_due: number
  style: ReminderStyle
  language: Language
  message: string
  word_count: number
  phone?: string | null
}

export const reminderService = {
  /**
   * Generates polite, respectful reminder drafts via Gemini Edge Function
   * with high-quality fallback for offline/demo modes
   */
  async generateDrafts(
    options: GenerateDraftsOptions
  ): Promise<{ data: GeneratedDraftResult[]; error: Error | null; isAiGenerated: boolean }> {
    const { items, style = 'friendly', language = 'english', shop_name = 'KhataMatch Shop' } = options

    // Filter out zero or negative balance items
    const positiveItems = items.filter((i) => typeof i.amount_due === 'number' && i.amount_due > 0)

    if (positiveItems.length === 0) {
      return {
        data: [],
        error: new Error('No outstanding positive balances found to generate reminders for.'),
        isAiGenerated: false,
      }
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.functions.invoke('draft-reminders', {
          body: {
            items: positiveItems,
            style,
            language,
            shop_name,
          },
        })

        if (!error && data?.drafts && Array.isArray(data.drafts)) {
          const mapped: GeneratedDraftResult[] = data.drafts.map((d: any, idx: number) => ({
            customer_name: d.customer_name || positiveItems[idx]?.customer_name || 'Customer',
            amount_due: d.amount_due ?? positiveItems[idx]?.amount_due ?? 0,
            style: (d.style as ReminderStyle) || style,
            language: (d.language as Language) || language,
            message: d.message || '',
            word_count: d.word_count || d.message?.split(/\s+/).length || 0,
            phone: positiveItems[idx]?.phone || null,
          }))

          return { data: mapped, error: null, isAiGenerated: true }
        }
      } catch (err: any) {
        console.warn('Edge Function draft-reminders invocation issue, using local generator:', err.message)
      }
    }

    // Fallback deterministic draft generator
    const localDrafts: GeneratedDraftResult[] = positiveItems.map((item) => {
      const name = item.customer_name || 'Customer'
      const amt = item.amount_due
      const dateStr = item.ledger_date ? ` from ${item.ledger_date}` : ''
      let msg = ''

      if (language === 'tamil') {
        if (style === 'friendly') {
          msg = `வணக்கம் ${name}! ${shop_name}-ல் தங்களின் நிலுவைத் தொகை ரூ. ${amt}. தங்களுக்கு வசதியான நேரத்தில் செலுத்த அன்புடன் நினைவூட்டுகிறோம். நன்றி!`
        } else if (style === 'professional') {
          msg = `வணக்கம் ${name}. ${shop_name} கணக்கின்படி தங்களின் நிலுவைத் தொகை ரூ. ${amt}${dateStr}. தயவுசெய்து கணக்கை சரிபார்த்து செலுத்தவும்.`
        } else if (style === 'gentle') {
          msg = `வணக்கம் ${name}. தங்களின் நிலுவைத் தொகை ரூ. ${amt} குறித்து ஒரு மென்மையான நினைவூட்டல். ஏதேனும் சந்தேகங்கள் இருப்பின் தொடர்பு கொள்ளவும்.`
        } else {
          // short
          msg = `வணக்கம் ${name}, ${shop_name} நிலுவை ரூ. ${amt}. UPI மூலம் செலுத்தலாம். நன்றி!`
        }
      } else if (language === 'tanglish') {
        if (style === 'friendly') {
          msg = `Vanakkam ${name}! Ungaloda ${shop_name} pending balance Rs. ${amt}. Ungalukku convenient aana time-la pay pannidunga. Thank you!`
        } else if (style === 'professional') {
          msg = `Vanakkam ${name}. ${shop_name} records-padi ungaludaiya pending due Rs. ${amt}${dateStr}. Dayavuseithu check panni settle pannavum.`
        } else if (style === 'gentle') {
          msg = `Vanakkam ${name}. Ungaloda pending balance Rs. ${amt} pathina oru gentle reminder. Enna status nu update pannunga please.`
        } else {
          // short
          msg = `Vanakkam ${name}, ${shop_name} pending Rs. ${amt}. GPay / PhonePe-la pay pannidunga. Nandri!`
        }
      } else {
        // English
        if (style === 'friendly') {
          msg = `Namaste ${name}! Gentle reminder from ${shop_name} regarding your pending balance of Rs. ${amt}. Please feel free to clear it whenever convenient. Thank you!`
        } else if (style === 'professional') {
          msg = `Dear ${name}, according to our records at ${shop_name}, you have an outstanding balance of Rs. ${amt}${dateStr}. Kindly verify and arrange for payment. Regards.`
        } else if (style === 'gentle') {
          msg = `Hello ${name}, following up gently regarding your pending balance of Rs. ${amt} at ${shop_name}. Please let us know if you need any clarification.`
        } else {
          // short
          msg = `Namaste ${name}, your outstanding balance at ${shop_name} is Rs. ${amt}. Please clear via UPI/Cash when possible. Thank you!`
        }
      }

      return {
        customer_name: name,
        amount_due: amt,
        style,
        language,
        message: msg,
        word_count: msg.split(/\s+/).length,
        phone: item.phone || null,
      }
    })

    return { data: localDrafts, error: null, isAiGenerated: false }
  },

  /**
   * Encodes message safely into a WhatsApp click-to-chat URL
   * Opens https://wa.me/<phone>?text=... or https://wa.me/?text=...
   */
  buildWhatsAppClickUrl(phone: string | null | undefined, message: string): string {
    const encodedText = encodeURIComponent(message.trim())
    if (!phone) {
      return `https://wa.me/?text=${encodedText}`
    }
    // Clean phone number (strip +, -, spaces)
    const cleanedPhone = phone.replace(/[^\d]/g, '')
    if (cleanedPhone.length === 10) {
      return `https://wa.me/91${cleanedPhone}?text=${encodedText}`
    }
    return `https://wa.me/${cleanedPhone}?text=${encodedText}`
  },

  /**
   * Fetches saved reminders for a user
   */
  async getReminders(userId: string): Promise<{ data: Reminder[]; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const local = localStorage.getItem(`${LOCAL_STORAGE_REMINDERS_KEY}_${userId}`)
      return { data: local ? JSON.parse(local) : [], error: null }
    }

    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { data: [], error: new Error('Unable to fetch reminders.') }
      }

      return { data: (data || []) as Reminder[], error: null }
    } catch (err: any) {
      return { data: [], error: new Error(err.message || 'Failed to load reminders.') }
    }
  },

  /**
   * Persists drafts to database or local storage
   */
  async saveReminders(
    userId: string,
    reminders: Partial<Reminder>[]
  ): Promise<{ data: Reminder[]; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const mapped = reminders.map((r) => ({
        id: r.id || crypto.randomUUID(),
        user_id: userId,
        customer_name: r.customer_name || '',
        phone: r.phone || null,
        amount_due: Number(r.amount_due) || 0,
        oldest_due_date: r.oldest_due_date || null,
        language: r.language || 'english',
        tone: (r.tone as any) || 'polite',
        message: r.message || '',
        status: r.status || 'drafted',
        created_at: new Date().toISOString(),
      })) as Reminder[]

      const current = await this.getReminders(userId)
      const combined = [...mapped, ...current.data]
      localStorage.setItem(`${LOCAL_STORAGE_REMINDERS_KEY}_${userId}`, JSON.stringify(combined))
      return { data: mapped, error: null }
    }

    try {
      const formatted = reminders.map((r) => ({
        ...r,
        user_id: userId,
      }))

      const { data, error } = await supabase
        .from('reminders')
        .insert(formatted)
        .select()

      if (error) {
        return { data: [], error: new Error('Unable to save drafted reminders.') }
      }

      return { data: (data || []) as Reminder[], error: null }
    } catch (err: any) {
      return { data: [], error: new Error(err.message || 'Failed to save reminders.') }
    }
  },

  /**
   * Updates status of a reminder (drafted -> approved -> sent / skipped)
   */
  async updateReminderStatus(
    userId: string,
    reminderId: string,
    status: Reminder['status'],
    message?: string
  ): Promise<{ data: Reminder | null; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getReminders(userId)
      const idx = current.data.findIndex((r) => r.id === reminderId)
      if (idx !== -1) {
        current.data[idx].status = status
        if (message) current.data[idx].message = message
        localStorage.setItem(`${LOCAL_STORAGE_REMINDERS_KEY}_${userId}`, JSON.stringify(current.data))
        return { data: current.data[idx], error: null }
      }
      return { data: null, error: new Error('Reminder not found') }
    }

    try {
      const payload: Record<string, any> = { status }
      if (message) payload.message = message

      const { data, error } = await supabase
        .from('reminders')
        .update(payload)
        .eq('id', reminderId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error('Unable to update reminder status.') }
      }

      return { data: data as Reminder, error: null }
    } catch (err: any) {
      return { data: null, error: new Error(err.message || 'Failed to update reminder.') }
    }
  },
}
