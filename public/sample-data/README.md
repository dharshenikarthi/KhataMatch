# KhataMatch Sample Data Fixtures

This directory contains synthetic demo test fixtures used to test ledger extraction, CSV statement parsing, and reconciliation matching workflows without requiring real bank statements or customer data.

## Files

1. **`sample-ledger.svg`**:
   - Realistic Indian shopkeeper notebook ledger with ruled lines, red margins, Tamil/English headers, and customer credit entries (*Murugan*, *Lakshmi*, *Ravi Kumar*, *Priya*, *Suresh*, *Meena*, *K. Murugan*, and struck-out *Arun*).

2. **`sample-statement.csv`**:
   - Standard 4-column UPI statement format (`date`, `payer_name`, `amount`, `reference`). Contains exact matches, name variations, partial payments, and unmatched transactions.

3. **`sample-bank-statement-debit-credit.csv`**:
   - Standard bank export format with separate `Withdrawal` (debit) and `Deposit` (credit) columns, including an outgoing utility payment to test automatic withdrawal filtering.

4. **`sample-semicolon-statement.csv`**:
   - Semicolon-delimited (`;`) statement format with European/Indian comma decimal formats (`1250,00`) and custom headers (`Date;Sender Name;Amount (INR);UTR Reference;Txn Type`).
