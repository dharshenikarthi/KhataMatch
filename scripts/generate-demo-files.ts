import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const demoDir = path.resolve(__dirname, '../demo-files')
if (!fs.existsSync(demoDir)) {
  fs.mkdirSync(demoDir, { recursive: true })
}

// --------------------------------------------------------------------------
// 1. FILE 1: demo_customer_ledger.xlsx (Sri Murugan Tex & Garments - 30 records)
// --------------------------------------------------------------------------
const customerLedgerData = [
  { "Entry_ID": "INV-2026-001", "Date": "2026-09-01", "Customer_Name": "Ravi Kumar", "Amount": 1500, "Type": "credit", "Description": "2 School Uniform sets stitching", "Status": "paid", "Notes": "Paid via GPay same day" },
  { "Entry_ID": "INV-2026-002", "Date": "2026-09-01", "Customer_Name": "Murugan K", "Amount": 2500, "Type": "credit", "Description": "Silk saree fall and blouse stitching", "Status": "paid", "Notes": "Paid via PhonePe next day" },
  { "Entry_ID": "INV-2026-003", "Date": "2026-09-02", "Customer_Name": "Priya (தையல்)", "Amount": 800, "Type": "credit", "Description": "Chudidhar alteration & lining cloth", "Status": "paid", "Notes": "Paid via Paytm" },
  { "Entry_ID": "INV-2026-004", "Date": "2026-09-03", "Customer_Name": "Suresh Kumar", "Amount": 1200, "Type": "credit", "Description": "Pant shirt stitching 1 pair", "Status": "paid", "Notes": "Paid via UPI 3 days later" },
  { "Entry_ID": "INV-2026-005", "Date": "2026-09-04", "Customer_Name": "Anand S", "Amount": 3000, "Type": "credit", "Description": "Wedding suit tailoring balance", "Status": "paid", "Notes": "Paid via UPI on Sept 24 (20-day gap)" },
  { "Entry_ID": "INV-2026-006", "Date": "2026-09-05", "Customer_Name": "Meena", "Amount": 450, "Type": "credit", "Description": "Night dress alteration", "Status": "paid", "Notes": "Paid by husband Venkatesh via UPI" },
  { "Entry_ID": "INV-2026-007", "Date": "2026-09-06", "Customer_Name": "Karthik", "Amount": 2000, "Type": "credit", "Description": "Safari suit tailoring advance", "Status": "partially_paid", "Notes": "Paid ₹800 instalment, ₹1,200 balance" },
  { "Entry_ID": "INV-2026-008", "Date": "2026-09-07", "Customer_Name": "Deepa", "Amount": 3500, "Type": "credit", "Description": "Designer bridal lehenga stitching", "Status": "unpaid", "Notes": "Full due pending, reminder scheduled" },
  { "Entry_ID": "INV-2026-009", "Date": "2026-09-08", "Customer_Name": "Rajesh", "Amount": 500, "Type": "credit", "Description": "Zip replacement & shirt fitting", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "INV-2026-010", "Date": "2026-09-08", "Customer_Name": "Dinesh", "Amount": 500, "Type": "credit", "Description": "Cotton dhoti border stitching", "Status": "paid", "Notes": "Paid via UPI same amount" },
  { "Entry_ID": "INV-2026-011", "Date": "2026-09-09", "Customer_Name": "Saravanan", "Amount": 1000, "Type": "credit", "Description": "Formal trousers stitching 2 nos", "Status": "paid", "Notes": "Paid via GPay" },
  { "Entry_ID": "INV-2026-012", "Date": "2026-09-10", "Customer_Name": "Muthu Velu", "Amount": 650, "Type": "credit", "Description": "Safari shirt tailored", "Status": "paid", "Notes": "Paid via BHIM UPI" },
  { "Entry_ID": "INV-2026-013", "Date": "2026-09-11", "Customer_Name": "Gita", "Amount": 1750, "Type": "credit", "Description": "Fancy kurti stitching & buttons", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "INV-2026-014", "Date": "2026-09-12", "Customer_Name": "Sureshbabu", "Amount": 1800, "Type": "credit", "Description": "Linen shirts tailoring", "Status": "paid", "Notes": "Paid via UPI as Suresh Babu" },
  { "Entry_ID": "INV-2026-015", "Date": "2026-09-13", "Customer_Name": "Ramesh Sharma", "Amount": 1200, "Type": "credit", "Description": "Kurta pyjama stitching", "Status": "unpaid", "Notes": "Pending payment" },
  { "Entry_ID": "INV-2026-016", "Date": "2026-09-14", "Customer_Name": "Lakshmi", "Amount": 950, "Type": "credit", "Description": "Aari work blouse stitching", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "INV-2026-017", "Date": "2026-09-15", "Customer_Name": "Gopal", "Amount": 1100, "Type": "credit", "Description": "Pant alterations & waist tapering", "Status": "struck_out", "Notes": "Settled in cash over counter" },
  { "Entry_ID": "INV-2026-018", "Date": "2026-09-16", "Customer_Name": "Vasanth Enterprises", "Amount": 12450.50, "Type": "credit", "Description": "Bulk staff uniform order (50 pieces)", "Status": "paid", "Notes": "NEFT/UPI transfer completed" },
  { "Entry_ID": "INV-2026-019", "Date": "2026-09-17", "Customer_Name": "Chitra Akka", "Amount": 2200, "Type": "credit", "Description": "Festival saree tailoring and tassels", "Status": "paid", "Notes": "UPI received from CHITRA DEVI" },
  { "Entry_ID": "INV-2026-020", "Date": "2026-09-18", "Customer_Name": "Balaji Grocery", "Amount": 1750, "Type": "credit", "Description": "Worker aprons stitching (10 nos)", "Status": "paid", "Notes": "UPI received from REVATHI BALAJI" },
  { "Entry_ID": "INV-2026-021", "Date": "2026-09-19", "Customer_Name": "Ganesh", "Amount": 500, "Type": "credit", "Description": "Trouser pocket repair", "Status": "unpaid", "Notes": "Unpaid balance" },
  { "Entry_ID": "INV-2026-022", "Date": "2026-09-20", "Customer_Name": "Prakash", "Amount": 1000, "Type": "credit", "Description": "Formal shirts 2 nos stitching", "Status": "paid", "Notes": "Paid on Sept 21" },
  { "Entry_ID": "INV-2026-023", "Date": "2026-09-20", "Customer_Name": "Prakash", "Amount": 1500, "Type": "credit", "Description": "Safari suit tailoring second order", "Status": "unpaid", "Notes": "Pending payment" },
  { "Entry_ID": "INV-2026-024", "Date": "2026-09-21", "Customer_Name": "Geetha", "Amount": 600, "Type": "credit", "Description": "Salwar kameez alteration", "Status": "paid", "Notes": "Paid ₹1000 advance/overpayment" },
  { "Entry_ID": "INV-2026-025", "Date": "2026-09-22", "Customer_Name": "Babu", "Amount": 1500, "Type": "credit", "Description": "Kurta pyjama stitching", "Status": "paid", "Notes": "Paid via UPI same day" },
  { "Entry_ID": "INV-2026-026", "Date": "2026-09-23", "Customer_Name": "Sundar", "Amount": 2000, "Type": "credit", "Description": "Blazer alteration & velvet lapel", "Status": "partially_paid", "Notes": "Paid ₹500 partial payment" },
  { "Entry_ID": "INV-2026-027", "Date": "2026-09-24", "Customer_Name": "Kavitha", "Amount": 750, "Type": "credit", "Description": "School pinafore tailoring", "Status": "unpaid", "Notes": "Pending payment" },
  { "Entry_ID": "INV-2026-028", "Date": "2026-09-25", "Customer_Name": "Arumugam", "Amount": 1350, "Type": "credit", "Description": "Dhoti tailoring & angavastram set", "Status": "unpaid", "Notes": "Recent credit" },
  { "Entry_ID": "INV-2026-029", "Date": "2026-09-26", "Customer_Name": "Nalini", "Amount": 900, "Type": "credit", "Description": "Blouse hand embroidery design", "Status": "unpaid", "Notes": "Recent credit" },
  { "Entry_ID": "INV-2026-030", "Date": "2026-09-27", "Customer_Name": "Vimal Raj", "Amount": 2100, "Type": "credit", "Description": "3 Formal trousers tailoring", "Status": "unpaid", "Notes": "Recent credit" }
]

const ws1 = XLSX.utils.json_to_sheet(customerLedgerData)
const wb1 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb1, ws1, 'Customer_Ledger')
const file1Path = path.join(demoDir, 'demo_customer_ledger.xlsx')
XLSX.writeFile(wb1, file1Path)
console.log(`✓ Generated: ${file1Path} (${customerLedgerData.length} records)`)

// --------------------------------------------------------------------------
// 2. FILE 2: demo_upi_statement.csv (Bank/UPI Statement - 36 rows)
// --------------------------------------------------------------------------
const upiStatementRows = [
  // Exact Matches (Rule 1 & Rule 2)
  { Date: "2026-09-01", "Payer Name": "UPI-RAVI KUMAR", Amount: "1500.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624501987654", Description: "UPI Payment from Ravi Kumar" },
  { Date: "2026-09-02", "Payer Name": "UPI-K MURUGAN", Amount: "2500.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624502876543", Description: "Payment from K Murugan via PhonePe" },
  { Date: "2026-09-02", "Payer Name": "PRIYA", Amount: "800.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624503765432", Description: "UPI/Priya/Paytm transfer" },
  { Date: "2026-09-04", "Payer Name": "SURESH KUMAR", Amount: "1200.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624504654321", Description: "GPay payment Suresh Kumar" },
  { Date: "2026-08-30", "Payer Name": "UPI/ANAND S", Amount: "3000.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624505543210", Description: "IMPS/Anand S wedding suit tailoring" },
  { Date: "2026-09-05", "Payer Name": "RAJESH", Amount: "500.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624506432109", Description: "UPI/Rajesh" },
  { Date: "2026-09-05", "Payer Name": "DINESH", Amount: "500.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624507321098", Description: "UPI/Dinesh" },
  { Date: "2026-09-08", "Payer Name": "SARAVANAN", Amount: "1000.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624508210987", Description: "GPay/Saravanan" },
  { Date: "2026-09-10", "Payer Name": "MUTHU VELU", Amount: "650.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624509109876", Description: "BHIM/Muthu Velu tailoring" },
  { Date: "2026-09-11", "Payer Name": "GITA", Amount: "1750.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624510098765", Description: "UPI transfer from Gita" },
  { Date: "2026-09-12", "Payer Name": "SURESH BABU", Amount: "1800.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624511987654", Description: "PhonePe from Suresh Babu" },
  { Date: "2026-09-14", "Payer Name": "LAKSHMI", Amount: "950.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624512876543", Description: "UPI/Lakshmi blouse stitching" },
  { Date: "2026-09-16", "Payer Name": "VASANTH ENTERPRISES", Amount: "12450.50", "Transaction Type": "Credit", "Transaction ID": "UPI/624513765432", Description: "NEFT/Vasanth Enterprises uniform order" },
  { Date: "2026-09-21", "Payer Name": "PRAKASH", Amount: "1000.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624514654321", Description: "UPI/Prakash shirt tailoring" },
  { Date: "2026-09-22", "Payer Name": "BABU", Amount: "1500.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624515543210", Description: "UPI transfer from Babu" },

  // Partial Payments (Rule 4)
  { Date: "2026-09-06", "Payer Name": "KARTHIK", Amount: "800.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624516432109", Description: "UPI/Karthik safari advance" },
  { Date: "2026-09-23", "Payer Name": "SUNDAR", Amount: "500.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624517321098", Description: "UPI/Sundar partial payment" },

  // Overpayment / Advance (Rule 4)
  { Date: "2026-09-21", "Payer Name": "GEETHA", Amount: "1000.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624518210987", Description: "UPI/Geetha salwar tailoring" },

  // Competing Duplicate Unknown Payer
  { Date: "2026-09-08", "Payer Name": "UNKNOWN PAYER", Amount: "1000.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624519109876", Description: "UPI payment received without remitter info" },

  // Unmatched Incoming Bank Payments
  { Date: "2026-09-03", "Payer Name": "Amazon Pay Refund", Amount: "1299.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624520098765", Description: "E-Commerce Refund credited" },
  { Date: "2026-09-07", "Payer Name": "Jio Fiber Commercial Bill Refund", Amount: "349.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624520198766", Description: "Broadband security deposit return" },
  { Date: "2026-09-09", "Payer Name": "Zomato Partner Payout", Amount: "3450.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624521987654", Description: "Weekly online settlement payout" },
  { Date: "2026-09-15", "Payer Name": "Interest Credit - SBI", Amount: "142.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624522876543", Description: "Quarterly savings bank interest" },
  { Date: "2026-09-20", "Payer Name": "Sundaram Rental Security Refund", Amount: "2500.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624522987655", Description: "Shop maintenance deposit return" },
  { Date: "2026-09-25", "Payer Name": "Cashback Credited", Amount: "50.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624523765432", Description: "UPI Merchant Cashback reward" },
  { Date: "2026-09-27", "Payer Name": "Paytm Merchant Incentive", Amount: "125.00", "Transaction Type": "Credit", "Transaction ID": "UPI/624523876544", Description: "QR Soundbox incentive payment" },

  // Outgoing Debit Transactions (Excluded by direction filter)
  { Date: "2026-09-05", "Payer Name": "TNEB Electricity Bill", Amount: "1850.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624524654321", Description: "Shop EB Bill payment" },
  { Date: "2026-09-08", "Payer Name": "Sewing Needle Supplies", Amount: "380.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624524765433", Description: "Organ needle pack 100 nos" },
  { Date: "2026-09-10", "Payer Name": "Thread & Zipper Wholesale", Amount: "4200.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624525543210", Description: "Purchase of tailoring raw materials" },
  { Date: "2026-09-12", "Payer Name": "Scissors Sharpening & Repair", Amount: "180.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624525654322", Description: "Tailoring shears service" },
  { Date: "2026-09-15", "Payer Name": "Shop Rent - Sundaram", Amount: "8000.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624526432109", Description: "Monthly shop rent transfer" },
  { Date: "2026-09-18", "Payer Name": "Button & Buckle Pack", Amount: "650.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624526543211", Description: "Shirt buttons assorted colours" },
  { Date: "2026-09-20", "Payer Name": "Chai & Refreshments", Amount: "240.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624527321098", Description: "Tea stall payment via UPI" },
  { Date: "2026-09-24", "Payer Name": "Steam Iron Service & Water Filter", Amount: "450.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624527432100", Description: "Gravity iron cleaning" },
  { Date: "2026-09-26", "Payer Name": "Sewing Machine Service", Amount: "1150.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624528210987", Description: "Motor oil & needle replacement" },
  { Date: "2026-09-27", "Payer Name": "Sweeper & Waste Disposal", Amount: "300.00", "Transaction Type": "Debit", "Transaction ID": "UPI/624528321099", Description: "Monthly shop cleaning charges" }
]

function jsonToCsv(data: any[]): string {
  if (data.length === 0) return ''
  const headers = Object.keys(data[0])
  const lines = [headers.join(',')]
  for (const row of data) {
    const line = headers.map((h) => {
      let val = row[h]
      if (val === null || val === undefined) val = ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
    lines.push(line)
  }
  return lines.join('\n')
}

const file2Path = path.join(demoDir, 'demo_upi_statement.csv')
fs.writeFileSync(file2Path, jsonToCsv(upiStatementRows), 'utf-8')
console.log(`✓ Generated: ${file2Path} (${upiStatementRows.length} rows)`)

// --------------------------------------------------------------------------
// 3. FILE 3: demo_ledger.xlsx (Lakshmi Auto Spares & Hardware - 20 records)
// --------------------------------------------------------------------------
const autoSparesLedgerData = [
  { "Entry_ID": "LED-2026-101", "Date": "2026-09-02", "Customer_Name": "Velu Mechanic", "Amount": 4200, "Type": "credit", "Description": "Bike engine oil box & chain sprocket kit", "Status": "paid", "Notes": "Settled via GPay" },
  { "Entry_ID": "LED-2026-102", "Date": "2026-09-03", "Customer_Name": "Sri Ram Garage", "Amount": 7850, "Type": "credit", "Description": "Car brake pads & clutch plate assembly", "Status": "paid", "Notes": "Paid via PhonePe" },
  { "Entry_ID": "LED-2026-103", "Date": "2026-09-05", "Customer_Name": "Selvam", "Amount": 1250, "Type": "credit", "Description": "Tubeless tyre puncture kit & pump", "Status": "paid", "Notes": "Paid via Paytm" },
  { "Entry_ID": "LED-2026-104", "Date": "2026-09-07", "Customer_Name": "Govindaraj Transport", "Amount": 15400, "Type": "credit", "Description": "Truck battery (Exide 12V) & terminal cable", "Status": "partially_paid", "Notes": "Paid ₹10,000 partial instalment" },
  { "Entry_ID": "LED-2026-105", "Date": "2026-09-08", "Customer_Name": "Mani Workshop", "Amount": 3100, "Type": "credit", "Description": "Hydraulic jack & wheel spanner set", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "LED-2026-106", "Date": "2026-09-10", "Customer_Name": "Kannan Auto", "Amount": 2650, "Type": "credit", "Description": "LED headlight bulb pair & horn relay", "Status": "paid", "Notes": "Paid via GPay" },
  { "Entry_ID": "LED-2026-107", "Date": "2026-09-12", "Customer_Name": "Prabhu Bike Care", "Amount": 1800, "Type": "credit", "Description": "Synthetic 4T oil (4 cans)", "Status": "unpaid", "Notes": "Balance overdue" },
  { "Entry_ID": "LED-2026-108", "Date": "2026-09-14", "Customer_Name": "Kumaran Motors", "Amount": 9200, "Type": "credit", "Description": "Diesel filter set & coolant drum 20L", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "LED-2026-109", "Date": "2026-09-15", "Customer_Name": "Senthil Nathan", "Amount": 1450, "Type": "credit", "Description": "Rear view mirror & handlebar grip set", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "LED-2026-110", "Date": "2026-09-16", "Customer_Name": "Guru Electricals", "Amount": 3800, "Type": "credit", "Description": "Starter motor relay & fuse box assembly", "Status": "unpaid", "Notes": "Pending payment" },
  { "Entry_ID": "LED-2026-111", "Date": "2026-09-18", "Customer_Name": "Thangam Taxi Service", "Amount": 6400, "Type": "credit", "Description": "Shock absorber pair for Sedan", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "LED-2026-112", "Date": "2026-09-19", "Customer_Name": "Rajan Workshop", "Amount": 2100, "Type": "credit", "Description": "Grease bucket (5kg) & grease gun", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "LED-2026-113", "Date": "2026-09-20", "Customer_Name": "Kasi Two Wheeler Works", "Amount": 850, "Type": "credit", "Description": "Brake shoe set & accelerator cable", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "LED-2026-114", "Date": "2026-09-22", "Customer_Name": "Balamurugan", "Amount": 4750, "Type": "credit", "Description": "Car wiper blade pair & polish kit", "Status": "unpaid", "Notes": "Pending payment" },
  { "Entry_ID": "LED-2026-115", "Date": "2026-09-23", "Customer_Name": "Vijayakumar Transport", "Amount": 11800, "Type": "credit", "Description": "Heavy vehicle leaf spring set (2 nos)", "Status": "partially_paid", "Notes": "Paid ₹5,000 partial payment" },
  { "Entry_ID": "LED-2026-116", "Date": "2026-09-24", "Customer_Name": "Shankar Auto Works", "Amount": 1950, "Type": "credit", "Description": "Car air filter & cabin filter", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "LED-2026-117", "Date": "2026-09-25", "Customer_Name": "Murugesan", "Amount": 1600, "Type": "credit", "Description": "Battery charger clamp & multimeter", "Status": "unpaid", "Notes": "Recent credit" },
  { "Entry_ID": "LED-2026-118", "Date": "2026-09-26", "Customer_Name": "Nagaraj Garage", "Amount": 5300, "Type": "credit", "Description": "Radiator coolant (5 cans) & hose pipe", "Status": "paid", "Notes": "Paid via UPI" },
  { "Entry_ID": "LED-2026-119", "Date": "2026-09-26", "Customer_Name": "Jayanthi Travels", "Amount": 8900, "Type": "credit", "Description": "AC gas canister & condenser fan motor", "Status": "unpaid", "Notes": "Recent credit" },
  { "Entry_ID": "LED-2026-120", "Date": "2026-09-27", "Customer_Name": "Kishore Bike Point", "Amount": 2750, "Type": "credit", "Description": "Disc brake oil, caliper pin & pads", "Status": "unpaid", "Notes": "Recent credit" }
]

const ws3 = XLSX.utils.json_to_sheet(autoSparesLedgerData)
const wb3 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb3, ws3, 'Auto_Spares_Ledger')
const file3Path = path.join(demoDir, 'demo_ledger.xlsx')
XLSX.writeFile(wb3, file3Path)
console.log(`✓ Generated: ${file3Path} (${autoSparesLedgerData.length} records)`)

// --------------------------------------------------------------------------
// 4. FILE 4: demo_upi_statement_unmatched.csv (Mixed & Ambiguous - 36 rows)
// --------------------------------------------------------------------------
const upiUnmatchedStatementRows = [
  // 1. Ambiguous Family Member Remitters (Rule 3 -> AI Assistance)
  { Date: "2026-09-18", "Payer Name": "UPI-VENKATESH", Amount: "450.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665501", Description: "UPI from Venkatesh / for Meena alteration" },
  { Date: "2026-09-15", "Payer Name": "CHITRA DEVI", Amount: "2200.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665502", Description: "GPay payment from Chitra Devi" },
  { Date: "2026-09-18", "Payer Name": "REVATHI BALAJI", Amount: "1750.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665503", Description: "PhonePe from Revathi Balaji for Balaji Grocery" },
  { Date: "2026-09-04", "Payer Name": "LAKSHMI NARAYANAN", Amount: "950.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665504", Description: "UPI transfer from Lakshmi Narayanan" },

  // 2. Partial Payments with Descriptive Notes (Rule 4)
  { Date: "2026-09-07", "Payer Name": "GOVINDARAJ", Amount: "10000.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665505", Description: "NEFT Part payment against 15400 battery bill" },
  { Date: "2026-09-24", "Payer Name": "VIJAYAKUMAR", Amount: "5000.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665506", Description: "IMPS Advance for heavy leaf spring set" },

  // 3. Exact Matching Spares Transactions (Rule 1 & Rule 2)
  { Date: "2026-09-02", "Payer Name": "VELU MECHANIC", Amount: "4200.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665507", Description: "UPI/Velu Mechanic engine oil box" },
  { Date: "2026-09-03", "Payer Name": "SRI RAM GARAGE", Amount: "7850.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665508", Description: "UPI/Sri Ram Garage clutch plate" },
  { Date: "2026-09-05", "Payer Name": "SELVAM", Amount: "1250.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665509", Description: "UPI payment from Selvam" },
  { Date: "2026-09-08", "Payer Name": "MANI WORKSHOP", Amount: "3100.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665510", Description: "GPay from Mani Workshop" },
  { Date: "2026-09-10", "Payer Name": "KANNAN AUTO", Amount: "2650.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665511", Description: "PhonePe from Kannan Auto" },
  { Date: "2026-09-14", "Payer Name": "KUMARAN MOTORS", Amount: "9200.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665512", Description: "NEFT from Kumaran Motors" },
  { Date: "2026-09-15", "Payer Name": "SENTHIL NATHAN", Amount: "1450.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665513", Description: "UPI from Senthil Nathan" },
  { Date: "2026-09-18", "Payer Name": "THANGAM TAXI SERVICE", Amount: "6400.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665514", Description: "UPI from Thangam Taxi Service" },
  { Date: "2026-09-19", "Payer Name": "RAJAN WORKSHOP", Amount: "2100.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665515", Description: "UPI from Rajan Workshop" },
  { Date: "2026-09-20", "Payer Name": "KASI TWO WHEELER WORKS", Amount: "850.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665516", Description: "UPI/Kasi Two Wheeler Works" },
  { Date: "2026-09-24", "Payer Name": "SHANKAR AUTO WORKS", Amount: "1950.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665517", Description: "UPI/Shankar Auto Works" },
  { Date: "2026-09-26", "Payer Name": "NAGARAJ GARAGE", Amount: "5300.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665518", Description: "GPay from Nagaraj Garage" },

  // 4. Misleading / Spurious Candidates (Targeting AI Rejection)
  { Date: "2026-09-10", "Payer Name": "GANESH TRAVELS", Amount: "5000.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665519", Description: "Bulk bus hire rental settlement" },
  { Date: "2026-09-10", "Payer Name": "RAJESH SHARMA", Amount: "1300.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665520", Description: "UPI payment Rajesh Sharma" },

  // 5. Unmatched External Inflows
  { Date: "2026-09-02", "Payer Name": "Swiggy Settlement Payout", Amount: "4820.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665521", Description: "Weekly delivery merchant settlement" },
  { Date: "2026-09-06", "Payer Name": "FD Interest Payout", Amount: "1850.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665522", Description: "Fixed deposit quarterly interest credit" },
  { Date: "2026-09-12", "Payer Name": "Flipkart Wholesale Refund", Amount: "2199.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665523", Description: "Return refund credited for damaged parts" },
  { Date: "2026-09-17", "Payer Name": "Google Pay Reward Cashback", Amount: "100.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665524", Description: "Merchant reward cashback" },
  { Date: "2026-09-22", "Payer Name": "BharatPe Daily QR Settlement", Amount: "6750.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665525", Description: "QR code combined settlement" },
  { Date: "2026-09-27", "Payer Name": "Cred Cashback Deposit", Amount: "75.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665526", Description: "Promotional credit reward" },
  { Date: "2026-09-28", "Payer Name": "Insurance Claim Settlement", Amount: "3200.00", "Transaction Type": "Credit", "Transaction ID": "UPI/998877665527", Description: "Glass breakage reimbursement" },

  // 6. Outgoing Debit Transactions (Excluded by direction filter)
  { Date: "2026-09-04", "Payer Name": "Castrol Lubricants India Ltd", Amount: "14500.00", "Transaction Type": "Debit", "Transaction ID": "UPI/998877665528", Description: "Bulk oil barrel purchase" },
  { Date: "2026-09-09", "Payer Name": "Welding Gas Cylinder Refill", Amount: "1750.00", "Transaction Type": "Debit", "Transaction ID": "UPI/998877665529", Description: "Oxygen & Acetylene refill" },
  { Date: "2026-09-11", "Payer Name": "Shop Electric Power Bill", Amount: "2450.00", "Transaction Type": "Debit", "Transaction ID": "UPI/998877665530", Description: "TNEB Monthly commercial electricity" },
  { Date: "2026-09-14", "Payer Name": "Lathe Machine Job Work Charge", Amount: "850.00", "Transaction Type": "Debit", "Transaction ID": "UPI/998877665531", Description: "Shaft turning charges" },
  { Date: "2026-09-16", "Payer Name": "Hardware Tools Supplier", Amount: "6200.00", "Transaction Type": "Debit", "Transaction ID": "UPI/998877665532", Description: "Stock purchase tools and spanners" },
  { Date: "2026-09-18", "Payer Name": "Compressor Lubricating Oil", Amount: "920.00", "Transaction Type": "Debit", "Transaction ID": "UPI/998877665533", Description: "Air compressor maintenance oil" },
  { Date: "2026-09-21", "Payer Name": "Staff Daily Allowance", Amount: "600.00", "Transaction Type": "Debit", "Transaction ID": "UPI/998877665534", Description: "Lunch & tea expense for helpers" },
  { Date: "2026-09-25", "Payer Name": "Shop Cleaning & Waste Hauling", Amount: "400.00", "Transaction Type": "Debit", "Transaction ID": "UPI/998877665535", Description: "Scrap metal & waste removal" },
  { Date: "2026-09-28", "Payer Name": "Local Municipality Trade License Fee", Amount: "1200.00", "Transaction Type": "Debit", "Transaction ID": "UPI/998877665536", Description: "Annual shop renewal fee" }
]

const file4Path = path.join(demoDir, 'demo_upi_statement_unmatched.csv')
fs.writeFileSync(file4Path, jsonToCsv(upiUnmatchedStatementRows), 'utf-8')
console.log(`✓ Generated: ${file4Path} (${upiUnmatchedStatementRows.length} rows)`)
