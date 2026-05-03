# claude2.md — My Understanding of the ERP Project

> Written from CLAUDE.md after scanning project root. Mirrors the canonical doc; does not replace it.

---

## 1. Project Overview

A **Marg ERP-like, GST-compliant, offline-first ERP** for Indian SMEs (retailers, wholesalers, pharma distributors, kirana stores). Works fully offline; syncs to a central server when connectivity returns.

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Laravel 11 (Sanctum auth) |
| Server DB | MySQL (Railway) |
| Web app | React + Vite |
| Web local DB | Dexie.js (IndexedDB) |
| Mobile | React Native (Expo) |
| Mobile local DB | WatermelonDB (SQLite) |
| Shared logic | JS package (hooks, GST utils, sync engine, types) |
| Hosting | Railway (API+DB), Vercel (web), Expo Go / EAS (mobile) |

## 3. Actual Repo Layout (as of today)

```
erp/
├── api/         # Laravel 11 backend  (NOT backend/)
├── fe/          # React + Vite web    (NOT apps/web/)
└── mobile/      # Expo React Native
```

Inside `api/`: `app/Http/Controllers/Api/V1/`, `app/Models/`, `app/Services/`, `app/Policies/` (17 — `VoucherPolicy` guards reports), `app/Traits/` (`HasUuid`, `HasSyncColumns`, `BelongsToCompany`, `FiltersByFinancialYear`), `database/migrations/` (modify in-place — never add new migration files during initial dev), `routes/api.php` (all `/api/v1`, `auth:sanctum`).

Inside `fe/src/`: `api/`, `components/{layout,ui}/`, `hooks/` (`useFinancialYear`, `useSelectedFYId`, …), `lib/axios.ts` (auto-injects JWT + `financial_year_id`), `pages/accounting/`, `store/{authStore,fyStore,themeStore}`, `App.tsx` (React Router v7 + React Query).

## 4. Two Invoice Printing Systems — Never Mix

### A4 / Default Invoice (PDF)
- Trigger: Sales Invoice list → "Print A4"
- Backend: `InvoicePdfService::generate()` → `resources/views/invoices/templates/default.blade.php` or chosen `invoice_templates` row
- API: `GET /sales-invoices/{id}/pdf`
- Settings page: Invoice Settings → "Default Invoice Template"
- Table: `invoice_templates`

### Thermal Printer Template (HTML → browser print)
- Trigger: POS print + Sales Invoice list "Print Thermal"
- Paper: 2-inch (58mm) or 3-inch (80mm)
- API: `GET /sales-invoices/{id}/html?template=thermal-custom&paper_size=2inch`
- Logic: `SalesInvoiceController@html` → looks up `ThermalTemplate(company_id, paper_size, is_default=true)` → renders via `ThermalTemplateRenderer::render()` (variable substitution). Fallback: `resources/views/invoices/templates/thermal.blade.php`
- Frontend: fetch HTML with Bearer → Blob URL → `window.open()` → `window.print()`
- Settings page: `/settings/thermal-templates` (`ThermalTemplateEditor.tsx`)
- Table: `thermal_templates` (`name`, `html_content`, `paper_size`, `is_default`, `company_id`)
- Load defaults: `POST /thermal-templates/load-defaults` seeds 2/3-inch defaults
- Settings keys (in `company_settings`): `thermal_printer_paper_size` (`2inch|3inch`), `default_invoice_template`
- Constraint: MySQL has no partial unique index, so the controller manually flips other rows to `is_default=false` when setting a new default.

**Template variables** (thermal): `{{company_name}}`, `{{company_gstin}}`, `{{company_address}}`, `{{company_phone}}`, `{{company_email}}`, `{{invoice_number}}`, `{{invoice_date(_formatted)}}`, `{{customer_name}}`, `{{customer_gstin}}`, `{{customer_address}}`, `{{customer_city}}`, `{{customer_phone}}`, `{{subtotal}}`, `{{cgst_total}}`, `{{sgst_total}}`, `{{igst_total}}`, `{{round_off}}`, `{{grand_total}}`, `{{balance_due}}`, `{{amount_in_words}}`, `{{items_table}}`, `{{gst_summary}}`.

## 5. Auto-Voucher Financial Year Rules

When a sales/purchase invoice is saved, `AccountingService` auto-creates a journal voucher whose FY **must** equal the invoice FY.

- **FY is server-resolved from `invoice_date`** in `SalesInvoiceController` and `PurchaseInvoiceController` (store + update): `whereDate('start_date','<=',date) AND whereDate('end_date','>=',date)`. 422 if no FY covers the date. **Frontend never sends `financial_year_id` for purchase invoices**; it's stripped from the zod schema.
- **Voucher inherits FY from invoice**: `AccountingService::postSalesInvoice()` / `postPurchaseInvoice()` use `$invoice->financialYear` — NOT `getCurrentFY()`. `getCurrentFY()` is still used for `postPayment`, `postReceipt`, `postPayroll`, `postPayrollPayment` (no parent invoice).

## 6. Accounting Reports Patterns

- All endpoints share `ReportController::resolveDateRange()`:
  1. explicit `date_from`+`date_to` → use them
  2. else `financial_year_id` → look up `FinancialYear`
  3. else → `[null,null]` (all-time)
- Endpoints (all guarded by `accounting.view` via `VoucherPolicy`): `trial-balance`, `profit-and-loss`, `balance-sheet`, `party-ledger`, `ledger-transactions`, `cash-book`, `bank-book`, `day-book`.
- **FY date storage gotcha**: IST entry → stored as UTC `date` → lands one day earlier (Apr 1, 2026 IST → `2026-03-31`). Consistent; `whereDate()` works.
- **Frontend**: `useFYStore` persists `selectedFY` in `localStorage` (`selectedFY` key). `axios.ts` auto-injects `financial_year_id` on every GET.
- **React Query rule**: report query keys must include `selectedFY?.id` so changing FY triggers refetch.
- **TrialBalance**: tree built from flat rows; `hideZero: true` default; FY label in subtitle; ledger rows clickable → drill-down panel of voucher lines.

## 7. Development Rules

- **Do NOT start dev servers, preview, or run the app** unless the user explicitly asks.
- **Do NOT create new migration files** during initial dev — modify existing migrations in-place. Refresh DB with `php artisan migrate:fresh --seed`.

## 8. MCP Server Rules (Always)

- **`mcp__mysql`** for every DB op (SELECT/INSERT/UPDATE/DELETE/DDL). Never Bash `mysql` or `docker-compose exec`.
- **`mcp__filesystem`** for every file op. Never Bash `cat`/`ls`/`find`/`grep`/`echo >`/`cp` for project files.

## 9. Accounting Model (Tally / Marg conventions)

Hierarchy: **Groups → Ledgers → Vouchers → Double Entry**.

- Primary groups: Assets, Liabilities, Income, Expenses (each with sub-groups).
- Every voucher: `SUM(Dr) == SUM(Cr)`.
- **Sales (intra-state)**: Customer Dr; Sales Cr; CGST Payable Cr; SGST Payable Cr.
- **Sales (inter-state)**: IGST Payable Cr instead of CGST/SGST.
- **Purchase (intra-state)**: Purchase Dr; CGST ITC Dr; SGST ITC Dr; Vendor Cr.
- **Purchase (inter-state)**: IGST ITC Dr.
- **Payment/Receipt**: Cash/Bank ↔ Party.
- Always ask the user before changing accounting logic.

GST split rule: same-state seller/buyer → CGST+SGST (50/50); different-state → IGST only. Determined by GSTIN state codes.

## 10. Login Credentials (test)

Password for all: **`Aashu@123`**

| Role | Email |
|---|---|
| Admin | admin@demo.com |
| Manager | manager@demo.com |
| Accountant | accountant@demo.com |
| Salesman | salesman@demo.com |

## 11. Offline-First Sync Architecture

Save-locally-first, then push to server. Sync columns on every table:

```
id (UUID PK), sync_status ENUM('pending','synced','conflict'),
device_id, synced_at, updated_at_local, created_at, updated_at
```

- **UUID everywhere** — no auto-increment (prevents cross-device collisions).
- **Append-only** stock ledger and journal entries — corrections via reversal.
- **Server wins** on conflict. Exception: printed invoices are flagged for manual review.
- **NetInfo listener** auto-triggers sync when online.
- API: `POST /api/v1/sync/push`, `GET /api/v1/sync/pull?last_synced_at=…`.

Sync states: `pending` · `synced` · `failed` · `conflict`.

## 12. Batch & Expiry Tracking (Inventory) — Implemented

- `items.is_batch_tracked` toggles per-item batch tracking.
- `batches` table: `batch_number`, `manufacturing_date`, `expiry_date`, `purchase_price`, `selling_price`, computed `current_stock`. `StockLedger.batch_id` is optional FK.
- API: `BatchController` CRUD + `GET /batches/expiring?days=30`.
- FE: `Items.tsx` checkbox + Batch badge + PackageOpen action; `ItemBatches.tsx` (`/inventory/items/:itemId/batches`); `PurchaseInvoiceFormPage.tsx` shows blue batch row when line item is batch-tracked.
- Workflow: enable batch tracking → add batches under item → on purchase invoice select batch → save (sends `batch_id`).
- Expiry status colors: red Expired (`expiry < today`), orange Expiring Soon (≤30d), green OK, grey No Expiry.

## 13. Phase 1 Modules (Months 1–4)

1. **Auth & Multi-user** — companies, JWT/Sanctum, roles (admin/manager/accountant/salesman), module permissions, OTP reset, audit log, multi-branch, session control.
2. **Inventory** — item master (HSN, GST%, unit), batches, multi-godown, stock ledger, opening stock, transfers, reorder alerts, adjustments, reports.
3. **Purchase** — vendors, PO → GRN → invoice with GST, returns/debit notes, payments, auto journal, GSTR-2-ready register, vendor ledger.
4. **Sales** — customers, quotes/orders, GST invoice, returns/credit notes, receipts, credit-limit enforcement, auto journal, GSTR-1-ready register, customer ledger, PDF print.
5. **Accounting** — Chart of Accounts, manual journals, auto-posting, bank reconciliation, cash/bank book, P&L, balance sheet, trial balance, FY management & locking, day book.

## 14. Key Libraries

- **Laravel**: `sanctum`, `spatie/laravel-permission`, `spatie/laravel-activitylog`, `barryvdh/laravel-dompdf`, `maatwebsite/excel`, `telescope` (dev).
- **React Native**: `expo`, `expo-router`, `@nozbe/watermelondb`, `@tanstack/react-query`, `zustand`, `react-hook-form`+`zod`, `@react-native-community/netinfo`, `nativewind`, `react-native-device-info`.
- **Web**: `vite`, `dexie`, `@tanstack/react-query`, `zustand`, `react-hook-form`+`zod`, `@tanstack/react-table`, `recharts`, `tailwindcss`.

## 15. Design Decisions (Why)

1. UUID PKs avoid offline-creation ID collisions.
2. Append-only ledgers preserve audit history; corrections are reversals.
3. Auto double-entry posting on invoices keeps books always balanced.
4. Server-wins keeps financial data simple and safe; printed invoices are the only manual-review case.
5. Sync runs in background — UI never blocks.

---

*Summary written by Claude after scanning the project; canonical source remains `CLAUDE.md`.*
