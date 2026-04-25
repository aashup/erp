# ERP Project Plan — Marg-like Offline-First ERP

> Generated plan for building a Marg ERP-like application for Indian SMEs.
> Stack: Laravel + MySQL · React Native (Expo) · React (Vite) · Offline-first sync

---

## Invoice Printing System

There are **two completely separate printing systems**. Never mix them up.

### 1. A4 / Default Invoice Template (PDF)
- Used in: **Sales Invoice list page** — "Print A4" button
- Paper: A4 (210×297mm)
- Backend: `InvoicePdfService::generate()` → renders `resources/views/invoices/templates/default.blade.php` (or user-selected template from `invoice_templates` table)
- Frontend API call: `GET /sales-invoices/{id}/pdf` → downloads PDF
- Settings page: **Invoice Settings** → "Default Invoice Template" section
- Template stored in: `invoice_templates` table (different from thermal)

### 2. Thermal Printer Template (HTML → browser print)
- Used in: **POS print button** + **Sales Invoice list page** "Print Thermal" button
- Paper: 2-inch (58mm) or 3-inch (80mm) roll paper
- Backend flow:
  1. `GET /sales-invoices/{id}/html?template=thermal-custom&paper_size=2inch`
  2. `SalesInvoiceController@html` looks up `ThermalTemplate` where `company_id`, `paper_size`, `is_default=true`
  3. If found → renders via `ThermalTemplateRenderer::render()` (variable substitution: `{{company_name}}`, `{{items_table}}`, etc.)
  4. If NOT found → falls back to built-in Blade template: `resources/views/invoices/templates/thermal.blade.php`
- Frontend: fetches HTML with Bearer token → creates Blob URL → `window.open()` → `window.print()`
- Settings page: **Thermal Invoice Templates** (`/settings/thermal-templates`) — `ThermalTemplateEditor.tsx`
- Template stored in: `thermal_templates` table (fields: `name`, `html_content`, `paper_size`, `is_default`, `company_id`)
- **Load Defaults**: `POST /thermal-templates/load-defaults` creates built-in 2inch + 3inch default templates for the company (skips if already exist)
- Paper size preference: stored in `company_settings` as key `thermal_printer_paper_size` ('2inch'|'3inch')
- Default template preference: stored in `company_settings` as key `default_invoice_template`
- POS reads these settings on mount via `companySettingsApi.get()` and uses them in `handlePrint()`

### Key constraint
- `thermal_templates` has no MySQL unique partial index (MySQL limitation). Controller logic enforces "one default per paper_size" by setting others to `is_default=false` before inserting a new default.

### Template variables available in ThermalTemplateRenderer
`{{company_name}}`, `{{company_gstin}}`, `{{company_address}}`, `{{company_phone}}`, `{{company_email}}`, `{{invoice_number}}`, `{{invoice_date}}`, `{{invoice_date_formatted}}`, `{{customer_name}}`, `{{customer_gstin}}`, `{{customer_address}}`, `{{customer_city}}`, `{{customer_phone}}`, `{{subtotal}}`, `{{cgst_total}}`, `{{sgst_total}}`, `{{igst_total}}`, `{{round_off}}`, `{{grand_total}}`, `{{balance_due}}`, `{{amount_in_words}}`, `{{items_table}}`, `{{gst_summary}}`

---

## Actual Project Directory Layout

> The monorepo plan below is aspirational. The **real** working directories are:

```
erp/
├── api/          # Laravel 11 backend  (not backend/)
│   ├── app/Http/Controllers/Api/V1/
│   ├── app/Models/
│   ├── app/Services/          # AccountingService, InvoicePdfService, PayrollService, etc.
│   ├── app/Policies/          # 17 policies — VoucherPolicy guards all report endpoints
│   ├── app/Traits/            # HasUuid, HasSyncColumns, BelongsToCompany, FiltersByFinancialYear
│   ├── database/migrations/   # Modify in-place (no new files during initial dev)
│   └── routes/api.php         # All routes under /api/v1, auth:sanctum
└── fe/           # React + Vite frontend  (not apps/web/)
    └── src/
        ├── api/               # accounting.ts, inventory.ts, sales.ts, payroll.ts, …
        ├── components/layout/ # AppLayout, Header (FY selector lives here), Sidebar
        ├── components/ui/     # DataTable, Modal, FilterPanel, SlideSelect, …
        ├── hooks/             # useFinancialYear.ts, useSelectedFYId, useDebounce, …
        ├── lib/               # axios.ts (auto-injects JWT + financial_year_id), utils.ts
        ├── pages/accounting/  # ChartOfAccounts, Ledgers, TrialBalance, ProfitAndLoss, …
        ├── store/             # authStore, fyStore (selectedFY → localStorage), themeStore
        └── App.tsx            # React Router v7 routes + React Query provider
```

---

## Accounting Reports — Key Patterns

### Report Controller (`api/app/Http/Controllers/Api/V1/ReportController.php`)
All report endpoints share `resolveDateRange()`:
1. If explicit `date_from` + `date_to` params → use them
2. Else if `financial_year_id` param → look up `FinancialYear`, return `start_date`/`end_date`
3. Else → return `[null, null]` → no date filter (all-time)

Endpoints: `trial-balance`, `profit-and-loss`, `balance-sheet`, `party-ledger`, `ledger-transactions`, `cash-book`, `bank-book`, `day-book`.
All require `accounting.view` permission (`$this->authorize('viewAny', Voucher::class)`).

### Financial Year Dates — IST→UTC Storage Gotcha
FY dates are entered as Indian dates (e.g. April 1) but stored in MySQL `date` columns at UTC, so they land one day earlier:
- April 1, 2026 IST → stored as `2026-03-31`
- March 31, 2027 IST → stored as `2027-03-30`

This is consistent and `whereDate()` comparisons work correctly — just don't be confused when reading raw DB values.

### Financial Year — Frontend (`fe/src/store/fyStore.ts`, `fe/src/hooks/useFinancialYear.ts`)
- `useFYStore` persists `selectedFY` to `localStorage` key `selectedFY` (JSON)
- `useFinancialYear()` is called once in `AppLayout`; fetches all FYs and auto-selects the stored one (or `is_current` FY as fallback)
- The `axios.ts` request interceptor auto-injects `financial_year_id` from `localStorage.selectedFY` on **every GET request** — no manual passing needed in most API calls
- **Critical pattern for report query keys**: always include `selectedFY?.id` in the React Query key so changing the FY in the header triggers a refetch:
  ```tsx
  const selectedFY = useFYStore((s) => s.selectedFY);
  queryKey: ['report-name', appliedDateFrom, appliedDateTo, selectedFY?.id]
  ```

### TrialBalance Page (`fe/src/pages/accounting/TrialBalance.tsx`)
- Builds a tree from flat rows returned by the API (groups + ledgers with `parent_id` linking)
- `hideZero: true` by default — rows/groups with all-zero balances are hidden
- When `rows.length > 0` but all rows are hidden by `hideZero`, shows "All accounts have zero balance for FY X" with a "Show all accounts" button
- FY label shown in subtitle so user always knows the active period
- Ledger rows are clickable → opens a slide-over drill-down panel showing all voucher lines

---

## Development Rules

- **Do NOT start dev servers, preview, or run the application** unless the user explicitly asks to check errors or run the application.
- **Do NOT create new migration files** for schema changes. This is the initial development phase — always modify the existing migration file directly. The database can be refreshed with `php artisan migrate:fresh --seed`.

## MCP Servers (Always Use These)

Two MCP servers are active — **always use them**. Never use Bash equivalents.

### `mcp__mysql` — ALL MySQL operations
- Use `mcp__mysql__mysql_query` for **every** database operation: SELECT, INSERT, UPDATE, DELETE, ALTER TABLE, CREATE TABLE, DROP TABLE.
- **Never** use Bash `mysql` CLI or `docker-compose exec` for database tasks.
- Fully enabled: SELECT · INSERT · UPDATE · DELETE · DDL (ALTER/CREATE/DROP TABLE).
- Use this to: inspect schema, run queries, verify data, apply schema changes, debug issues.

### `mcp__filesystem` — ALL file operations
- Use `mcp__filesystem__*` tools for **every** file operation: read, write, edit, list directory, search files.
- **Never** use Bash `cat`, `ls`, `find`, `grep`, `echo >`, or `cp` for project files.
- Available tools: `read_file`, `write_file`, `edit_file`, `list_directory`, `search_files`, `create_directory`, `move_file`, `get_file_info`.
- Covers the entire `/Users/aashu/erp/` project tree.

---

## Accounting Reference (Tally / Marg ERP Style)

> Always follow Tally / Marg ERP conventions for accounting logic. Ask the user before making any accounting-related changes.

### Core Structure
Groups → Ledgers → Vouchers → Double Entry

### 1. Groups (Chart of Accounts Hierarchy)
| Primary Group | Example Sub-groups |
|---|---|
| **Assets** | Current Assets → Bank Accounts → SBI, Cash-in-Hand |
| **Liabilities** | Current Liabilities → Sundry Creditors, Duties & Taxes |
| **Income** | Direct Income → Sales Account |
| **Expenses** | Direct Expenses → Purchase Account, Indirect Expenses → Electricity |

### 2. Ledgers (Accounts under Groups)
Every ledger belongs to a group. Examples: Cash, SBI Bank, Sales Account, Purchase Account, Party (Customer/Vendor).

### 3. Vouchers & Double Entry
One voucher = multiple ledger entries. **Rule: SUM(Dr) must always equal SUM(Cr).**

Sale ₹1,000 (incl. tax) → Party A/c **Dr** ₹1,000 · Sales A/c **Cr** ₹900 · Output GST A/c **Cr** ₹100

Receipt ₹1,000 → Cash/Bank A/c **Dr** ₹1,000 · Party A/c **Cr** ₹1,000

### 4. GST & ITC Rules
- **Purchase** → Tax paid is **ITC** (Input Tax Credit) — recorded as asset
  - Intra-state: CGST ITC + SGST ITC
  - Inter-state: IGST ITC
- **Sale** → Tax collected is **GST Liability** — recorded as liability
  - Intra-state: CGST Payable + SGST Payable
  - Inter-state: IGST Payable

**Purchase Invoice entry:**
Purchase A/c Dr · CGST ITC Dr · SGST ITC Dr (or IGST ITC Dr) · Vendor A/c Cr

**Sales Invoice entry:**
Customer A/c Dr · Sales A/c Cr · CGST Payable Cr · SGST Payable Cr (or IGST Payable Cr)

---

## Login Details

Role-wise login credentials for testing. **Password for all: `Aashu@123`**

| Role       | Email                  |
|------------|------------------------|
| Admin      | admin@demo.com         |
| Manager    | manager@demo.com       |
| Accountant | accountant@demo.com    |
| Salesman   | salesman@demo.com      |

---

## Project Overview

A GST-compliant, offline-first ERP application for Indian small businesses.
Works without internet — syncs to server when connection is available.
Targets: retailers, wholesalers, pharma distributors, kirana stores.

---

## Tech Stack

| Layer            | Technology              | Purpose                          | Cost         |
|------------------|-------------------------|----------------------------------|--------------|
| Mobile app       | React Native (Expo)     | Android APK                      | Free         |
| Mobile local DB  | WatermelonDB (SQLite)   | Offline storage on phone         | Free         |
| Web app          | React (Vite)            | Browser ERP                      | Free         |
| Web local DB     | Dexie.js (IndexedDB)    | Offline storage in browser       | Free         |
| Shared logic     | Shared JS package       | Hooks, utils, types, GST calc    | Free         |
| Backend API      | Laravel 11              | REST API + sync endpoint         | Free         |
| Server DB        | MySQL                   | Central database                 | Free (Railway)|
| API hosting      | Railway.app             | Host Laravel + MySQL             | Free tier    |
| Web hosting      | Vercel / Netlify        | Host React web app               | Free         |
| APK testing      | Expo Go                 | Test on phone instantly          | Free         |

---

## Implemented Features Reference

### Batch & Expiry Tracking (Inventory)

**Backend** — fully implemented, no changes needed:
- `items.is_batch_tracked` (boolean, default false) — marks an item as batch-tracked
- `batches` table: `batch_number`, `manufacturing_date`, `expiry_date`, `purchase_price`, `selling_price`, `current_stock` (computed)
- `BatchController`: CRUD + `expiring()` endpoint (`GET /batches/expiring?days=30`)
- `StockLedger` has optional `batch_id` FK — all stock operations (opening, adjustment, transfer) support batch tracking

**Frontend** — implemented:
- `Items.tsx`: "Track batches & expiry" checkbox shows a blue info callout when checked; items with batch tracking show a **Batch** badge and a **PackageOpen** icon button in the Actions column
- `ItemBatches.tsx` (`/inventory/items/:itemId/batches`): Full batch management page — list, add, edit, delete batches; expiry status badges (Expired/Expiring Soon/OK/No Expiry); alert banners for expired/expiring batches
- `PurchaseInvoiceFormPage.tsx`: When a line item has `is_batch_tracked = true`, a blue batch selection row appears under the line — fetches & shows available batches via `batchesApi.list(itemId)`; guides user to create batches first if none exist; sends `batch_id` to backend on submit
- `batchesApi` in `fe/src/api/inventory.ts`: `list(itemId)`, `create(itemId, data)`, `update(batchId, data)`, `delete(batchId)`, `expiring(params)`
- Route added in `App.tsx`: `/inventory/items/:itemId/batches`

**Workflow for batch-tracked purchase:**
1. Create item with "Track batches & expiry" enabled
2. Go to Items → Batches → Add batch (batch no, mfg date, expiry date)
3. Create purchase invoice → select the batch-tracked item → a batch selection row appears → select the batch → save

**Expiry status logic** (frontend, `ItemBatches.tsx`):
- Red `Expired`: `expiry_date < today`
- Orange `Expiring Soon`: within next 30 days
- Green `OK`: more than 30 days away
- Grey `No Expiry`: `expiry_date` is null

---

## Phase 1 Modules (Months 1–4)

### 1. Auth & Multi-user
- Company / tenant registration
- Roles: admin, manager, accountant, salesman
- Module-level permissions (view / create / edit / delete)
- JWT-based login with refresh tokens
- Password reset via OTP
- Audit log — who did what, when
- Multi-branch / godown support
- Session management & force logout

### 2. Inventory
- Item master (name, HSN code, unit, GST %, category)
- Batch & expiry tracking
- Multi-godown / warehouse support
- Stock ledger (every movement logged)
- Opening stock entry
- Stock transfer between godowns
- Reorder level alerts
- Physical stock adjustment / write-off
- Stock summary report
- Item-wise movement report

### 3. Purchase
- Vendor / party master
- Purchase order (PO) creation
- Goods receipt note (GRN)
- Purchase invoice with GST (CGST / SGST / IGST)
- Purchase return / debit note
- Vendor payment recording
- Auto journal entry on GRN & invoice
- Pending PO report
- Purchase register (GSTR-2 ready)
- Vendor ledger & outstanding

### 4. Sales
- Customer / party master
- Sales order / quotation
- GST invoice generation (CGST / SGST / IGST)
- Sales return / credit note
- Payment receipt recording
- Customer credit limit enforcement
- Auto journal entry on invoice
- Sales register (GSTR-1 ready)
- Customer ledger & outstanding
- Invoice PDF generation & print

### 5. Accounting
- Chart of accounts with groups
- Manual journal entry (voucher)
- Double-entry auto-posting from purchase & sales
- Bank reconciliation
- Cash & bank book
- Profit & loss statement
- Balance sheet
- Trial balance
- Financial year management & locking
- Day book / transaction register

---

## Offline-First Architecture

### How it works

```
User creates invoice
  → Save to local DB first (SQLite / IndexedDB)
  → Mark as sync_status = 'pending'
  → Internet available? → Push to Laravel API
  → Mark as sync_status = 'synced'
```

Works 100% offline. Syncs automatically when internet returns.

### Sync Status Values
- `pending`  — saved locally, not yet sent to server
- `synced`   — confirmed on server
- `failed`   — sync attempted but failed (retry)
- `conflict` — edited on two devices simultaneously (manual review)

### Conflict Resolution Rule
- **Server wins** by default
- Exception: invoices already printed → flag as conflict, never auto-overwrite

### Key Design Rules
1. **Use UUID everywhere** — never auto-increment IDs (prevents collision across devices)
2. **`updated_at_local` timestamp** — used to detect which version is newer during sync
3. **NetInfo listener** — auto-trigger sync the moment internet comes back (user does nothing)

---

## Database Schema (MySQL — Server)

Every table has these 4 sync columns in addition to its own fields:

```sql
`id`               UUID PRIMARY KEY        -- never auto-increment
`sync_status`      ENUM('pending','synced','conflict') DEFAULT 'pending'
`device_id`        VARCHAR(255) NULLABLE   -- which device created it
`synced_at`        TIMESTAMP NULLABLE      -- when it reached the server
`updated_at_local` TIMESTAMP               -- local device time at save
`created_at`       TIMESTAMP               -- server timestamps
`updated_at`       TIMESTAMP
```

### Core Tables
- `companies` — multi-tenant root
- `users` — with role and company_id
- `role_permissions` — module + action per user
- `parties` — vendors and customers (type field)
- `items` — item master with HSN, GST rate
- `batches` — batch/expiry per item
- `stock_ledger` — append-only, every stock movement
- `purchase_orders` + `po_lines`
- `sales_orders` + `so_lines`
- `journal_entries` + `journal_lines`

---

## Sync API Endpoints (Laravel)

```
POST /api/v1/sync/push   — mobile/web sends pending records to server
GET  /api/v1/sync/pull   — mobile/web fetches changes from server since last sync
```

### Push logic
1. Receive array of changed records from device
2. `updateOrCreate` by UUID
3. Mark `sync_status = synced`, set `synced_at`
4. Return count of synced records

### Pull logic
1. Accept `last_synced_at` timestamp from device
2. Return all records updated after that timestamp
3. Device merges server records into local DB

---

## Monorepo Folder Structure

```
erp-app/
├── apps/
│   ├── mobile/                  # Expo React Native → Android APK
│   │   ├── app/
│   │   │   ├── (auth)/login.tsx
│   │   │   └── (tabs)/
│   │   │       ├── inventory.tsx
│   │   │       ├── purchase.tsx
│   │   │       ├── sales.tsx
│   │   │       └── accounting.tsx
│   │   ├── components/          # View, Text, FlatList components
│   │   └── package.json
│   └── web/                     # React (Vite) → Browser
│       ├── src/
│       │   ├── pages/
│       │   │   ├── inventory/
│       │   │   ├── purchase/
│       │   │   ├── sales/
│       │   │   └── accounting/
│       │   └── components/      # div, table, input components
│       └── package.json
├── packages/
│   └── shared/                  # ~60% of code — used by both apps
│       ├── api/
│       │   ├── axios.ts         # Axios instance with auth token
│       │   ├── inventory.ts
│       │   ├── sales.ts
│       │   └── purchase.ts
│       ├── hooks/
│       │   ├── useInventory.ts  # React Query — works on web and mobile
│       │   ├── useSales.ts
│       │   └── usePurchase.ts
│       ├── store/
│       │   └── useAppStore.ts   # Zustand shared state
│       ├── utils/
│       │   ├── gst.ts           # GST calculator (pure JS)
│       │   └── format.ts        # ₹ formatting, date helpers
│       ├── sync/
│       │   ├── syncQueue.ts     # Queue manager
│       │   └── syncEngine.ts    # Push/pull logic
│       └── types/
│           ├── invoice.ts
│           ├── inventory.ts
│           └── party.ts
└── backend/                     # Laravel 11 API
    ├── app/
    │   ├── Http/Controllers/Api/V1/
    │   │   ├── SyncController.php
    │   │   ├── InventoryController.php
    │   │   ├── PurchaseController.php
    │   │   └── SalesController.php
    │   ├── Services/
    │   │   ├── SyncService.php
    │   │   ├── InvoiceService.php
    │   │   └── StockService.php
    │   └── Jobs/
    │       ├── GeneratePdfJob.php
    │       └── PostJournalJob.php
    ├── routes/api.php
    └── database/migrations/
```

---

## Laravel Packages

| Package                     | Purpose                                      |
|-----------------------------|----------------------------------------------|
| `laravel/sanctum`           | API token authentication                     |
| `spatie/laravel-permission` | Role-based module permissions                |
| `spatie/laravel-activitylog`| Audit log — who changed what                 |
| `barryvdh/laravel-dompdf`   | Invoice & report PDF generation              |
| `maatwebsite/excel`         | Export reports to Excel / CSV                |
| `laravel/telescope`         | Debug dashboard (dev only)                   |

## React Native Libraries

| Library                     | Purpose                                      |
|-----------------------------|----------------------------------------------|
| `expo`                      | Managed React Native framework               |
| `expo-router`               | File-based navigation (like Next.js)         |
| `@nozbe/watermelondb`       | Offline SQLite database                      |
| `@tanstack/react-query`     | Server state & data fetching                 |
| `zustand`                   | Client state management                      |
| `react-hook-form` + `zod`   | Forms with schema validation                 |
| `@react-native-community/netinfo` | Detect online/offline status          |
| `nativewind`                | Tailwind CSS for React Native                |
| `react-native-device-info`  | Get device UUID for sync tracking            |

## React Web Libraries

| Library                     | Purpose                                      |
|-----------------------------|----------------------------------------------|
| `vite`                      | Fast build tool                              |
| `dexie`                     | IndexedDB wrapper for offline web storage    |
| `@tanstack/react-query`     | Same as mobile — shared hooks work           |
| `zustand`                   | Same store as mobile                         |
| `react-hook-form` + `zod`   | Same validation schemas as mobile            |
| `@tanstack/react-table`     | Data tables for stock, ledger views          |
| `recharts`                  | Dashboard charts                             |
| `tailwindcss`               | Styling                                      |

---

## Build Order (Recommended)

### Step 1 — Backend (Week 1–2)
- [ ] Create Laravel project
- [ ] Set up MySQL on Railway.app (free)
- [ ] Create migrations for all 5 modules with sync columns
- [ ] Set up Laravel Sanctum auth
- [ ] Build sync push/pull endpoints
- [ ] Build CRUD APIs for items, parties, invoices
- [ ] Test with Postman

### Step 2 — Shared Package (Week 3)
- [ ] Set up monorepo with npm workspaces
- [ ] Create `packages/shared`
- [ ] Write TypeScript types for all models
- [ ] Write Axios instance with token interceptor
- [ ] Write GST calculator utility
- [ ] Write sync engine (push/pull logic)
- [ ] Write React Query hooks

### Step 3 — React Native Mobile (Week 4–8)
- [ ] Create Expo app
- [ ] Set up WatermelonDB models matching server schema
- [ ] Build login screen
- [ ] Build item master screen (offline-first)
- [ ] Build sales invoice screen (offline-first)
- [ ] Build purchase screen (offline-first)
- [ ] Add sync status indicator in UI
- [ ] Add NetInfo listener for auto-sync
- [ ] Test on Android phone with Expo Go
- [ ] Build APK with EAS Build

### Step 4 — React Web (Week 9–12)
- [ ] Create Vite React app
- [ ] Set up Dexie.js for offline web storage
- [ ] Reuse all shared hooks from Step 2
- [ ] Build web UI for all 5 modules
- [ ] Deploy to Vercel (free)

### Step 5 — Polish (Week 13–16)
- [ ] GST invoice PDF generation (server-side)
- [ ] GSTR-1 and GSTR-2 export
- [ ] Stock alerts / reorder notifications
- [ ] Accounting reports (P&L, Balance Sheet)
- [ ] Multi-user / role testing
- [ ] Performance testing with large data

---

## GST Logic (India-specific)

```typescript
// packages/shared/utils/gst.ts
export function calcGST(amount: number, rate: number, isInterState: boolean) {
  const gstAmount = (amount * rate) / 100
  if (isInterState) {
    return { igst: gstAmount, cgst: 0, sgst: 0 }
  }
  return { igst: 0, cgst: gstAmount / 2, sgst: gstAmount / 2 }
}
```

- **Intra-state** (same state buyer & seller) → CGST + SGST (split 50/50)
- **Inter-state** (different state) → IGST only
- Determine by comparing seller GSTIN state code with buyer GSTIN state code

---

## Free Infrastructure Setup

```
Railway.app     → Laravel API + MySQL database
Vercel          → React web app
Expo Go         → Test mobile on your Android phone (no APK needed in dev)
EAS Build       → Free 1 APK build/month for production
GitHub          → Source code (free)
```

Total monthly cost to start: **₹0**

---

## Important Design Decisions

1. **UUID primary keys everywhere** — never use auto-increment. Prevents ID collision when multiple devices create records offline simultaneously.

2. **Stock ledger is append-only** — never edit or delete a stock entry. To correct, create a reversal entry. Same rule applies to journal entries.

3. **Double-entry accounting** — every sales invoice auto-posts:
   - Dr: Accounts Receivable
   - Cr: Sales Revenue
   - Cr: GST Payable (CGST/SGST/IGST)

4. **Server wins on conflict** — simpler and safer for financial data. Exception: flag printed invoices as conflicts for manual review.

5. **Sync in background** — never block the UI for sync. User can keep working. Show a small sync status badge (synced / pending / failed).

---

*Plan created with Claude — claude.ai*