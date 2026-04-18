# POS Module — Implementation Plan

## Schema (existing migration only)
File: `api/database/migrations/2026_03_24_000016_create_sales_invoices_table.php`
Add to `sales_invoices`:
- `pos_held` boolean default false
- `pos_payment_mode` varchar(20) nullable
- `amount_tendered` decimal(15,2) default 0
- `change_amount` decimal(15,2) default 0

## Backend
### New: `api/app/Http/Controllers/Api/V1/POSController.php`
- `GET  /pos/items`          — search items by name/SKU with current stock
- `POST /pos/checkout`       — atomic: confirmed invoice + payment receipts + journal
- `POST /pos/hold`           — save cart as draft (pos_held=true)
- `GET  /pos/held`           — list held bills
- `DELETE /pos/held/{id}`    — delete held bill
- `POST /pos/quick-party`    — create customer (name + phone only)

Modify: `api/routes/api.php` — add POS route group

### Checkout logic (DB::transaction)
1. Create SalesInvoice (confirmed)
2. Create SalesInvoiceLines + StockLedger entries
3. AccountingService::postSalesInvoice()
4. Create PaymentReceipt per payment (cash ledger or bank ledger — only these two)

## Frontend
### New files
- `fe/src/pages/pos/POSPage.tsx`         — main layout + state
- `fe/src/pages/pos/POSItemSearch.tsx`   — left panel (search + product grid)
- `fe/src/pages/pos/POSCart.tsx`         — right panel (cart lines + totals)
- `fe/src/pages/pos/POSPaymentModal.tsx` — checkout modal (Cash/UPI/Card/Split)
- `fe/src/pages/pos/POSCustomerBar.tsx`  — top customer strip
- `fe/src/pages/pos/POSHeldBills.tsx`    — held bills drawer
- `fe/src/api/pos.ts`                    — POS API client

### Modified files
- `fe/src/App.tsx`                       — `/pos` route outside AppLayout
- `fe/src/components/layout/Header.tsx`  — ShoppingCart icon → navigates to /pos
- `fe/src/config/menuConfig.ts`          — POS entry in sidebar

## Key Behaviours
- Full-screen, no ERP shell (no header/sidebar/footer)
- Ctrl+X exits to dashboard
- F2 focuses search, Ctrl+H holds bill, Ctrl+Enter opens payment
- Barcode scan: ≥6 chars in <100ms → SKU lookup + beep sound
- Negative stock: confirmation dialog "only X in stock — sell anyway?"
- Accounting: only Cash ledger (system_key=cash) + Bank (system_key=bank_account)
- Hold bill = draft invoice (pos_held=true)
- Split payment = multiple PaymentReceipts
- Print receipt via existing thermal template HTML endpoint
- Offline indicator via useOnlineStatus()
