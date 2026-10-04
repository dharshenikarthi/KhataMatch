# KhataMatch Evaluation & Accuracy Framework (Phase 13)

This directory contains the repeatable evaluation suite for measuring the accuracy and reliability of **KhataMatch**'s handwritten ledger extraction, deterministic payment matching, and Gemini-assisted ambiguous matching across 25 realistic synthetic test cases.

---

## 📁 Directory Structure

```text
eval/
├── dataset/
│   └── cases.json               # 25 synthetic cases with inputs & ground truth
├── fixtures/
│   ├── case01/                  # Individual test case fixtures (input.json, expected.json, README.md)
│   ├── ...
│   └── case25/
├── scripts/
│   ├── run-evaluation.ts        # CLI test runner and report generator
│   ├── calculate-metrics.ts     # Pure metric calculator & comparison utilities
│   └── eval.test.ts             # Automated unit tests for evaluation framework
├── results/
│   ├── latest-report.json       # Latest machine-readable evaluation report
│   └── eval-report-*.json       # Timestamped historical evaluation runs
└── README.md                    # Comprehensive documentation
```

---

## 🎯 Coverage of the 25 Synthetic Test Cases

| Case ID | Scenario Name | Category | Difficulty | Ground Truth Verification |
| :--- | :--- | :--- | :--- | :--- |
| `case01` | Clear Ledger Exact Match | Exact Match | Easy | Rule 1 Exact Match (Payer = Customer, Amount = ₹1,500, Same Date) |
| `case02` | Name Initial Variation | Name Variation | Easy | Rule 1 Token Reordering (`Murugan K` vs `K Murugan`, ₹2,500) |
| `case03` | Tamil Annotation in Name | Annotation Handling | Medium | Parentheses & Script Stripping (`Priya (தையல்)` -> `Priya`) |
| `case04` | Slight Date Proximity Gap | Date Proximity | Easy | Rule 1 within 4-day proximity window (3-day gap, ₹1,200) |
| `case05` | Large Date Gap Match | Name + Amount Match | Medium | Rule 2 Name & Amount Match across 20-day interval (₹3,000) |
| `case06` | Family Member Payment | Ambiguous / Rule 3 | Medium | Rule 3 Amount & Date Match (`Meena` vs `Venkatesh` UPI, ₹450) |
| `case07` | Partial Payment Detection | Partial Payment | Medium | Rule 4 Partial Installment Detection (₹800 paid of ₹2,000 credit) |
| `case08` | Unpaid Ledger Credit | Unpaid Dues | Easy | Correctly flagged as Unmatched Ledger Entry (₹3,500) |
| `case09` | Unmatched Bank Payment | Unmatched Payment | Easy | Correctly flagged as Unmatched Payment (`Amazon Pay Refund`, ₹1,299) |
| `case10` | Duplicate Amount Disambiguation | Duplicate Amounts | Medium | Disambiguates two ₹500 transactions to correct distinct payers |
| `case11` | Competing Payments for Due | Competing Payments | Hard | Enforces 1-to-1 constraint; matches named payer, leaves extra unmatched |
| `case12` | Difficult Cursive Handwriting | Handwriting Extraction | Hard | Cursive ligature extraction for `Muthu Velu` (₹650) |
| `case13` | Slash Date Formatting | Date Normalization | Medium | Normalizes `15/09/2026` to ISO `2026-09-15` for accurate date matching |
| `case14` | Spelling Variation | Name Variation | Medium | Resolves `Sureshbabu` vs `Suresh Babu` (₹1,800) |
| `case15` | Similar Names Prevention | False Positive Defense | Hard | Rejects false match between `Ramesh Sharma` (₹1,200) and `Rajesh` (₹1,300) |
| `case16` | Missing Customer Name | Missing Data Handling | Medium | Gracefully handles empty customer names without crashing |
| `case17` | Missing Ledger Date | Missing Data Handling | Medium | Successfully matches by Name & Amount (Rule 2) when date is absent |
| `case18` | Struck-out Notebook Entry | Notebook Status | Medium | Excludes settled notebook entry (`struck_out`) from active matching |
| `case19` | High-Value Paise Precision | Integer Precision | Easy | Verifies integer paise equality for ₹12,450.50 |
| `case20` | AI Familial Honorific Match | AI Ambiguous | Medium | Evaluates `Chitra Akka` vs `CHITRA DEVI` (₹2,200) -> `likely_match` |
| `case21` | AI Store Account Match | AI Ambiguous | Medium | Evaluates `Balaji Grocery` vs `REVATHI BALAJI` (₹1,750) -> `likely_match` |
| `case22` | AI Rejection of Commercial Payer | AI Rejection | Medium | Evaluates `Ganesh` (₹500) vs `Ganesh Travels` (₹5,000) -> `unlikely_match` |
| `case23` | Multiple Entries for Same Customer | Multi-Entry Customer | Hard | Matches payment to correct older entry based on transaction timestamp |
| `case24` | Overpayment / Advance Payment | Overpayment | Medium | Detects overpayment candidate (₹1,000 payment for ₹600 ledger due) |
| `case25` | Complex Multi-Row Mixed Batch | End-to-End Batch | Hard | Full batch reconciliation: 1 exact match, 1 partial payment, 1 unpaid |

---

## 🧮 Exact Metric Calculation Formulas

### 1. Ledger Extraction Accuracy
- **Name Accuracy**: $\frac{\text{Correctly Extracted Customer Names}}{\text{Total Ground Truth Names}}$
- **Amount Accuracy**: $\frac{\text{Exact Integer Paise Matches}}{\text{Total Ground Truth Amounts}}$
- **Date Accuracy**: $\frac{\text{Correctly Normalized Dates (YYYY-MM-DD)}}{\text{Total Ground Truth Dates}}$
- **Complete Row Accuracy**: $\frac{\text{Rows with 100\% Correct Name, Amount, and Date}}{\text{Total Ground Truth Rows}}$

### 2. Deterministic Matching Metrics
- **True Positives (TP)**: Expected pairings correctly generated by the matching engine.
- **False Positives (FP)**: Incorrect or spurious pairings generated by the matching engine.
- **False Negatives (FN)**: Expected ground truth pairings missed by the matching engine.
- **Precision**: $\frac{\text{TP}}{\text{TP} + \text{FP}}$
- **Recall**: $\frac{\text{TP}}{\text{TP} + \text{FN}}$
- **F1 Score**: $2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$

### 3. Gemini Ambiguous Matching Metrics
- **Likely Match Accuracy**: $\frac{\text{Correct likely\_match Decisions}}{\text{Expected likely\_match Decisions}}$
- **Uncertain Decision Accuracy**: $\frac{\text{Correct uncertain Decisions}}{\text{Expected uncertain Decisions}}$
- **Rejection Accuracy**: $\frac{\text{Correct unlikely\_match Rejections}}{\text{Expected unlikely\_match Decisions}}$
- **Overall AI Accuracy**: $\frac{\text{Total Correct AI Decisions}}{\text{Total Evaluated AI Candidates}}$

---

## 🚀 Running Evaluation

### Deterministic / Fixture Mode (Zero API Keys or Network Required)
```bash
npm run eval
```

### Formatted Evaluation Summary
```bash
npm run eval:report
```

### Optional Live Gemini Evaluation
To evaluate against real Supabase Edge Functions with a live Gemini model:
```bash
LIVE_GEMINI=true npx tsx eval/scripts/run-evaluation.ts
```

---

## 🔒 Security & Data Integrity

1. **Zero Data Leakage**: All 25 evaluation test cases use completely synthetic names, references, and amounts. No actual customer data or private keys are ever stored in evaluation files.
2. **Production Record Isolation**: Evaluation scripts execute entirely in memory and never mutate, insert, or delete production Supabase financial records.
3. **Reproducibility**: Fixture-based tests run deterministically across all environments with zero external network dependencies.
