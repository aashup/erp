# ERP Project Plan — Marg-like Offline-First ERP

> Generated plan for building a Marg ERP-like application for Indian SMEs.
> Stack: Laravel + MySQL · React Native (Expo) · React (Vite) · Offline-first sync

---

## Development Rules

- **Do NOT start dev servers, preview, or run the application** unless the user explicitly asks to check errors or run the application.

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