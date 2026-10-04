export type Language = 'english' | 'tamil' | 'tanglish'
export type ReminderTone = 'polite' | 'friendly' | 'firm'
export type ReminderStyle = 'friendly' | 'professional' | 'gentle' | 'short'

export type LedgerEntryType = 'credit' | 'payment'
export type LedgerEntryStatus = 'active' | 'struck_out' | 'deleted'

export interface Profile {
  id: string
  shop_name: string
  preferred_language: Language
  tone: ReminderTone
  created_at?: string
}

export interface LedgerEntry {
  id: string
  user_id?: string
  customer_name: string
  name_normalized: string
  amount: number
  entry_date: string | null
  type: LedgerEntryType
  status: LedgerEntryStatus
  confidence: number // 0.0 to 1.0
  source_image_path?: string | null
  confirmed: boolean
  note?: string | null
  created_at?: string
}

export interface Payment {
  id: string
  user_id?: string
  payer_name: string
  amount: number
  paid_at: string | null
  reference: string | null
  raw_row?: Record<string, any>
  created_at?: string
}

export type MatchType = 'exact' | 'fuzzy' | 'ambiguous' | 'unmatched'
export type MatchReviewStatus = 'suggested' | 'confirmed' | 'rejected'
export type DeterministicRuleType =
  | 'RULE_1_EXACT_MATCH'
  | 'RULE_2_NAME_AND_AMOUNT'
  | 'RULE_3_AMOUNT_AND_DATE'
  | 'RULE_4_PARTIAL_EVIDENCE'
  | 'UNMATCHED'

export interface PaymentMatch {
  id: string
  user_id?: string
  payment_id: string
  ledger_entry_id: string | null
  match_type: MatchType
  confidence: number
  reason: string
  user_confirmed: boolean
  status?: MatchReviewStatus
  rule?: DeterministicRuleType
  date_diff_days?: number | null
  created_at?: string
  // populated relations for UI convenience
  payment?: Payment
  ledger_entry?: LedgerEntry
  candidate_entries?: LedgerEntry[]
}

export type ReminderStatus = 'drafted' | 'approved' | 'sent' | 'skipped'

export interface Reminder {
  id: string
  user_id?: string
  customer_name: string
  phone?: string | null
  amount_due: number
  oldest_due_date?: string | null
  language: Language
  tone: ReminderTone
  message: string
  status: ReminderStatus
  word_count?: number
  created_at?: string
}

export type ReminderHistoryStatus = 'draft' | 'copied' | 'opened_in_whatsapp' | 'follow_up' | 'archived'
export type FollowUpStatus = 'due_today' | 'overdue' | 'upcoming' | 'unscheduled' | 'completed'

export interface ReminderHistoryItem {
  id: string
  user_id?: string
  customer_name: string
  phone?: string | null
  amount_due: number
  ledger_entry_ids?: string[]
  message: string
  style: ReminderStyle
  language: Language
  status: ReminderHistoryStatus
  next_follow_up_at?: string | null
  notes?: string
  created_at: string
  updated_at: string
  // Computed client properties
  followUpStatus?: FollowUpStatus
  currentOutstandingAmount?: number
  isBalanceOutdated?: boolean
}

export interface ReminderActivityLog {
  id: string
  reminder_id: string
  action: 'draft_created' | 'draft_edited' | 'message_copied' | 'whatsapp_opened' | 'follow_up_scheduled' | 'archived' | 'restored'
  timestamp: string
  details?: string
}

export interface EvalRun {
  id: string
  created_at: string
  extraction_accuracy: number
  match_accuracy: number
  n_cases: number
  details?: any
}

export type ScreenType = 'upload' | 'review' | 'matches' | 'reminders'
