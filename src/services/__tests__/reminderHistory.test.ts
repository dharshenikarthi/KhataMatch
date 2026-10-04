import {
  reminderHistoryService,
  SaveReminderHistoryInput,
} from '../reminderHistoryService'
import { ReminderHistoryItem, ReminderHistoryStatus, FollowUpStatus } from '../../types'
import { CustomerSummaryBalance } from '../balanceTrackingService'

async function runTests() {
  console.log('--- STARTING REMINDER HISTORY & FOLLOW-UP TEST SUITE ---')
  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`)
      passed++
    } else {
      console.error(`✗ FAIL: ${testName}`)
      failed++
    }
  }

  const testUserId = 'test-user-ph11'
  const todayStr = '2026-10-04'

  // 1. Follow-up Status Calculations
  assert(
    reminderHistoryService.calculateFollowUpStatus(null, 'draft', todayStr) === 'unscheduled',
    'Calculates unscheduled when no follow-up date is set'
  )
  assert(
    reminderHistoryService.calculateFollowUpStatus(`${todayStr}T00:00:00Z`, 'follow_up', todayStr) ===
      'due_today',
    'Calculates due_today when follow-up date matches current date'
  )
  assert(
    reminderHistoryService.calculateFollowUpStatus('2026-10-01T00:00:00Z', 'follow_up', todayStr) ===
      'overdue',
    'Calculates overdue when follow-up date is in the past'
  )
  assert(
    reminderHistoryService.calculateFollowUpStatus('2026-10-10T00:00:00Z', 'follow_up', todayStr) ===
      'upcoming',
    'Calculates upcoming when follow-up date is in the future'
  )
  assert(
    reminderHistoryService.calculateFollowUpStatus('2026-10-01T00:00:00Z', 'archived', todayStr) ===
      'completed',
    'Calculates completed when status is archived'
  )

  // 2. Save Reminder Draft
  const input1: SaveReminderHistoryInput = {
    customer_name: 'Murugan K',
    phone: '9876543210',
    amount_due: 1250,
    message: 'Namaste Murugan, gentle reminder regarding Rs. 1250.',
    style: 'friendly',
    language: 'english',
    status: 'draft',
    next_follow_up_at: '2026-10-07T00:00:00Z',
    notes: 'Called customer on Monday',
  }

  const saved1 = await reminderHistoryService.saveReminderHistory(testUserId, input1)
  assert(saved1.data !== null, 'Successfully saves reminder draft')
  assert(saved1.data?.customer_name === 'Murugan K', 'Persists customer name')
  assert(saved1.data?.amount_due === 1250, 'Persists verified amount due')
  assert(saved1.data?.status === 'draft', 'Initial status is draft')
  assert(saved1.data?.notes === 'Called customer on Monday', 'Persists shop notes')

  // 3. Edit Draft & Update Status
  const recordId = saved1.data!.id
  const updated1 = await reminderHistoryService.updateReminderHistory(testUserId, recordId, {
    message: 'Updated polite reminder message text.',
    status: 'copied',
  })
  assert(updated1.data?.message === 'Updated polite reminder message text.', 'Updates message content')
  assert(updated1.data?.status === 'copied', 'Updates status to copied')

  // 4. Reschedule Follow-up Date
  const rescheduled = await reminderHistoryService.updateReminderHistory(testUserId, recordId, {
    next_follow_up_at: `${todayStr}T00:00:00Z`,
    status: 'follow_up',
  })
  assert(rescheduled.data?.status === 'follow_up', 'Sets status to follow_up')
  assert(
    rescheduled.data?.followUpStatus === 'due_today',
    'Recalculates followUpStatus to due_today after rescheduling'
  )

  // 5. WhatsApp Opened Action Tracking (Never marks as "delivered" or "sent")
  const waOpened = await reminderHistoryService.updateReminderHistory(testUserId, recordId, {
    status: 'opened_in_whatsapp',
  })
  assert(waOpened.data?.status === 'opened_in_whatsapp', 'Tracks opened_in_whatsapp action reliably')
  assert(
    (waOpened.data?.status as string) !== 'sent' && (waOpened.data as any).status !== 'delivered',
    'Strict integrity: never sets unverified sent or delivered status'
  )

  // 6. Archive & Delete Actions
  const archived = await reminderHistoryService.updateReminderHistory(testUserId, recordId, {
    status: 'archived',
  })
  assert(archived.data?.status === 'archived', 'Archives reminder record')
  assert(archived.data?.followUpStatus === 'completed', 'Follow-up status becomes completed on archive')

  const deleted = await reminderHistoryService.deleteReminderHistory(testUserId, recordId)
  assert(deleted.success === true, 'Deletes reminder record successfully')

  // 7. Live Balance Enrichment & Outdated Amount Detection
  const historyDraft: ReminderHistoryItem = {
    id: 'h1',
    user_id: testUserId,
    customer_name: 'Priya',
    amount_due: 1000, // Originally drafted for ₹1,000
    message: 'Reminder for Rs. 1000',
    style: 'friendly',
    language: 'english',
    status: 'draft',
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
  }

  // Case A: Customer paid ₹400 in between -> Current balance is ₹600
  const liveCustomerBalances: CustomerSummaryBalance[] = [
    {
      customerName: 'Priya',
      nameNormalized: 'priya',
      totalOriginalAmount: 1000,
      totalPaidAmount: 400,
      totalOutstandingAmount: 600, // Now ₹600
      overallStatus: 'partially_paid',
      entriesCount: 1,
      unpaidEntriesCount: 1,
      latestActivityDate: '2026-09-12',
      ledgerEntries: [],
      allocatedPayments: [],
    },
  ]

  const enriched = reminderHistoryService.enrichWithLiveBalances([historyDraft], liveCustomerBalances)
  assert(enriched[0].currentOutstandingAmount === 600, 'Fetches live current balance ₹600')
  assert(enriched[0].isBalanceOutdated === true, 'Flags isBalanceOutdated = true when amount changed')

  // Case B: Customer has NOT made any payments -> Amount matches
  const unchangedBalances: CustomerSummaryBalance[] = [
    {
      customerName: 'Priya',
      nameNormalized: 'priya',
      totalOriginalAmount: 1000,
      totalPaidAmount: 0,
      totalOutstandingAmount: 1000,
      overallStatus: 'unpaid',
      entriesCount: 1,
      unpaidEntriesCount: 1,
      latestActivityDate: '2026-09-10',
      ledgerEntries: [],
      allocatedPayments: [],
    },
  ]
  const enrichedUnchanged = reminderHistoryService.enrichWithLiveBalances([historyDraft], unchangedBalances)
  assert(enrichedUnchanged[0].isBalanceOutdated === false, 'isBalanceOutdated = false when amount is unchanged')

  // 8. Follow-up Metrics Calculation
  const mockQueue: ReminderHistoryItem[] = [
    {
      id: 'm1',
      customer_name: 'A',
      amount_due: 500,
      message: '',
      style: 'friendly',
      language: 'english',
      status: 'draft',
      followUpStatus: 'due_today',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'm2',
      customer_name: 'B',
      amount_due: 700,
      message: '',
      style: 'friendly',
      language: 'english',
      status: 'follow_up',
      followUpStatus: 'overdue',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'm3',
      customer_name: 'C',
      amount_due: 300,
      message: '',
      style: 'friendly',
      language: 'english',
      status: 'follow_up',
      followUpStatus: 'upcoming',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'm4',
      customer_name: 'D',
      amount_due: 200,
      message: '',
      style: 'friendly',
      language: 'english',
      status: 'archived',
      followUpStatus: 'completed',
      created_at: '',
      updated_at: '',
    },
  ]

  const metrics = reminderHistoryService.computeFollowUpMetrics(mockQueue)
  assert(metrics.dueTodayCount === 1, 'Counts 1 follow-up due today')
  assert(metrics.overdueCount === 1, 'Counts 1 overdue follow-up')
  assert(metrics.upcomingCount === 1, 'Counts 1 upcoming follow-up')
  assert(metrics.totalActiveDrafts === 3, 'Excludes archived items from active draft count')
  assert(metrics.totalOutstandingInQueue === 1500, 'Sums active dues: 500 + 700 + 300 = 1500')

  // 9. User Data Isolation
  const user1Item = await reminderHistoryService.saveReminderHistory('user_A', {
    customer_name: 'Customer A',
    amount_due: 100,
    message: 'User A draft',
  })
  const user2Item = await reminderHistoryService.saveReminderHistory('user_B', {
    customer_name: 'Customer B',
    amount_due: 200,
    message: 'User B draft',
  })

  const user1List = await reminderHistoryService.getReminderHistory('user_A')
  assert(
    user1List.data.every((r) => r.customer_name !== 'Customer B'),
    'User A cannot access User B reminder history'
  )

  console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

runTests()
