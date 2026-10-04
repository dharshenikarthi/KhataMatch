# KhataMatch — Production Demo Data & Testing Guide

This directory contains realistic, safe, synthetic business transaction datasets designed to demonstrate and test the end-to-end KhataMatch reconciliation workflow without using real financial records or customer PII.

---

## 🔒 Synthetic Data & Privacy Disclaimer

> [!IMPORTANT]
> **100% Fictional Data**: All business names, customer names, bank references, and amounts in these demo files are entirely synthetic.
> - No real Indian bank accounts, UPI VPA IDs, or personal phone numbers are included.
> - Testing with these files will **never modify, overwrite, or leak** real user financial records.
> - All tests run in authenticated demo/test user sessions or isolated local storage.

---

## 📦 Demo Files Inventory

| File Name | Format | Size / Records | Business Context | Primary Testing Purpose |
| :--- | :--- | :--- | :--- | :--- |
| [`demo_customer_ledger.xlsx`](demo_customer_ledger.xlsx) | Excel Workbook (`.xlsx`) | 30 credit entries | **Sri Murugan Tex & Garments** (Tailoring & Uniform Shop) | Standard credit ledger entries with mixed statuses (Paid, Partial, Unpaid, Struck-out). |
| [`demo_upi_statement.csv`](demo_upi_statement.csv) | CSV Statement (`.csv`) | 36 bank/UPI rows | **Current Account UPI Statement** | Exact matching (Rule 1 & 2), date proximity gaps, partial payments, and outgoing debit exclusions. |
| [`demo_ledger.xlsx`](demo_ledger.xlsx) | Excel Workbook (`.xlsx`) | 20 credit entries | **Lakshmi Auto Spares & Hardware** (Auto Parts Store) | Second fictional business with larger credit amounts, vehicle transport accounts, and partial advance payments. |
| [`demo_upi_statement_unmatched.csv`](demo_upi_statement_unmatched.csv) | CSV Statement (`.csv`) | 36 bank/UPI rows | **Mixed & Ambiguous Statement** | Ambiguous family member accounts, name transliterations, commercial payer rejections, and unmatched external inflows. |

---

## 🚀 Recommended Upload & Walkthrough Order

### Walkthrough Scenario A: Standard Tailoring Shop Reconciliation
1. **Ledger Data**: Use [`demo_customer_ledger.xlsx`](demo_customer_ledger.xlsx) or sample handwritten photos.
2. **Bank Statement**: Upload [`demo_upi_statement.csv`](demo_upi_statement.csv) on the **1. Upload** screen.
3. **Verify Reconciliation**:
   - **Exact Matches (Rule 1)**: `Ravi Kumar` (₹1,500), `Murugan K` (₹2,500), `Priya` (₹800), `Babu` (₹1,500), `Muthu Velu` (₹650), `Gita` (₹1,750), `Vasanth Enterprises` (₹12,450.50).
   - **Date Gap Match (Rule 2)**: `Anand S` (₹3,000 paid 20 days later).
   - **Partial Payments (Rule 4)**: `Karthik` (₹800 paid of ₹2,000 credit due), `Sundar` (₹500 paid of ₹2,000 credit due).
   - **Overpayment**: `Geetha` (₹1,000 paid for ₹600 credit due).
   - **Competing Due Disambiguation**: `Saravanan` (₹1,000 matched to named remitter, unknown duplicate flagged as unmatched).
   - **Unmatched Inflows**: `Amazon Pay Refund` (₹1,299), `Zomato Partner Payout` (₹3,450), `Interest Credit` (₹142).
   - **Excluded Debits**: Shop rent (₹8,000), electricity (₹1,850), sewing supplies (₹4,200) automatically excluded from incoming payment candidates.

---

### Walkthrough Scenario B: Auto Spares & Ambiguous AI-Assisted Matching
1. **Ledger Data**: Use [`demo_ledger.xlsx`](demo_ledger.xlsx) records.
2. **Bank Statement**: Upload [`demo_upi_statement_unmatched.csv`](demo_upi_statement_unmatched.csv).
3. **Verify AI Suggestions**:
   - **Family Member Account (Rule 3 -> AI)**: `Meena` (₹450) vs UPI remitter `Venkatesh` -> AI suggests `uncertain` with note: *"Payer Venkatesh differs from customer Meena (possible spouse/family account)"*.
   - **Honorific / Name Variation**: `Chitra Akka` (₹2,200) vs `CHITRA DEVI` -> AI suggests `likely_match` with high confidence.
   - **Business Name Variation**: `Balaji Grocery` (₹1,750) vs `REVATHI BALAJI` -> AI suggests `likely_match` (shared identifier).
   - **Commercial Payer Rejection**: `Ganesh` (₹500) vs `GANESH TRAVELS` (₹5,000) -> AI suggests `unlikely_match` (10x amount mismatch, commercial enterprise).
   - **Partial Large Dues**: `Govindaraj Transport` (₹10,000 paid against ₹15,400 battery bill), `Vijayakumar Transport` (₹5,000 paid against ₹11,800 leaf spring order).

---

## 📊 Expected Matching Matrix

| Ledger Record | Amount | Statement Record | Matched Rule / Status | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| `Ravi Kumar` | ₹1,500.00 | `UPI-RAVI KUMAR` | `RULE_1_EXACT_MATCH` | Confirmed Exact Match (Confidence: 0.98) |
| `Murugan K` | ₹2,500.00 | `UPI-K MURUGAN` | `RULE_1_EXACT_MATCH` | Token Reordered Match (Confidence: 0.96) |
| `Priya (தையல்)` | ₹800.00 | `PRIYA` | `RULE_1_EXACT_MATCH` | Tamil Annotation Stripped (Confidence: 0.96) |
| `Anand S` | ₹3,000.00 | `UPI/ANAND S` | `RULE_2_NAME_AMOUNT_FAR_DATE` | 20-Day Date Gap Match (Confidence: 0.85) |
| `Karthik` | ₹2,000.00 | `KARTHIK` (₹800) | `RULE_4_PARTIAL_PAYMENT` | Partial Payment: ₹1,200 Outstanding Balance |
| `Sundar` | ₹2,000.00 | `SUNDAR` (₹500) | `RULE_4_PARTIAL_PAYMENT` | Partial Payment: ₹1,500 Outstanding Balance |
| `Deepa` | ₹3,500.00 | *No matching payment* | `UNMATCHED_LEDGER` | Unpaid Due: ₹3,500 in Reminder Queue |
| `Ramesh Sharma` | ₹1,200.00 | `RAJESH SHARMA` (₹1,300) | `NO_MATCH` | False Match Prevented |
| `Meena` | ₹450.00 | `UPI-VENKATESH` (₹450) | `RULE_3_AMOUNT_DATE_DIFF_NAME` | AI Ambiguous Suggestion: Needs Review |
| `Chitra Akka` | ₹2,200.00 | `CHITRA DEVI` (₹2,200) | `RULE_3_AMOUNT_DATE_DIFF_NAME` | AI Suggestion: Likely Match (0.91) |
| *No ledger entry* | ₹1,299.00 | `Amazon Pay Refund` | `UNMATCHED_PAYMENT` | Unmatched Bank Inflow |
| *No ledger entry* | ₹8,000.00 | `Shop Rent - Sundaram` | `DEBIT_EXCLUDED` | Ignored (Outgoing Merchant Expense) |

---

## 🛠️ CSV Parser Compatibility Notes

The generated CSV statement files match the KhataMatch CSV parser auto-detection rules:
- **Date Column**: Identified by `Date` header, parsed to standard ISO `YYYY-MM-DD`.
- **Payer Column**: Identified by `Payer Name` header, automatically stripped of `UPI-`, `UPI/`, `IMPS/` prefixes.
- **Amount Column**: Identified by `Amount` header, converted to integer paise (`Math.round(amount * 100)`).
- **Direction Column**: Identified by `Transaction Type` (`Credit` vs `Debit`).
- **Reference Column**: Identified by `Transaction ID` header.
