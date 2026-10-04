import { reminderService, ReminderCustomerItem } from '../reminderService'
import { balanceTrackingService } from '../balanceTrackingService'
import { LedgerEntry, PaymentMatch } from '../../types'

async function runTests() {
  console.log('--- STARTING REMINDER GENERATION TEST SUITE ---')
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

  // 1. Generate Friendly Style Draft
  const singleItem: ReminderCustomerItem = {
    customer_name: 'Murugan K',
    amount_due: 1250,
    original_amount: 1250,
    paid_amount: 0,
    ledger_date: '2026-09-10',
  }

  const friendlyRes = await reminderService.generateDrafts({
    items: [singleItem],
    style: 'friendly',
    language: 'english',
    shop_name: 'Murugan Textiles',
  })

  assert(friendlyRes.data.length === 1, 'Generates 1 friendly draft')
  assert(friendlyRes.data[0].amount_due === 1250, 'Uses exact verified amount 1250')
  assert(friendlyRes.data[0].customer_name === 'Murugan K', 'Uses verified customer name')
  assert(friendlyRes.data[0].message.includes('1250'), 'Message includes exact amount 1250')
  assert(friendlyRes.data[0].message.includes('Murugan Textiles'), 'Message includes shop name')
  assert(
    !friendlyRes.data[0].message.toLowerCase().includes('overdue') &&
      !friendlyRes.data[0].message.toLowerCase().includes('penalty'),
    'Friendly message avoids accusatory or overdue pressure language'
  )

  // 2. Generate Professional Style Draft
  const profRes = await reminderService.generateDrafts({
    items: [singleItem],
    style: 'professional',
    language: 'english',
    shop_name: 'Murugan Textiles',
  })
  assert(profRes.data[0].style === 'professional', 'Sets style to professional')
  assert(profRes.data[0].message.includes('outstanding balance'), 'Professional message uses formal phrasing')

  // 3. Generate Gentle Follow-up Draft
  const gentleRes = await reminderService.generateDrafts({
    items: [singleItem],
    style: 'gentle',
    language: 'english',
    shop_name: 'Murugan Textiles',
  })
  assert(gentleRes.data[0].style === 'gentle', 'Sets style to gentle')
  assert(
    !gentleRes.data[0].message.toLowerCase().includes('3rd notice') &&
      !gentleRes.data[0].message.toLowerCase().includes('final warning'),
    'Gentle follow-up does not invent fake past reminder history'
  )

  // 4. Generate Short WhatsApp Message Draft
  const shortRes = await reminderService.generateDrafts({
    items: [singleItem],
    style: 'short',
    language: 'english',
    shop_name: 'Murugan Textiles',
  })
  assert(shortRes.data[0].style === 'short', 'Sets style to short')
  assert(shortRes.data[0].word_count < 40, 'Short WhatsApp message is concise (< 40 words)')

  // 5. Multi-language Support (Tamil & Tanglish)
  const tamilRes = await reminderService.generateDrafts({
    items: [singleItem],
    style: 'friendly',
    language: 'tamil',
    shop_name: 'முருகன் டெக்ஸ்டைல்ஸ்',
  })
  assert(tamilRes.data[0].language === 'tamil', 'Drafts in Tamil script')
  assert(tamilRes.data[0].message.includes('வணக்கம்'), 'Tamil message includes polite greeting')

  const tanglishRes = await reminderService.generateDrafts({
    items: [singleItem],
    style: 'friendly',
    language: 'tanglish',
    shop_name: 'Murugan Textiles',
  })
  assert(tanglishRes.data[0].language === 'tanglish', 'Drafts in Tanglish')
  assert(tanglishRes.data[0].message.includes('Vanakkam'), 'Tanglish message includes Vanakkam')

  // 6. Excludes Fully Paid Entries (0 Balance)
  const zeroItem: ReminderCustomerItem = {
    customer_name: 'Ravi Kumar',
    amount_due: 0,
    original_amount: 2000,
    paid_amount: 2000,
  }
  const zeroRes = await reminderService.generateDrafts({
    items: [zeroItem],
    style: 'friendly',
    language: 'english',
  })
  assert(zeroRes.data.length === 0, 'Zero/settled balance entries are strictly excluded')
  assert(zeroRes.error !== null, 'Returns validation error when all entries are zero')

  // 7. Handling Missing Customer Names Gracefully
  const anonymousItem: ReminderCustomerItem = {
    customer_name: '',
    amount_due: 500,
    original_amount: 500,
  }
  const anonRes = await reminderService.generateDrafts({
    items: [anonymousItem],
    style: 'friendly',
    language: 'english',
  })
  assert(anonRes.data.length === 1, 'Generates draft even if customer name is blank')
  assert(anonRes.data[0].customer_name === 'Customer', 'Falls back safely to "Customer"')

  // 8. Combining Multiple Entries for One Customer
  const multipleEntries: LedgerEntry[] = [
    {
      id: 'l1',
      customer_name: 'Priya',
      name_normalized: 'priya',
      amount: 750,
      entry_date: '2026-09-10',
      type: 'credit',
      status: 'active',
      confidence: 0.95,
      confirmed: true,
    },
    {
      id: 'l2',
      customer_name: 'Priya',
      name_normalized: 'priya',
      amount: 450,
      entry_date: '2026-09-14',
      type: 'credit',
      status: 'active',
      confidence: 0.95,
      confirmed: true,
    },
  ]
  const ledgerBalances = balanceTrackingService.calculateLedgerBalances(multipleEntries, [])
  const custSummary = balanceTrackingService.aggregateCustomerBalances(ledgerBalances)
  assert(custSummary.length === 1, 'Groups 2 entries into 1 customer summary')
  assert(custSummary[0].totalOutstandingAmount === 1200, 'Calculates verified total of 1200 (750 + 450)')

  const combinedReminderItem: ReminderCustomerItem = {
    customer_name: custSummary[0].customerName,
    amount_due: custSummary[0].totalOutstandingAmount,
    original_amount: custSummary[0].totalOriginalAmount,
    entries_count: custSummary[0].entriesCount,
  }
  const combinedRes = await reminderService.generateDrafts({
    items: [combinedReminderItem],
    style: 'friendly',
    language: 'english',
  })
  assert(combinedRes.data[0].amount_due === 1200, 'Combined reminder states exact total sum 1200')

  // 9. Preventing Messages from Combining Different Customers
  const customerA: ReminderCustomerItem = { customer_name: 'Anand', amount_due: 300 }
  const customerB: ReminderCustomerItem = { customer_name: 'Bala', amount_due: 600 }
  const multiCustomerRes = await reminderService.generateDrafts({
    items: [customerA, customerB],
    style: 'friendly',
    language: 'english',
  })
  assert(multiCustomerRes.data.length === 2, 'Generates 2 discrete reminder drafts for 2 distinct customers')
  assert(
    !multiCustomerRes.data[0].message.includes('Bala') && !multiCustomerRes.data[1].message.includes('Anand'),
    'Customer privacy protected: zero cross-customer data leakage'
  )

  // 10. WhatsApp Message URL Encoding
  const testPhone = '9876543210'
  const testMsg = 'Namaste Murugan! Outstanding: Rs. 1,250 & thanks.'
  const waUrl = reminderService.buildWhatsAppClickUrl(testPhone, testMsg)
  assert(waUrl.startsWith('https://wa.me/919876543210?text='), 'Formats 10-digit Indian phone with country code')
  assert(waUrl.includes('Rs.%201%2C250%20%26%20thanks.'), 'Encodes special characters (&, comma, spaces) safely')

  const waNoPhoneUrl = reminderService.buildWhatsAppClickUrl(null, testMsg)
  assert(waNoPhoneUrl.startsWith('https://wa.me/?text='), 'Generates generic wa.me link when phone is missing')

  // 11. Immutability: Verify financial ledger entries are NOT altered
  assert(multipleEntries[0].amount === 750, 'Original ledger amount remains immutable')
  assert(multipleEntries[1].amount === 450, 'Original ledger amount remains immutable')

  console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

runTests()
