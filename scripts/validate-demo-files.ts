import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'
import { csvParserService } from '../src/services/csvParserService'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const demoDir = path.resolve(__dirname, '../demo-files')

console.log('========================================================')
console.log('         VALIDATING PRODUCTION DEMO DATASETS            ')
console.log('========================================================\n')

let passCount = 0
let failCount = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passCount++
    console.log(`✓ PASS: ${testName}`)
  } else {
    failCount++
    console.error(`✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`)
  }
}

// 1. Validate File 1: demo_customer_ledger.xlsx
const file1 = path.join(demoDir, 'demo_customer_ledger.xlsx')
assert(fs.existsSync(file1), 'demo_customer_ledger.xlsx exists on disk')
const buf1 = fs.readFileSync(file1)
const wb1 = XLSX.read(buf1, { type: 'buffer' })
assert(wb1.SheetNames.includes('Customer_Ledger'), 'demo_customer_ledger.xlsx has Customer_Ledger sheet')
const data1: any[] = XLSX.utils.sheet_to_json(wb1.Sheets['Customer_Ledger'])
assert(data1.length >= 25 && data1.length <= 40, `demo_customer_ledger.xlsx contains ${data1.length} records (25-40 expected)`)
assert(Boolean(data1[0].Customer_Name && data1[0].Amount && data1[0].Date), 'demo_customer_ledger.xlsx has expected ledger columns')

// 2. Validate File 2: demo_upi_statement.csv
const file2 = path.join(demoDir, 'demo_upi_statement.csv')
assert(fs.existsSync(file2), 'demo_upi_statement.csv exists on disk')
const csvContent2 = fs.readFileSync(file2, 'utf-8')
const parseResult2 = csvParserService.parseCsvString(csvContent2)
assert(parseResult2.mappingComplete === true, 'demo_upi_statement.csv auto-maps all required columns')
assert(parseResult2.totalRows >= 30 && parseResult2.totalRows <= 50, `demo_upi_statement.csv contains ${parseResult2.totalRows} rows (30-50 expected)`)
assert(parseResult2.validRows > 0, `demo_upi_statement.csv contains ${parseResult2.validRows} valid incoming transactions`)
assert(parseResult2.outgoingRows > 0, `demo_upi_statement.csv correctly detects ${parseResult2.outgoingRows} outgoing debits`)

// 3. Validate File 3: demo_ledger.xlsx
const file3 = path.join(demoDir, 'demo_ledger.xlsx')
assert(fs.existsSync(file3), 'demo_ledger.xlsx exists on disk')
const buf3 = fs.readFileSync(file3)
const wb3 = XLSX.read(buf3, { type: 'buffer' })
assert(wb3.SheetNames.includes('Auto_Spares_Ledger'), 'demo_ledger.xlsx has Auto_Spares_Ledger sheet')
const data3: any[] = XLSX.utils.sheet_to_json(wb3.Sheets['Auto_Spares_Ledger'])
assert(data3.length >= 15 && data3.length <= 25, `demo_ledger.xlsx contains ${data3.length} records (15-25 expected)`)

// 4. Validate File 4: demo_upi_statement_unmatched.csv
const file4 = path.join(demoDir, 'demo_upi_statement_unmatched.csv')
assert(fs.existsSync(file4), 'demo_upi_statement_unmatched.csv exists on disk')
const csvContent4 = fs.readFileSync(file4, 'utf-8')
const parseResult4 = csvParserService.parseCsvString(csvContent4)
assert(parseResult4.mappingComplete === true, 'demo_upi_statement_unmatched.csv auto-maps all required columns')
assert(parseResult4.totalRows >= 30 && parseResult4.totalRows <= 50, `demo_upi_statement_unmatched.csv contains ${parseResult4.totalRows} rows (30-50 expected)`)
assert(parseResult4.validRows > 0, `demo_upi_statement_unmatched.csv contains ${parseResult4.validRows} valid incoming transactions`)

console.log('\n========================================================')
console.log(`DEMO DATASET VALIDATION SUMMARY: ${passCount} passed, ${failCount} failed.`)
console.log('========================================================\n')

if (failCount > 0) {
  process.exit(1)
}
