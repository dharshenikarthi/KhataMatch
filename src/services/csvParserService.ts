import Papa from 'papaparse'

export interface ColumnMapping {
  dateCol: string | null
  payerCol: string | null
  amountCol: string | null
  debitCol?: string | null
  refCol: string | null
  directionCol: string | null
}

export type TransactionDirection = 'incoming' | 'outgoing' | 'unknown'
export type ValidationStatus = 'valid' | 'invalid' | 'possible_duplicate' | 'excluded' | 'needs_review'

export interface ParsedTransactionRow {
  rowNumber: number
  date: string | null
  originalDateString: string | null
  payerName: string
  amount: number
  reference: string | null
  direction: TransactionDirection
  status: ValidationStatus
  validationReason?: string | null
  rawRow: Record<string, any>
  isDuplicate?: boolean
  duplicateReason?: string | null
}

export interface CsvParseResult {
  headers: string[]
  rows: ParsedTransactionRow[]
  totalRows: number
  validRows: number
  invalidRows: number
  outgoingRows: number
  totalIncomingAmount: number
  mapping: ColumnMapping
  mappingComplete: boolean
  warnings: string[]
  delimiter: string
}

// Candidate dictionaries (normalized lowercase)
const DATE_CANDIDATES = [
  'date', 'transaction date', 'transaction_date', 'txn date', 'txndate',
  'paid at', 'paid_at', 'timestamp', 'value date', 'value_date', 'post date'
]

const PAYER_CANDIDATES = [
  'payer_name', 'payer name', 'payer', 'name', 'sender', 'sender name',
  'customer', 'customer name', 'description', 'narration', 'particulars',
  'remarks', 'payee/payer', 'beneficiary/remitter'
]

const AMOUNT_CANDIDATES = [
  'amount', 'transaction amount', 'transaction_amount', 'paid amount',
  'credit amount', 'credit_amount', 'deposit', 'cr', 'credit', 'inflow',
  'amount (inr)', 'txn amount', 'net amount'
]

const DEBIT_CANDIDATES = [
  'withdrawal', 'debit', 'dr', 'debit amount', 'withdrawal amount', 'outflow'
]

const REF_CANDIDATES = [
  'reference', 'reference number', 'reference_number', 'ref no', 'ref_no',
  'transaction id', 'transaction_id', 'txn id', 'txnid', 'utr',
  'upi reference', 'upi_ref_no', 'rrn', 'cheque/ref no'
]

const DIRECTION_CANDIDATES = [
  'type', 'transaction type', 'txn type', 'credit/debit', 'cr/dr', 'direction', 'dr/cr'
]

/**
 * Normalizes an amount string (supports ₹, INR, 1,250.00, 1250,00)
 */
export function normalizeAmount(raw: any): { amount: number | null; error?: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { amount: null, error: 'Amount is empty' }
  }

  let str = String(raw).trim()
  // Remove currency symbols & words
  str = str.replace(/[₹$€£]|INR|Rs\.?|\/-|\s/gi, '')

  // Handle European comma decimals if no other period exists: "1250,50" -> "1250.50"
  if (str.includes(',') && !str.includes('.')) {
    const parts = str.split(',')
    if (parts.length === 2 && parts[1].length <= 2) {
      str = `${parts[0]}.${parts[1]}`
    } else {
      str = str.replace(/,/g, '')
    }
  } else {
    str = str.replace(/,/g, '')
  }

  const num = parseFloat(str)
  if (isNaN(num)) {
    return { amount: null, error: 'Amount is not a valid number' }
  }

  return { amount: Math.abs(num) }
}

/**
 * Normalizes different date formats to ISO YYYY-MM-DD
 */
export function normalizeDate(raw: any): { date: string | null; isAmbiguous?: boolean; error?: string } {
  if (!raw || typeof raw !== 'string') {
    return { date: null, error: 'Missing date' }
  }

  const str = raw.trim()
  if (!str) return { date: null, error: 'Empty date string' }

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (isoMatch) {
    const year = isoMatch[1]
    const month = isoMatch[2].padStart(2, '0')
    const day = isoMatch[3].padStart(2, '0')
    return { date: `${year}-${month}-${day}` }
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY or MM/DD/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10)
    const p2 = parseInt(dmyMatch[2], 10)
    let year = dmyMatch[3]
    if (year.length === 2) {
      year = `20${year}`
    }

    // If first part > 12, it is definitely DD-MM-YYYY
    if (p1 > 12 && p2 <= 12) {
      return { date: `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}` }
    }

    // If second part > 12, it is MM-DD-YYYY
    if (p2 > 12 && p1 <= 12) {
      return { date: `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}` }
    }

    // Default to Indian standard (DD-MM-YYYY)
    return {
      date: `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`,
      isAmbiguous: true,
    }
  }

  // 3. Fallback standard JavaScript Date parsing
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    return { date: parsed.toISOString().split('T')[0] }
  }

  return { date: null, error: 'Unrecognized date format' }
}

/**
 * Finds matching column header from candidate list
 */
function findBestHeaderMatch(headers: string[], candidates: string[]): string | null {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[\-_]/g, ' '))

  // 1. Exact match
  for (const candidate of candidates) {
    const idx = normalizedHeaders.findIndex((h) => h === candidate)
    if (idx !== -1) return headers[idx]
  }

  // 2. Partial / substring match
  for (const candidate of candidates) {
    const idx = normalizedHeaders.findIndex((h) => h.includes(candidate) || candidate.includes(h))
    if (idx !== -1) return headers[idx]
  }

  return null
}

export const csvParserService = {
  /**
   * Detects automatic column mappings from CSV headers
   */
  autoDetectMapping(headers: string[]): ColumnMapping {
    const dateCol = findBestHeaderMatch(headers, DATE_CANDIDATES)
    const payerCol = findBestHeaderMatch(headers, PAYER_CANDIDATES)
    const amountCol = findBestHeaderMatch(headers, AMOUNT_CANDIDATES)
    const debitCol = findBestHeaderMatch(headers, DEBIT_CANDIDATES)
    const refCol = findBestHeaderMatch(headers, REF_CANDIDATES)
    const directionCol = findBestHeaderMatch(headers, DIRECTION_CANDIDATES)

    return {
      dateCol,
      payerCol,
      amountCol,
      debitCol,
      refCol,
      directionCol,
    }
  },

  /**
   * Parses raw CSV text string into structured transaction rows
   */
  parseCsvString(csvString: string, userMapping?: Partial<ColumnMapping>): CsvParseResult {
    const warnings: string[] = []

    // 1. Strip UTF-8 BOM if present
    let cleanCsv = csvString.trim()
    if (cleanCsv.charCodeAt(0) === 0xFEFF) {
      cleanCsv = cleanCsv.slice(1)
    }

    if (!cleanCsv) {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        outgoingRows: 0,
        totalIncomingAmount: 0,
        mapping: { dateCol: null, payerCol: null, amountCol: null, refCol: null, directionCol: null },
        mappingComplete: false,
        warnings: ['The CSV file is empty.'],
        delimiter: ',',
      }
    }

    // 2. Parse using PapaParse
    const parsed = Papa.parse<Record<string, any>>(cleanCsv, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
    })

    const headers = parsed.meta.fields || []
    const delimiter = parsed.meta.delimiter || ','

    // 3. Resolve Column Mapping
    const autoMap = this.autoDetectMapping(headers)
    const mapping: ColumnMapping = {
      dateCol: userMapping?.dateCol !== undefined ? userMapping.dateCol : autoMap.dateCol,
      payerCol: userMapping?.payerCol !== undefined ? userMapping.payerCol : autoMap.payerCol,
      amountCol: userMapping?.amountCol !== undefined ? userMapping.amountCol : autoMap.amountCol,
      debitCol: userMapping?.debitCol !== undefined ? userMapping.debitCol : autoMap.debitCol,
      refCol: userMapping?.refCol !== undefined ? userMapping.refCol : autoMap.refCol,
      directionCol: userMapping?.directionCol !== undefined ? userMapping.directionCol : autoMap.directionCol,
    }

    const mappingComplete = Boolean(mapping.amountCol && (mapping.payerCol || mapping.refCol))

    if (!mapping.amountCol) {
      warnings.push('Could not auto-detect the payment amount column. Please map it manually.')
    }
    if (!mapping.payerCol) {
      warnings.push('Could not auto-detect the payer/description column. Please map it manually.')
    }

    // 4. Parse Rows
    const rows: ParsedTransactionRow[] = []
    let validRows = 0
    let invalidRows = 0
    let outgoingRows = 0
    let totalIncomingAmount = 0

    const rawData = parsed.data || []

    for (let i = 0; i < rawData.length; i++) {
      const rawRow = rawData[i]
      const rowNumber = i + 1

      // Read values based on mapping
      const rawPayer = mapping.payerCol ? rawRow[mapping.payerCol] : ''
      const rawAmount = mapping.amountCol ? rawRow[mapping.amountCol] : ''
      const rawDebit = mapping.debitCol ? rawRow[mapping.debitCol] : ''
      const rawDate = mapping.dateCol ? rawRow[mapping.dateCol] : ''
      const rawRef = mapping.refCol ? rawRow[mapping.refCol] : ''
      const rawDir = mapping.directionCol ? rawRow[mapping.directionCol] : ''

      // Clean payer name & extract clean names if UPI description contains prefixes
      let payerName = String(rawPayer || '').trim()
      if (payerName.startsWith('UPI-') || payerName.startsWith('UPI/')) {
        payerName = payerName.replace(/^UPI[-/]/, '').trim()
      }

      // Amount calculation
      const amtResult = normalizeAmount(rawAmount)
      const debitResult = mapping.debitCol ? normalizeAmount(rawDebit) : { amount: null }
      const dateResult = normalizeDate(rawDate)

      let direction: TransactionDirection = 'incoming'
      let finalAmount = amtResult.amount || 0
      let status: ValidationStatus = 'valid'
      let validationReason: string | null = null

      // Check separate debit/credit column logic
      if (mapping.debitCol && debitResult.amount && debitResult.amount > 0 && (!amtResult.amount || amtResult.amount === 0)) {
        direction = 'outgoing'
        finalAmount = debitResult.amount
        status = 'excluded'
        validationReason = 'Outgoing debit transaction (excluded from income matching)'
        outgoingRows++
      } else if (rawDir) {
        const dirStr = String(rawDir).toLowerCase().trim()
        if (dirStr.includes('dr') || dirStr.includes('debit') || dirStr.includes('withdrawal') || dirStr.includes('outflow')) {
          direction = 'outgoing'
          status = 'excluded'
          validationReason = 'Marked as debit/withdrawal in statement'
          outgoingRows++
        }
      }

      // If amount is invalid or zero
      if (direction === 'incoming') {
        if (!amtResult.amount || amtResult.amount <= 0) {
          status = 'invalid'
          validationReason = amtResult.error || 'Amount must be greater than zero'
          invalidRows++
        } else if (!payerName && !rawRef) {
          status = 'invalid'
          validationReason = 'Missing both payer name and transaction reference'
          invalidRows++
        } else {
          validRows++
          totalIncomingAmount += finalAmount
        }
      }

      const reference = rawRef ? String(rawRef).trim() : null

      rows.push({
        rowNumber,
        date: dateResult.date,
        originalDateString: rawDate ? String(rawDate).trim() : null,
        payerName: payerName || (reference ? `UPI ${reference}` : 'Unnamed Payer'),
        amount: finalAmount,
        reference,
        direction,
        status,
        validationReason,
        rawRow,
      })
    }

    return {
      headers,
      rows,
      totalRows: rows.length,
      validRows,
      invalidRows,
      outgoingRows,
      totalIncomingAmount,
      mapping,
      mappingComplete,
      warnings,
      delimiter,
    }
  },
}
