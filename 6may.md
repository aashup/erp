# Date / Timezone Audit — 6 May 2026

## Background

The ERP runs in IST (UTC+5:30). The MySQL database stores `invoice_date` and related datetime columns as UTC DATETIME. This creates a systematic mismatch when:

- Dates are constructed or extracted using JavaScript's UTC methods instead of local-time methods.
- Date-range filters are sent as bare `YYYY-MM-DD` strings — the backend has no timezone context and applies UTC-midnight boundaries that miss the first 5h30m of every IST day.

**The IST window problem:** A POS sale at 2 AM IST on May 6 has UTC time `2026-05-05T20:30:00Z`. If the backend filters `invoice_date >= '2026-05-06 00:00:00'`, this record is invisible — it happened on the right calendar day but the UTC date is one day earlier.

---

## Fixes Applied — 6 May 2026

### A. `fe/src/lib/utils.ts`

| Function | Before | After |
|---|---|---|
| `dateToUtcIso(dateStr)` | Appended `T00:00:00.000Z` (UTC midnight) | Computes browser offset dynamically → `2026-05-06T00:00:00+05:30` |
| `periodToDateRange()` | Returned bare `YYYY-MM-DD` strings | Returns UTC ISO datetimes via `localDateToUtcRange()` |
| `todayLocalDate()` | *(new)* | Uses `getFullYear/Month/Date` (local TZ) — never UTC |
| `apiDateToLocalDate(iso)` | *(new)* | Converts API ISO string back to local YYYY-MM-DD via local getters |
| `localDateToUtcRange(start, end)` | *(new)* | Converts local date pair to UTC ISO start/end with no hardcoded offset |

### B. `fe/src/pages/pos/POSPage.tsx` and `fe/src/pages/pos2/POSPage2.tsx`

- **Hold (offline/online):** `new Date().toISOString().slice(0, 10)` → `new Date().toISOString()` — sends full current UTC datetime instead of a bare date string.
- **Checkout:** same change — `invoice_date` now carries the exact UTC moment of sale.
- Removed `todayLocalDate()` / `dateToUtcIso()` intermediary; datetime set directly.

### C. `fe/src/pages/sales/SalesInvoiceFormPage.tsx`, `SalesInvoiceFormPage2.tsx`, `fe/src/pages/purchase/PurchaseInvoiceFormPage.tsx`

- When loading an existing invoice for editing: `.split('T')[0]` → `apiDateToLocalDate()`.
- Ensures the date shown in the form is the IST calendar date, not the raw UTC date portion.

### D. `api/app/Http/Controllers/Api/V1/DashboardController.php`

- `stats()` and `collection()`: removed `->startOfDay()` / `->endOfDay()` wrapping on explicit `date_from`/`date_to`. Frontend now sends proper UTC datetimes; the backend trusts them as-is.
- `whereBetween('invoice_date', ...)` now uses the Carbon objects directly (no extra day-boundary clamping).
- `receipt_date` and `needToCollect` `whereBetween` queries updated to use Carbon objects (full datetime comparison) instead of `->toDateString()`.

---

## Remaining Issues — Needs Fix

### Priority 1 — Report Page Filters (High Impact)

All report pages send raw `YYYY-MM-DD` strings as `date_from` / `date_to` with zero timezone information. The backend's `ReportController::resolveDateRange()` returns these raw strings directly to `whereDate()` queries.

**Affected pages:**

| Page | File | Lines |
|---|---|---|
| Cash Book | `fe/src/pages/reports/CashBook.tsx` | 37-38, 220, 229 |
| Bank Book | `fe/src/pages/reports/BankBook.tsx` | 38-39, 246, 255 |
| Day Book | `fe/src/pages/reports/DayBook.tsx` | 33-34, 234, 243 |
| Ledger Book | `fe/src/pages/reports/LedgerBook.tsx` | 45-46, 257, 266 |
| Trial Balance | `fe/src/pages/accounting/TrialBalance.tsx` | 295-296, 517, 526 |
| Profit & Loss | `fe/src/pages/accounting/ProfitAndLoss.tsx` | 184-185, 792, 801 |
| Balance Sheet | `fe/src/pages/accounting/BalanceSheet.tsx` | 473-474, 705, 716 |
| Audit Trail | `fe/src/pages/accounting/AuditTrail.tsx` | 362-363, 239, 245 |

**What to fix (frontend):** Replace the raw string sent to API with `localDateToUtcRange(dateFrom, dateTo)`. Example:
```ts
// Before
api.get('/reports/cash-book', { params: { date_from: appliedDateFrom, date_to: appliedDateTo } })

// After
const { date_from, date_to } = localDateToUtcRange(appliedDateFrom, appliedDateTo);
api.get('/reports/cash-book', { params: { date_from, date_to } })
```

**What to fix (backend — `ReportController.php`):** All `whereDate()` calls on `voucher_date` must become full datetime comparisons so the UTC offset is respected:
```php
// Before
->whereDate('vouchers.voucher_date', '>=', $dateFrom)
->whereDate('vouchers.voucher_date', '<=', $dateTo)

// After
->where('vouchers.voucher_date', '>=', $dateFrom)
->where('vouchers.voucher_date', '<=', $dateTo)
```
Applies to all methods: `trialBalance()`, `profitAndLoss()`, `balanceSheet()`, `dayBook()`, `buildLedgerBook()`, `partyLedger()`, `ledgerTransactions()`, `auditTrail()`.

---

### Priority 2 — Accounting Voucher / Payment Form Defaults (Medium Impact)

Voucher and payment forms get their default date from `useDateStore` (correct — uses local date). But when loading an existing record to edit, `.split('T')[0]` is used on the API response, which extracts the UTC date portion, not the IST date.

**Files / patterns to fix:**

| File | Line | Pattern | Fix |
|---|---|---|---|
| `fe/src/pages/accounting/Payments.tsx` | 88 | `receipt_date: record.receipt_date.split('T')[0]` | `apiDateToLocalDate(record.receipt_date)` |
| `fe/src/pages/accounting/vouchers/PaymentReceiptForm.tsx` | 71 | same | same |
| `fe/src/pages/sales/SalesOrderFormPage.tsx` | 125 | `so_date: existingSO.so_date.split('T')[0]` | `apiDateToLocalDate(existingSO.so_date)` |
| `fe/src/pages/purchase/PurchaseOrderFormPage.tsx` | 125 | `po_date: existingPO.po_date.split('T')[0]` | `apiDateToLocalDate(existingPO.po_date)` |

The `dateToUtcIso()` calls used when *submitting* these forms are already correct (browser offset is included).

---

### Priority 3 — `toISOString().slice(0, 10)` Default Values (Low-Medium Impact)

These use the UTC date as a default value, which can be one day off between local midnight and local 05:30 (for IST).

| File | Line | Field | Fix |
|---|---|---|---|
| `fe/src/pages/payroll/SalaryStructureModal.tsx` | 94 | `effective_from` default | Replace with `todayLocalDate()` |
| `fe/src/pages/payroll/Employees.tsx` | 133 | `joining_date` default | Replace with `todayLocalDate()` |
| `fe/src/pages/settings/TallyImport.tsx` | 768 | default import date | Replace with `todayLocalDate()` |

---

### Priority 4 — Sales/Purchase/POS Date Filters in List Pages (Medium Impact)

List pages (SalesInvoices, PurchaseInvoices, SalesOrders, PurchaseOrders) have filter panels that also send bare `YYYY-MM-DD` date strings. The backend uses `whereDate()` on those.

| File | Lines | Columns |
|---|---|---|
| `fe/src/pages/sales/SalesInvoices.tsx` | 258, 911, 920 | `date_from`, `date_to` |
| `fe/src/pages/purchase/PurchaseInvoices.tsx` | 222, 656, 665 | `date_from`, `date_to` |
| `fe/src/pages/sales/SalesOrders.tsx` | 313, 317 | `date_from`, `date_to` |
| `fe/src/pages/purchase/PurchaseOrders.tsx` | 345, 349 | `date_from`, `date_to` |

**Fix:** Same as Priority 1 — pass through `localDateToUtcRange()` before sending; change backend from `whereDate()` to `where()` for datetime comparisons.

---

### Priority 5 — Inventory Date Filters (Low Impact)

| File | Lines | Fields |
|---|---|---|
| `fe/src/pages/inventory/StockLedger.tsx` | 363, 377 | `date_from`, `date_to` |
| `fe/src/pages/inventory/ItemMovements.tsx` | 133, 134 | `date_from`, `date_to` |
| `fe/src/pages/inventory/AllBatches.tsx` | 335, 342, 396, 403 | expiry date filter |

Batch dates (`manufacturing_date`, `expiry_date`) are stored as MySQL `DATE` columns — they are timezone-agnostic by design and need no fix.

---

### Priority 6 — Payroll Date Filters (Low Impact)

| File | Lines | Fields |
|---|---|---|
| `fe/src/pages/payroll/Employees.tsx` | 96-97 | `joining_date_from`, `joining_date_to` |

Backend: `EmployeeController.php:28-29` uses `whereDate('joining_date', '>=', $d)`. Since `joining_date` is a DATE column, it is timezone-agnostic. Low risk.

---

### Priority 7 — VoucherController List Filter (Medium Impact)

`api/app/Http/Controllers/Api/V1/VoucherController.php:24-25`:
```php
->when($request->date_from, fn ($q, $d) => $q->whereDate('vouchers.voucher_date', '>=', $d))
->when($request->date_to,   fn ($q, $d) => $q->whereDate('vouchers.voucher_date', '<=', $d))
```
Frontend `JournalEntries.tsx` sends bare `YYYY-MM-DD`. Same fix as Priority 1 needed.

---

## Backend `whereDate()` vs `where()` Reference

`whereDate()` extracts the DATE portion from the column before comparing. For UTC-stored DATETIME data, this means the UTC date, not the local date. If the frontend sends `2026-05-05T18:30:00.000Z` (IST midnight May 6), `DATE('2026-05-05 18:30:00')` = `2026-05-05` — the comparison key is May 5, not May 6.

**Correct approach for DATETIME columns (invoice_date, voucher_date, receipt_date):**
```php
// WRONG — uses date portion only
->whereDate('invoice_date', '>=', $dateFrom)

// RIGHT — full datetime comparison; front end sends UTC ISO, backend respects it
->where('invoice_date', '>=', $dateFrom)
->where('invoice_date', '<=', $dateTo)
```

**DATE columns (joining_date, expiry_date, manufacturing_date)** are timezone-agnostic. `whereDate()` is fine.

---

## Quick Reference — Utility Functions (`fe/src/lib/utils.ts`)

| Function | Use Case |
|---|---|
| `todayLocalDate()` | Default value for date inputs — always local IST date |
| `dateToUtcIso(dateStr)` | Submitting a user-selected YYYY-MM-DD to the API as ISO with local offset |
| `apiDateToLocalDate(iso)` | Reading a date back from API response into a form field |
| `localDateToUtcRange(start, end)` | Dashboard and report filters — converts local date range to UTC ISO start/end |

---

## Files Changed On 6 May 2026

```
fe/src/lib/utils.ts                                       — core date utilities
fe/src/pages/pos/POSPage.tsx                              — invoice_date to full UTC timestamp
fe/src/pages/pos2/POSPage2.tsx                            — same
fe/src/pages/sales/SalesInvoiceFormPage.tsx               — apiDateToLocalDate on load
fe/src/pages/sales/SalesInvoiceFormPage2.tsx              — same
fe/src/pages/purchase/PurchaseInvoiceFormPage.tsx         — same
api/app/Http/Controllers/Api/V1/DashboardController.php   — removed startOfDay/endOfDay; whereBetween uses Carbon
```
