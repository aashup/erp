# Zazzy POS — Petpooja-style Restaurant POS
## Electron + React → connects to existing ERP Laravel backend

---

## Core Philosophy

**Reuse the existing ERP at `/Users/aashu/erp` as much as possible.**

- Same Laravel backend at `/Users/aashu/erp/api` — extend it, don't duplicate
- Same auth (Sanctum), same items, parties, stock ledger, accounting, vouchers
- `AccountingService::postSalesInvoice()` auto-creates journal vouchers (Dr Party → Cr Sales + GST) — same as ERP
- New Electron app at `/Users/aashu/code/pos` connects to the same backend API
- Copy patterns from `fe/src/` (api service pattern, Zustand stores, sync engine, types)

---

## What's Reused vs What's New

### Reused from ERP (zero changes)
- `/api/app/Traits/HasUuid.php` — copy verbatim into any new models
- `/api/app/Traits/HasSyncColumns.php` — copy verbatim
- `/api/app/Traits/BelongsToCompany.php` — copy verbatim (restaurant = company)
- `/api/app/Services/AccountingService.php` — called as-is; auto-voucher on checkout
- `/api/app/Http/Controllers/Api/V1/POSController.php` — reuse `checkout()`, `hold()`, `items()`, `quick-party`
- `/api/app/Services/ThermalTemplateRenderer.php` — receipt printing
- All existing models: `Item`, `Party`, `SalesInvoice`, `StockLedger`, `Voucher`, `Ledger`, `PaymentReceipt`
- Sync engine pattern from `fe/src/lib/sync.ts`
- API service pattern from `fe/src/api/pos.ts`
- Type interfaces from `fe/src/types/index.ts`

### Extended in ERP backend (new routes/models added to existing project)
- `SalesInvoice` migration — add `order_type`, `table_id`, `pax` columns
- New models + migrations: `FloorPlan`, `DiningTable`, `KitchenOrderTicket`, `KotLine`, `Recipe`, `RecipeIngredient`
- New controllers + routes for restaurant features

### New project (Electron app)
- `/Users/aashu/code/pos/` — Electron 32 + React 19 + electron-vite
- Local SQLite via `better-sqlite3` (main process only, no Dexie/IndexedDB)
- Connects to ERP API via axios + Sanctum token

---

## Project Structure

```
/Users/aashu/code/pos/
├── electron-app/
│   ├── electron.vite.config.ts
│   ├── src/
│   │   ├── main/                      # Node.js Electron main process
│   │   │   ├── index.ts               # app entry, window management
│   │   │   ├── windows/
│   │   │   │   ├── MainWindow.ts      # POS billing window
│   │   │   │   └── KitchenWindow.ts   # kitchen display (second screen)
│   │   │   ├── ipc/
│   │   │   │   ├── dbIpc.ts           # SQLite ↔ renderer IPC
│   │   │   │   ├── printerIpc.ts      # thermal print IPC
│   │   │   │   └── syncIpc.ts         # manual sync trigger
│   │   │   ├── db/
│   │   │   │   ├── database.ts        # better-sqlite3 singleton
│   │   │   │   ├── migrations.ts      # run schema on startup
│   │   │   │   ├── schema.sql         # full DDL
│   │   │   │   └── repositories/      # ItemRepo, OrderRepo, TableRepo, KotRepo
│   │   │   ├── sync/
│   │   │   │   ├── SyncEngine.ts      # push + pull orchestrator
│   │   │   │   ├── SyncScheduler.ts   # 30s timer + reconnect trigger
│   │   │   │   ├── PushWorker.ts
│   │   │   │   └── PullWorker.ts
│   │   │   └── print/
│   │   │       ├── ThermalPrinter.ts  # node-thermal-printer
│   │   │       └── KotPrinter.ts
│   │   ├── preload/
│   │   │   └── index.ts               # contextBridge → window.electronAPI
│   │   └── renderer/src/              # React app
│   │       ├── App.tsx
│   │       ├── api/                   # axios clients (copy pattern from fe/src/api/)
│   │       │   ├── client.ts
│   │       │   ├── pos.ts             # copy from erp fe/src/api/pos.ts + extend
│   │       │   ├── tables.ts
│   │       │   └── kot.ts
│   │       ├── bridge/ipc.ts          # typed window.electronAPI wrappers
│   │       ├── store/                 # Zustand (copy authStore pattern)
│   │       │   ├── authStore.ts
│   │       │   ├── cartStore.ts       # cart lines, GST computed, order type
│   │       │   ├── syncStore.ts
│   │       │   └── settingsStore.ts
│   │       ├── pages/
│   │       │   ├── auth/Login.tsx
│   │       │   ├── setup/SetupWizard.tsx
│   │       │   ├── pos/BillingScreen.tsx
│   │       │   ├── tables/TableSelection.tsx
│   │       │   ├── orders/OrderList.tsx
│   │       │   ├── kitchen/KitchenDisplay.tsx
│   │       │   ├── inventory/RecipeManager.tsx
│   │       │   └── reports/SalesSummary.tsx
│   │       ├── components/
│   │       │   ├── pos/               # ItemGrid, Cart, PaymentModal, etc.
│   │       │   ├── tables/            # TableMap, TableCard
│   │       │   └── kitchen/           # KOTCard, KitchenBoard
│   │       └── types/index.ts         # copy + extend from erp fe/src/types/index.ts
│   └── package.json
```

---

## Step-by-Step Build Plan

---

### STEP 1 — Scaffold the Electron App

**Goal:** Electron window opens; can ping the ERP backend.

**Tasks:**
1. `cd /Users/aashu/code/pos && npm create @quick-start/electron electron-app --template react-ts`
2. Install dependencies:
   ```
   npm install better-sqlite3 electron-store axios @tanstack/react-query zustand
   npm install react-router-dom react-hook-form zod lucide-react react-hot-toast
   npm install tailwindcss @tailwindcss/vite tailwind-merge clsx recharts
   npm install node-thermal-printer electron-updater
   npm install -D @types/better-sqlite3 electron-builder
   ```
3. Configure `electron.vite.config.ts` — set renderer root to `src/renderer`
4. Configure Tailwind CSS (same config as ERP's `fe/tailwind.config.ts`)
5. Set up `src/main/index.ts`:
   - Creates `BrowserWindow` (1280×800, frame=true)
   - Registers IPC handlers
   - On ready, opens to `/setup` if no token, else `/pos/billing`
6. Create `src/preload/index.ts` — contextBridge exposes `window.electronAPI`
7. Create `src/renderer/src/api/client.ts` — copy axios setup from `fe/src/lib/axios.ts`, change baseURL to configurable server URL from `electron-store`
8. Add `GET /api/health` route to ERP `api/routes/api.php` (public, returns `{ ok: true }`)
9. Verify: Electron opens, renderer fetches `/api/health` from ERP and shows "connected"

**Files to copy from ERP:**
- `fe/src/lib/axios.ts` → `renderer/src/api/client.ts` (change base URL to use `electron-store` value)

---

### STEP 2 — Auth & Device Registration

**Goal:** Staff log in with their ERP credentials; device registers itself with the company.

**Backend (ERP api — no changes needed):**
- `POST /api/v1/auth/login` — already exists, returns user + token
- `GET /api/v1/auth/me` — already exists

**New ERP routes needed:**
- `POST /api/v1/devices/register` — saves `{ company_id, device_name, device_uuid, outlet_id }` in new `pos_devices` table
- Add `pos_devices` migration to existing `2026_03_24_000018_...` or create one migration in-place

**Electron tasks:**
1. Create `src/main/auth/TokenStore.ts` — wraps `electron-store` with `safeStorage` encryption for token/user
2. Create `Login.tsx` page — email + password form, calls `POST /api/v1/auth/login`
3. Create `SetupWizard.tsx` — shown first time:
   - Step 1: Enter server URL (stored in `electron-store` key `serverUrl`)
   - Step 2: Login
   - Step 3: Device name entry → `POST /api/v1/devices/register` → store `device_id`
4. Create `authStore.ts` — copy pattern from `fe/src/store/authStore.ts`:
   ```typescript
   { user, token, companyId, deviceId, godownId, isAuthenticated, setAuth, logout }
   ```
5. On app start: read token from `TokenStore`, call `/auth/me`, redirect to `/pos/billing` or `/login`
6. Auto-logout on 401 (same pattern as ERP axios interceptor)

**Files to copy from ERP:**
- `fe/src/store/authStore.ts` → `renderer/src/store/authStore.ts` (add `deviceId`, `godownId`)

---

### STEP 3 — Extend ERP Backend for Restaurant Features

**Goal:** Add restaurant-specific tables to the existing ERP MySQL database. No new Laravel project — extend in-place.

**New migrations (modify in-place as per CLAUDE.md rule):**

**A. Extend `sales_invoices` table** (modify existing migration `2026_03_24_000016_...`):
```sql
ADD COLUMN order_type ENUM('dine_in','takeaway','delivery') DEFAULT 'takeaway'
ADD COLUMN table_id   CHAR(36) NULL   -- FK → dining_tables
ADD COLUMN pax        SMALLINT DEFAULT 1
ADD COLUMN kot_count  TINYINT DEFAULT 0
```

**B. New table: `floor_plans`**
```sql
id UUID PK, company_id UUID FK, name VARCHAR, sort_order INT,
+ HasUuid, HasSyncColumns, BelongsToCompany traits
```

**C. New table: `dining_tables`**
```sql
id UUID PK, company_id UUID FK, floor_plan_id UUID FK,
name VARCHAR(20), capacity TINYINT DEFAULT 4,
shape ENUM('square','round','rectangle') DEFAULT 'square',
pos_x SMALLINT DEFAULT 0, pos_y SMALLINT DEFAULT 0,
status ENUM('vacant','occupied','reserved','cleaning') DEFAULT 'vacant',
current_order_id UUID NULL,
is_active BOOL DEFAULT true,
+ sync columns
```

**D. New table: `kots` (Kitchen Order Tickets)**
```sql
id UUID PK, company_id UUID FK, sales_invoice_id UUID FK (nullable, NULL until checkout),
order_session_id UUID,  -- groups KOTs for same table visit
kot_number VARCHAR(20), -- KOT-001, KOT-002
status ENUM('new','in_progress','ready','served') DEFAULT 'new',
notes TEXT NULL, print_count TINYINT DEFAULT 0,
+ sync columns
```

**E. New table: `kot_lines`**
```sql
id UUID PK, kot_id UUID FK, item_id UUID FK,
item_name VARCHAR (snapshot), variant_name VARCHAR NULL,
quantity DECIMAL(10,2), notes TEXT NULL,
status ENUM('pending','cooking','ready') DEFAULT 'pending'
```

**F. New table: `recipes`**
```sql
id UUID PK, company_id UUID FK, item_id UUID FK,
variant_label VARCHAR NULL, notes TEXT NULL
```

**G. New table: `recipe_ingredients`**
```sql
id UUID PK, recipe_id UUID FK, item_id UUID FK (the ingredient item),
quantity DECIMAL(10,4), unit VARCHAR(20)
```

**New Models** (all use `HasUuid + HasSyncColumns + BelongsToCompany`):
- `FloorPlan.php`, `DiningTable.php`, `KitchenOrderTicket.php`, `KotLine.php`
- `Recipe.php`, `RecipeIngredient.php`

**New Controllers + Routes:**
```php
// Add to routes/api.php
Route::apiResource('floor-plans', FloorPlanController::class);
Route::apiResource('dining-tables', DiningTableController::class);
Route::patch('dining-tables/{table}/status', [DiningTableController::class, 'updateStatus']);
Route::post('dining-tables/merge', [DiningTableController::class, 'merge']);
Route::post('orders/{invoice}/kot', [KotController::class, 'generate']);
Route::get('kots', [KotController::class, 'index']);
Route::patch('kots/{kot}/status', [KotController::class, 'updateStatus']);
Route::patch('kots/{kot}/lines/{line}/status', [KotController::class, 'updateLineStatus']);
Route::apiResource('recipes', RecipeController::class);
```

**No changes to AccountingService** — `postSalesInvoice()` called as-is on checkout.

---

### STEP 4 — Local SQLite Schema & Sync Engine

**Goal:** Electron stores data locally in SQLite; syncs with ERP backend on a 30-second interval.

**`src/main/db/schema.sql`** — mirrors ERP tables needed offline:

```sql
-- Config (device-local only, never synced)
CREATE TABLE device_config (key TEXT PRIMARY KEY, value TEXT);

-- Synced DOWN from ERP (read-only locally)
CREATE TABLE items (id TEXT PK, company_id TEXT, name TEXT, sku TEXT, barcode TEXT,
  selling_price REAL, gst_rate REAL, item_group_id TEXT, is_active INTEGER,
  sync_status TEXT DEFAULT 'synced', synced_at TEXT);

CREATE TABLE item_groups (id TEXT PK, company_id TEXT, name TEXT, parent_id TEXT);
CREATE TABLE godowns (id TEXT PK, company_id TEXT, name TEXT, is_default INTEGER);
CREATE TABLE floor_plans (id TEXT PK, company_id TEXT, name TEXT, sort_order INTEGER);
CREATE TABLE dining_tables (id TEXT PK, company_id TEXT, floor_plan_id TEXT, name TEXT,
  capacity INTEGER, shape TEXT, pos_x INTEGER, pos_y INTEGER,
  status TEXT DEFAULT 'vacant', current_order_id TEXT, is_active INTEGER,
  sync_status TEXT, updated_at_local TEXT, synced_at TEXT);

-- Synced UP to ERP (created locally, pushed to server)
CREATE TABLE sales_invoices (
  id TEXT PK, company_id TEXT, device_id TEXT,
  order_type TEXT DEFAULT 'takeaway', table_id TEXT, pax INTEGER DEFAULT 1,
  party_id TEXT, godown_id TEXT, invoice_number TEXT,
  invoice_date TEXT, status TEXT DEFAULT 'draft',
  subtotal REAL, discount_amount REAL, taxable_amount REAL,
  cgst_total REAL, sgst_total REAL, grand_total REAL, round_off REAL,
  amount_paid REAL, balance_due REAL,
  pos_held INTEGER DEFAULT 0, pos_payment_mode TEXT, kot_count INTEGER DEFAULT 0,
  notes TEXT, is_inter_state INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending', updated_at_local TEXT, synced_at TEXT,
  created_at TEXT, updated_at TEXT);

CREATE TABLE sales_invoice_lines (
  id TEXT PK, sales_invoice_id TEXT, item_id TEXT,
  item_name TEXT, quantity REAL, unit TEXT, rate REAL,
  discount_percent REAL DEFAULT 0, gst_rate REAL,
  cgst REAL, sgst REAL, taxable_amount REAL, line_total REAL,
  kot_status TEXT DEFAULT 'pending', notes TEXT,
  sync_status TEXT DEFAULT 'pending');

CREATE TABLE kots (
  id TEXT PK, company_id TEXT, sales_invoice_id TEXT,
  kot_number TEXT, status TEXT DEFAULT 'new',
  notes TEXT, print_count INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending', updated_at_local TEXT, synced_at TEXT,
  created_at TEXT);

CREATE TABLE kot_lines (
  id TEXT PK, kot_id TEXT, item_id TEXT,
  item_name TEXT, variant_name TEXT, quantity REAL, notes TEXT,
  status TEXT DEFAULT 'pending');

-- Offline pending checkout queue (replayed when online)
CREATE TABLE pending_checkouts (
  id TEXT PK, payload TEXT, created_at TEXT, attempts INTEGER DEFAULT 0);

-- Sync outbox
CREATE TABLE sync_queue (
  id INTEGER PK AUTOINCREMENT, table_name TEXT, record_id TEXT,
  operation TEXT, payload TEXT, created_at TEXT,
  attempts INTEGER DEFAULT 0, last_error TEXT);
```

**`src/main/db/database.ts`** — better-sqlite3 singleton, runs migrations on startup

**`src/main/sync/SyncEngine.ts`** — copy logic from `fe/src/lib/sync.ts`, translate from Dexie to better-sqlite3:
- `pushPendingChanges()` — reads `sync_queue`, POSTs to `POST /api/v1/sync/push`
- `pullServerChanges()` — GETs `/api/v1/sync/pull?tables=items,dining_tables,...&since=<timestamp>`, upserts to SQLite
- `syncPendingCheckouts()` — replays `pending_checkouts` by calling `/pos/checkout`

**`src/main/sync/SyncScheduler.ts`** — `setInterval(sync, 30_000)` in foreground, `setInterval(sync, 300_000)` when window is hidden, immediate on `net.online` event.

---

### STEP 5 — Item Sync & Menu/Item Grid

**Goal:** All company items visible in POS screen, loaded from local SQLite.

**Sync setup:**
- On login: `PullWorker` fetches full items list, saves to local SQLite `items` table
- Delta sync on reconnect using `since=<last_synced_at>`

**`ItemRepository.ts`** (main process):
```typescript
searchItems(query: string, groupId?: string): POSItem[]
  // SELECT items + current_stock from stock_ledger SUM
  // LIMIT 60, fuzzy name match + exact barcode/SKU
```

**IPC bridge:** `dbIpc.ts` exposes `ipcMain.handle('items:search', ...)` → renderer calls `window.electronAPI.searchItems(query)`

**`ItemGrid.tsx`** (renderer):
- Left panel: category tabs from `item_groups` SQLite table
- Center: 3-column product tile grid (name, price, food-type dot — green/red)
- Clicking a tile calls `cartStore.addItem(item)`
- Shows current stock badge if `current_stock < 5`

**`ItemSearch.tsx`** (renderer):
- Text input + barcode scanner listener (rapid keystrokes < 100ms ending in Enter = barcode)
- Debounced 300ms search via IPC → `items:search`
- Same barcode detection pattern as `fe/src/pages/pos/POSItemSearch.tsx`

**Files to copy from ERP:**
- `fe/src/pages/pos/POSItemSearch.tsx` → `renderer/src/components/pos/ItemSearch.tsx` (adapt IPC instead of API call)

---

### STEP 6 — Cart System & GST Calculation

**Goal:** Full cart with correct Indian GST (CGST/SGST/IGST), discounts, variants.

**`cartStore.ts`** (Zustand) — most important store:
```typescript
interface CartLine {
  id: string;           // local UUID
  itemId: string;
  itemName: string;     // snapshot
  variantName?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  gstRate: number;
  notes?: string;
  kotStatus: 'pending' | 'sent' | 'cooking' | 'ready' | 'served';
}

interface CartStore {
  lines: CartLine[];
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableId: string | null;
  customerId: string | null;
  customerName: string | null;
  isInterState: boolean;
  godownId: string;
  discount: { type: 'flat' | 'percent'; value: number } | null;

  // Actions
  addItem(item: POSItem, variant?: string, addons?: CartAddon[]): void;
  updateQty(lineId: string, qty: number): void;
  removeItem(lineId: string): void;
  setNotes(lineId: string, notes: string): void;
  applyDiscount(d: CartStore['discount']): void;
  clearCart(): void;

  // Computed (via Zustand selectors)
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
}
```

**GST calculation** — copy from `fe/src/lib/utils.ts` `calcGST` function:
```typescript
// Same logic as ERP POSController checkout()
function calcLineGST(qty, price, discountPct, gstRate, isInterState) {
  const taxable = qty * price * (1 - discountPct / 100);
  const totalGst = taxable * (gstRate / 100);
  return isInterState
    ? { igst: totalGst, cgst: 0, sgst: 0 }
    : { igst: 0, cgst: totalGst / 2, sgst: totalGst / 2 };
}
```

**`Cart.tsx`** component — copy from `fe/src/pages/pos/POSCart.tsx`:
- Right panel: line items with qty spinner, inline discount editor, remove button
- Summary: subtotal, discount, CGST/SGST/IGST, round-off, grand total
- Stock warning when qty > available

**`ItemVariantModal.tsx`** — shown when item has multiple variants/addons before adding to cart

**`NumericPad.tsx`** — on-screen number pad for qty/discount (useful for touch screens)

**Files to copy from ERP:**
- `fe/src/pages/pos/POSCart.tsx` → `renderer/src/components/pos/Cart.tsx`
- `fe/src/lib/utils.ts` → `renderer/src/lib/utils.ts`

---

### STEP 7 — Basic Checkout & Auto-Voucher

**Goal:** Complete a takeaway sale end-to-end. Auto-voucher created in ERP accounts.

**How it works:**
1. User clicks "Charge" → `PaymentModal.tsx` opens
2. User selects payment mode + amount → clicks "Complete Sale"
3. Renderer calls `window.electronAPI.checkout(payload)` (IPC)
4. Main process: if online → `POST /api/v1/pos/checkout` directly (same ERP endpoint, unchanged)
5. ERP `POSController::checkout()` runs:
   - Creates `SalesInvoice` (confirmed) + `SalesInvoiceLines`
   - Creates `StockLedger` entries (inventory deduction)
   - Calls `AccountingService::postSalesInvoice()` → auto Dr/Cr voucher
   - Creates `PaymentReceipt` + calls `postReceipt()` → Dr Cash/Bank, Cr Party
6. Main process: if offline → saves to `pending_checkouts` SQLite table; syncs later
7. Renderer: shows success screen with invoice number

**`PaymentModal.tsx`** — copy from `fe/src/pages/pos/POSPaymentModal.tsx`:
- Cash tab: tendered amount + change calculator + quick amounts (₹50, ₹100, ₹200, ₹500)
- UPI tab: reference number input + optional QR display
- Card tab: amount + last 4 digits
- Split tab: multiple payment lines (add row per mode)
- Credit tab: requires registered customer; posts invoice with `post_payment=true`

**Voucher entries auto-created by ERP (no extra code):**
```
Dr: Customer/Walk-in A/c   ₹1,180   (grand_total)
Cr: Sales Account          ₹1,000   (taxable_amount)
Cr: Output CGST (9%)       ₹   90
Cr: Output SGST (9%)       ₹   90
```

**Files to copy from ERP:**
- `fe/src/pages/pos/POSPaymentModal.tsx` → `renderer/src/components/pos/PaymentModal.tsx`
- `fe/src/api/pos.ts` → `renderer/src/api/pos.ts` (adapt axios baseURL to use configurable server URL)

---

### STEP 8 — Invoice & Thermal Printing

**Goal:** Thermal receipt prints automatically after checkout; WhatsApp sharing works.

**Backend (ERP, no changes needed):**
- `GET /api/v1/sales-invoices/{id}/html?template=thermal-custom&paper_size=2inch`
- ERP's `ThermalTemplateRenderer` already renders company name, GST, items table, totals

**Electron print flow:**
1. After checkout success: `window.electronAPI.printReceipt({ invoiceId, paperSize: '80mm' })`
2. Main process `printerIpc.ts`:
   - Fetches invoice HTML from ERP endpoint with Bearer token
   - Uses `node-thermal-printer` to render ESC/POS commands
   - Sends to printer name from `device_config`
3. Fallback: if no thermal printer configured → `mainWindow.webContents.printToPDF()` opens PDF

**`ThermalPrinter.ts`** (main process) — wraps `node-thermal-printer`:
- Restaurant receipt: logo, address, GSTIN, invoice#, date, table, items + GST, grand total, payment mode, "Thank you" footer
- Supports USB, Network (IP:9100), Serial printers
- KOT format (different template): table#, KOT#, time, items + notes only (no prices)

**`PrinterSettings.tsx`** (renderer) — list system printers via `window.electronAPI.getPrinters()`, select billing printer + KOT printer separately, paper width (58mm/80mm), test print button

**WhatsApp share:**
- `GET /api/v1/orders/{id}/invoice/share` (new ERP route) → returns short URL via share_token
- Renderer: `window.open(`whatsapp://send?text=${message}`)` with invoice link

**Files to copy from ERP:**
- `fe/src/pages/pos/POSReprintPanel.tsx` → `renderer/src/components/pos/ReprintPanel.tsx`

---

### STEP 9 — Table Management

**Goal:** Visual floor plan, table selection for dine-in orders, table status tracking.

**Backend (new ERP controllers added in Step 3):**
- `GET /api/v1/floor-plans` — list floor plans with tables
- `GET /api/v1/dining-tables?floor_plan_id=` — tables with current status + order
- `PATCH /api/v1/dining-tables/{id}/status` — update status
- `POST /api/v1/dining-tables/merge` — link two tables to same order
- `POST /api/v1/dining-tables/{id}/transfer` — move order to another table

**Local sync:** `dining_tables` synced DOWN from ERP via sync pull. Status changes synced UP immediately.

**`TableSelection.tsx`** — shown before BillingScreen for dine-in:
- Floor plan tabs at top (Ground Floor, Rooftop, etc.)
- Grid of table cards, color-coded:
  - **Green** = vacant (click to start new order)
  - **Red** = occupied (shows order total + pax) → click to resume
  - **Orange** = reserved
  - **Grey** = cleaning / inactive
- Pax entry dialog when starting new dine-in order

**`TableMap.tsx`** — SVG/CSS grid; tables positioned by `pos_x, pos_y` for custom floor layouts

**`TableCard.tsx`** — single table: name, capacity, current amount, time elapsed (dine-in timer)

**`MergeTableModal.tsx`** — select adjacent tables to merge; lines combined into one bill

**cartStore additions:**
```typescript
setTable(tableId: string, pax: number): void
clearTable(): void
```

When a table is selected → `orderType` set to `dine_in`, `tableId` stored in cart, `DiningTable.status` updated to `'occupied'` on first KOT.

---

### STEP 10 — Order Types & Customer Management

**Goal:** Support dine-in, takeaway, delivery; manage customers for credit sales and loyalty.

**Order type selector** in `BillingScreen.tsx` header:
- Three buttons: 🍽 Dine-in | 🛍 Takeaway | 🛵 Delivery
- Takeaway: no table needed, customer optional
- Dine-in: requires table selection (Step 9)
- Delivery: customer required (name + phone + address)

**Customer bar** — copy from `fe/src/pages/pos/POSCustomerBar.tsx`:
- Search existing customers (ERP parties where `type='customer'`)
- Quick-add: name + phone → `POST /api/v1/pos/quick-party` (existing ERP endpoint)
- Shows balance for credit customers
- Walk-in mode: no customer required for cash sales

**Delivery order extras:**
- Delivery address input field
- Delivery charge line item auto-added to cart
- Estimated delivery time input

**`HoldOrdersPanel.tsx`** — copy from `fe/src/pages/pos/POSHeldBills.tsx`:
- Lists all `pos_held=true` invoices from SQLite (+ server)
- Resume: loads lines back into cart + restores table/customer
- Delete: `DELETE /api/v1/pos/held/{id}`
- Keyboard: `Ctrl+H` to toggle panel

**Files to copy from ERP:**
- `fe/src/pages/pos/POSCustomerBar.tsx` → `renderer/src/components/pos/CustomerBar.tsx`
- `fe/src/pages/pos/POSHeldBills.tsx` → `renderer/src/components/pos/HoldOrdersPanel.tsx`

---

### STEP 11 — KOT System

**Goal:** Send kitchen order tickets; track item-level cooking status.

**How KOT works in Petpooja-style flow:**
1. Waiter adds items to cart for a table
2. Clicks "Send to Kitchen" (not "Charge") → system creates a KOT
3. KOT only contains **new items** since last KOT (incremental)
4. KOT printed on kitchen printer via `KotPrinter.ts`
5. Items marked `kot_status = 'sent'` in `sales_invoice_lines`
6. Waiter can add more items → another "Send to Kitchen" → KOT #2
7. When all items are ready, cashier can "Charge" → `PaymentModal` → checkout

**`KotController::generate()`** (new ERP controller):
```php
// POST /api/v1/orders/{invoiceId}/kot
// 1. Find all lines with kot_status='pending' on this invoice (or create draft invoice first)
// 2. Create KitchenOrderTicket with next KOT number
// 3. Create KotLines for each pending line
// 4. Update SalesInvoiceLines.kot_status = 'sent'
// 5. Increment SalesInvoice.kot_count
// Return KOT with lines
```

**Offline KOT:** If offline, KOT saved to local SQLite `kots` table with `sync_status='pending'`. Printed locally. Synced when back online.

**`BillingScreen.tsx`** changes:
- For dine-in: show "Send to Kitchen" button (primary) + "Charge" button (secondary, only if items were KOT'd)
- For takeaway: show "Charge" directly (KOT still sent but auto-triggered on payment)
- KOT badge on cart showing pending-to-send items count

**`KotPrinter.ts`** (main process) — separate printer from billing printer:
- KOT format: `KOT #003`, Table: T4, Time: 2:30 PM, item list with qty + notes
- No prices on KOT (kitchen doesn't need them)

---

### STEP 12 — Kitchen Display Screen

**Goal:** Real-time kitchen display board showing all active KOTs; kitchen staff marks items done.

**Electron multi-window setup** — in `WindowManager.ts`:
```typescript
const kitchenWin = new BrowserWindow({
  fullscreen: true,
  title: 'Kitchen Display',
  display: screen.getAllDisplays()[1] ?? screen.getPrimaryDisplay()
});
kitchenWin.loadURL(`${rendererUrl}#/kitchen`);
```

**IPC broadcast:** When a KOT is created (main process writes to SQLite), broadcast to kitchen window:
```typescript
// In main process after KOT insert:
kitchenWin?.webContents.send('kot:new', kotData);
// When KOT status updated:
mainWin?.webContents.send('table:status', { tableId, status });
```

**`KitchenDisplay.tsx`** (renderer, `/kitchen` route):
- 3-column kanban board: **New** | **Cooking** | **Ready**
- Each column shows KOT cards sorted by time (oldest first)
- Overdue orders (> 15 min) highlighted red

**`KOTCard.tsx`:**
```
┌─────────────────────┐
│ KOT #003  Table T4  │
│ 14:32  (8 min ago)  │
├─────────────────────┤
│ ☐ 2× Margherita     │
│ ☐ 1× Garlic Bread  │
│   "extra crispy"    │
└─────────────────────┘
```
- Kitchen staff taps item → marks cooking
- Taps again → marks ready
- "All Ready" button → moves whole KOT to Ready column
- Auto-mark table as "Ready to Serve" on main window via IPC

**Kitchen window runs fully offline** — reads same local SQLite. If Electron is on a single machine, IPC works without network.

**`KitchenBoard.tsx`** — fully keyboard-navigable for kitchens without touchscreen

---

### STEP 13 — Inventory & Recipe Management

**Goal:** Recipe-based ingredient deduction when orders are paid. Stock tracked in ERP's existing StockLedger.

**Backend (new ERP controllers from Step 3):**
- `GET /api/v1/recipes?item_id=` — get recipe for a menu item
- `POST /api/v1/recipes` — create recipe (menu item → ingredients list)
- `PUT /api/v1/recipes/{id}`

**`InventoryService::deductForOrder(salesInvoice)`** (new ERP service method):
```php
// Called from POSController::checkout() after invoice creation (inside DB transaction)
foreach ($invoice->lines as $line) {
    $recipe = Recipe::where('item_id', $line->item_id)->with('ingredients')->first();
    if (!$recipe) continue;  // no recipe = no deduction
    foreach ($recipe->ingredients as $ing) {
        $qty = $ing->quantity * $line->quantity;
        StockLedger::create([
            'item_id'        => $ing->item_id,
            'godown_id'      => $invoice->godown_id,
            'type'           => 'sale',
            'quantity'       => -$qty,
            'reference_type' => 'sales_invoice',
            'reference_id'   => $invoice->id,
        ]);
        // Update item current_stock
        $ing->item->decrement('current_stock', $qty);
    }
}
```

**`RecipeManager.tsx`** (renderer settings page):
- List menu items with recipe status (configured / not configured)
- Click item → recipe editor: add ingredient rows (item name, quantity, unit)
- "Test Deduction" button — shows what stock would be consumed for 1 unit

**Wastage tracking:**
- `WastageEntry.tsx` — select ingredient, quantity, reason (spoilage/dropped/expired)
- Creates ERP `StockLedger` entry with type='wastage'

**Stock alerts** — items below `min_stock_level` shown as orange badge in settings sidebar

---

### STEP 14 — Reports & Day Close

**Goal:** Manager reports — daily sales, payment breakdown, item performance, GST summary.

**Backend: reuse existing ERP report endpoints** (no new endpoints needed for basic reports):
- `GET /api/v1/reports/sales-summary?date_from=&date_to=` — if not exists, add to `ReportController.php`
- GST totals, payment mode breakdown (group by `pos_payment_mode`)
- Item-wise: join `sales_invoice_lines` with `items`

**New ERP routes (add to ReportController):**
```php
Route::get('reports/pos-summary', [ReportController::class, 'posSummary']);
Route::get('reports/payment-modes', [ReportController::class, 'paymentModes']);
Route::get('reports/item-wise', [ReportController::class, 'itemWise']);
Route::get('reports/day-close', [ReportController::class, 'dayClose']);
Route::get('reports/kot-performance', [ReportController::class, 'kotPerformance']);
```

**`SalesSummary.tsx`** (renderer):
- Date range picker (default: today)
- KPIs: total orders, total revenue, avg order value
- Bar chart: hourly sales (recharts — same lib as ERP)
- Payment mode pie chart: cash vs UPI vs card vs credit

**`DayClose.tsx`** (renderer):
- Cash register reconciliation: expected cash (opening + cash sales) vs actual (cashier counts)
- Discrepancy amount with notes
- "Close Day" button → creates a `Voucher` (type='journal') in ERP for petty cash adjustment if needed
- Prints shift summary to thermal printer

**`GSTReport.tsx`** (renderer):
- GSTR-1 style summary: HSN-wise, rate-wise (5%, 12%, 18%)
- Taxable + CGST + SGST + IGST columns
- CSV export button

**`KOTPerformance.tsx`** (renderer):
- Average prep time per item
- Items frequently delayed (useful for kitchen training)

---

### STEP 15 — Polish, Settings & Packaging

**Goal:** Production-ready installable app with auto-update.

**`OutletSettings.tsx`** — map POS device to a branch/godown in ERP:
- Select company branch (from ERP `branches` API)
- Select default godown for stock deductions
- GST mode: composition (5% flat) or regular (item-wise)
- Inter-state flag (auto-set from customer GSTIN vs company state)
- Outlet name (shown on receipts)

**`DeviceInfo.tsx`** — sync status dashboard:
- Last synced at timestamp
- Pending records count
- Manual "Sync Now" button → triggers `syncIpc` immediately
- Server URL change + test connection

**Keyboard shortcuts** (global `keydown` listener):
| Key | Action |
|---|---|
| `F2` | Focus item search |
| `F4` | Toggle order type |
| `F8` | Hold bill |
| `F10` | Open payment modal |
| `Ctrl+K` | Send to kitchen (KOT) |
| `Ctrl+T` | Select table |
| `Ctrl+H` | Held bills panel |
| `Esc` | Close modal / clear search |

**`electron-builder.yml`** packaging:
```yaml
appId: com.zazzy.pos
productName: Zazzy POS
win:
  target: nsis          # Windows installer
mac:
  target: dmg
linux:
  target: AppImage
publish:
  provider: github      # auto-update from GitHub releases
```

**Auto-update** via `electron-updater`:
- Checks for update on app start
- Downloads in background, shows "Update Ready" banner
- Installs on next restart

**Offline banner** `OfflineBanner.tsx` — persistent strip at top when no network:
```
⚠ Offline mode — sales are saved locally and will sync when connected
```

---

## Files Summary: Copy vs New

| File | Action | Source |
|---|---|---|
| `renderer/src/api/client.ts` | Copy + adapt | `fe/src/lib/axios.ts` |
| `renderer/src/api/pos.ts` | Copy + extend | `fe/src/api/pos.ts` |
| `renderer/src/store/authStore.ts` | Copy + add deviceId | `fe/src/store/authStore.ts` |
| `renderer/src/types/index.ts` | Copy + extend | `fe/src/types/index.ts` |
| `renderer/src/lib/utils.ts` | Copy verbatim | `fe/src/lib/utils.ts` |
| `renderer/src/components/pos/Cart.tsx` | Copy + adapt | `fe/src/pages/pos/POSCart.tsx` |
| `renderer/src/components/pos/PaymentModal.tsx` | Copy + adapt | `fe/src/pages/pos/POSPaymentModal.tsx` |
| `renderer/src/components/pos/ItemSearch.tsx` | Copy + IPC adapt | `fe/src/pages/pos/POSItemSearch.tsx` |
| `renderer/src/components/pos/CustomerBar.tsx` | Copy + adapt | `fe/src/pages/pos/POSCustomerBar.tsx` |
| `renderer/src/components/pos/HoldOrdersPanel.tsx` | Copy + adapt | `fe/src/pages/pos/POSHeldBills.tsx` |
| `renderer/src/components/pos/ReprintPanel.tsx` | Copy + adapt | `fe/src/pages/pos/POSReprintPanel.tsx` |
| `api/app/Traits/HasUuid.php` | Copy verbatim (new models) | `api/app/Traits/HasUuid.php` |
| `api/app/Traits/HasSyncColumns.php` | Copy verbatim | `api/app/Traits/HasSyncColumns.php` |
| `api/app/Services/AccountingService.php` | No changes — called as-is | — |
| `api/app/Services/ThermalTemplateRenderer.php` | No changes — called via existing endpoint | — |

---

## Accounting Voucher Flow (Unchanged from ERP)

When `POST /api/v1/pos/checkout` is called, `AccountingService::postSalesInvoice()` auto-creates:

```
SALES VOUCHER (auto-created)
─────────────────────────────────────────────────
Dr  Customer / Walk-in A/c     ₹1,180.00   (grand_total)
Cr  Sales Account              ₹1,000.00   (taxable_amount)
Cr  Output CGST 9%             ₹   90.00
Cr  Output SGST 9%             ₹   90.00
─────────────────────────────────────────────────

RECEIPT VOUCHER (auto-created per payment)
─────────────────────────────────────────────────
Dr  Cash-in-Hand               ₹1,180.00
Cr  Customer / Walk-in A/c     ₹1,180.00
─────────────────────────────────────────────────
```

For credit sales (`post_payment=true`): only Sales Voucher created, no Receipt. Balance tracked in party ledger.

---

## Dependencies

### `electron-app/package.json`
```json
{
  "main process": {
    "better-sqlite3": "^9.4",
    "electron-store": "^10",
    "node-thermal-printer": "^4.3",
    "electron-updater": "^6.3"
  },
  "renderer": {
    "react": "^19",
    "react-router-dom": "^7",
    "@tanstack/react-query": "^5",
    "zustand": "^5",
    "react-hook-form": "^7",
    "zod": "^4",
    "axios": "^1.6",
    "lucide-react": "latest",
    "react-hot-toast": "^2.4",
    "recharts": "^2.12",
    "qrcode.react": "^4",
    "tailwind-merge": "^3",
    "clsx": "^2"
  },
  "devDependencies": {
    "electron": "^32",
    "electron-vite": "^2.3",
    "electron-builder": "^25",
    "@electron-toolkit/preload": "^3",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4"
  }
}
```

### `api/composer.json` additions (to existing ERP)
```
No new packages needed — all existing packages support the new features
```

---

## Step Completion Checklist

- [ ] **Step 1** — Electron window opens, pings ERP `/api/health`
- [ ] **Step 2** — Login works, device registered, token persists across restarts
- [ ] **Step 3** — New DB tables created in ERP MySQL (floor_plans, dining_tables, kots, recipes)
- [ ] **Step 4** — Local SQLite schema created, sync engine pulls items from ERP
- [ ] **Step 5** — Items visible in POS screen from local SQLite, barcode search works
- [ ] **Step 6** — Cart with correct GST split (CGST/SGST), discount, round-off
- [ ] **Step 7** — Full takeaway sale: pay cash → ERP creates SalesInvoice + Voucher ✓
- [ ] **Step 8** — Thermal receipt prints; PDF fallback; WhatsApp share
- [ ] **Step 9** — Floor plan visible; selecting table sets cart to dine-in mode
- [ ] **Step 10** — Takeaway/delivery/dine-in toggle; customer quick-add; hold/resume bills
- [ ] **Step 11** — "Send to Kitchen" creates KOT; kitchen printer fires
- [ ] **Step 12** — Kitchen display window shows KOT board; items marked done via IPC
- [ ] **Step 13** — Recipe configured; placing order deducts stock via ERP StockLedger
- [ ] **Step 14** — Day-close report; GST summary; payment mode breakdown
- [ ] **Step 15** — Windows installer built via electron-builder; auto-update working
