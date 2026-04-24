# API Backend Structure (Laravel 11)

## Directory Layout

```
api/
├── app/
│   ├── Http/Controllers/Api/V1/   # All API controllers
│   ├── Models/                     # Eloquent models (27+)
│   ├── Observers/                  # PartyObserver, CompanyObserver
│   ├── Policies/                   # Authorization (17 policies)
│   ├── Services/                   # AccountingService, InvoicePdfService
│   ├── Traits/                     # HasUuid, HasSyncColumns, BelongsToCompany, FiltersByFinancialYear
│   └── Helpers/
├── database/
│   ├── migrations/                 # Ordered by dependency (31 files)
│   └── seeders/
└── routes/api.php                  # All routes under /api/v1
```

## Key Traits (used by all models)

- **HasUuid** — auto UUID on create, sets incrementing=false, keyType='string'
- **HasSyncColumns** — adds sync_status/device_id/synced_at to fillable; scopes: pending(), synced(), conflicts()
- **BelongsToCompany** — auto-sets company_id from auth user on creating; global scope filters by company
- **FiltersByFinancialYear** — controller utility to apply FY date filters

## Accounting Architecture

### Groups vs Ledgers vs Vouchers
- **AccountingGroup** (`accounting_groups`) = Hierarchical classification only (folders). Has parent_id self-reference, system_key for well-known groups (sundry_debtors, sundry_creditors, bank_account, cash_account, etc.)
- **Ledger** (`ledgers`) = Individual accounts under groups. Has group_id FK to accounting_groups, system_key for well-known ledgers (cash, input_cgst, output_cgst, sales_account, purchase_account, etc.), polymorphic ledgerable for linking to Party.
- **VoucherLine** (`voucher_lines`) = Transaction lines referencing ledger_id (FK to ledgers).
- **Voucher** (`vouchers`) = Transaction header. Types: purchase, sales, payment, receipt, journal, contra. Append-only (no delete, only reversals).

### System Keys
Groups: sundry_debtors, sundry_creditors, cash_account, bank_account, sales_account, purchase_account, input_cgst/sgst/igst, output_cgst/sgst/igst
Ledgers: cash, input_cgst, input_sgst, input_igst, output_cgst, output_sgst, output_igst, sales_account, purchase_account, capital_account, stock

### Party → Ledger Auto-Creation (PartyObserver)
- type='customer' → 1 Ledger under Sundry Debtors → party.debtor_ledger_id
- type='vendor' → 1 Ledger under Sundry Creditors → party.creditor_ledger_id
- type='both' → 2 Ledgers: "{name} (Buyer)" under Sundry Debtors + "{name} (Vendor)" under Sundry Creditors

### AccountingService
- `postSalesInvoice()` — Dr: party debtor_ledger, Cr: sales + GST output ledgers
- `postPurchaseInvoice()` — Dr: purchase + GST input ledgers, Cr: party creditor_ledger
- `postPayment()` — Dr: party creditor_ledger, Cr: cash/bank ledger
- `postReceipt()` — Dr: cash/bank ledger, Cr: party debtor_ledger
- `postPayroll(PayrollRun $run, string $userId)` — Dr: Salary Expense (gross + employer PF + ESI), Cr: Salary Payable (net + TDS), PF Payable (employee + employer), ESI Payable (employee + employer), PT Payable
- Uses `Ledger::findBySystemKey()` for system accounts

### Payroll System Keys (added to DefaultGroupsService)
Ledgers: `salary_expense` (Direct Expenses, code 5100), `salary_payable` (Current Liabilities), `pf_payable` (Duties & Taxes), `esi_payable` (Duties & Taxes), `pt_payable` (Duties & Taxes)

### Voucher Types
Types: purchase, sales, payment, receipt, journal, contra, **payroll** (prefix: `PRL`)

## API Routes (all under /api/v1, auth:sanctum)

| Resource | Controller | Notes |
|----------|-----------|-------|
| POST /register, /login | AuthController | Public |
| apiResource parties | PartyController | Full CRUD |
| apiResource items | ItemController | Full CRUD |
| apiResource branches | BranchController | Full CRUD |
| apiResource godowns | GodownController | Full CRUD |
| apiResource purchase-orders | PurchaseOrderController | + PATCH status |
| apiResource purchase-invoices | PurchaseInvoiceController | |
| apiResource sales-orders | SalesOrderController | + PATCH status |
| apiResource sales-invoices | SalesInvoiceController | + PDF/HTML, PATCH status |
| apiResource accounting-groups | AccountingGroupController | + POST load-defaults |
| apiResource ledgers | LedgerController | Full CRUD |
| apiResource vouchers | VoucherController | Create/Read only (append-only) |
| apiResource payment-receipts | PaymentReceiptController | Create/Read/Delete |
| apiResource financial-years | FinancialYearController | + PATCH set-current |
| GET reports/* | ReportController | trial-balance, profit-and-loss, party-ledger |
| apiResource departments | DepartmentController | Full CRUD |
| apiResource designations | DesignationController | Full CRUD |
| apiResource employees | EmployeeController | CRUD + GET salary-structure, POST salary-structure |
| apiResource salary-structures | SalaryStructureController | show/update/destroy only |
| GET/POST/DELETE/PATCH payroll-runs | PayrollController | generate, show, destroy, approve, mark-paid, payslip |

## Controller Pattern
- Extends base Controller (AuthorizesRequests, ValidatesRequests)
- Uses `$this->authorize()` for policy-based auth
- Validation inline in controller methods
- Returns JSON: `response()->json(['data' => $resource])` or paginated collection

## Migration Order (key tables)
1. companies → 2. users → 3. branches → 4. financial_years → 5. accounting_groups → 6. ledgers → 7. parties → 8. items → 9. batches → 10. godowns → 11. stock_ledger → 12-16. purchase_* → 17-21. sales_* → 22. payment_receipts → 23. vouchers + voucher_lines → 24. payroll tables (in `2026_04_11_create_document_counters_table.php`)

## Important Design Rules
- UUID primary keys everywhere
- Stock ledger & vouchers are append-only (no soft deletes, no edits)
- Double-entry accounting: every voucher must balance (total debit = total credit)
- All tables have sync columns for offline-first mobile support
- `loadDefaults()` is one-time operation tracked in CompanySetting

## Roles & Permissions — UUID Primary Keys

The `permissions` and `roles` tables use **`uuid` as PRIMARY KEY** — no integer `id` column.
- Defined in `2026_03_23_171617_create_permission_tables.php`
- Both `App\Models\Permission` and `App\Models\Role` extend Spatie models with `$primaryKey = 'uuid'` + `HasUuid` trait
- Route model binding resolves by UUID value
- API validation: `'permissions.*' => 'exists:permissions,uuid'` — expects flat array of UUID strings
- `Permission::whereIn('uuid', $uuids)->get()` to load permissions by UUID
- JSON response includes `uuid` field (NOT `id`) — frontend must use `perm.uuid` / `role.uuid`

**Auth response** includes `permissions: string[]` (flat array of permission names like `'inventory.view'`):
- Returned in `login`, `register`, and `me` responses
- Stored in `user.permissions` in Zustand auth store
- Used by `usePermissions()` hook for menu filtering

### ⚠️ Critical: Spatie Permission Methods

Always use `getAllPermissions()` when returning user permissions — NOT `getPermissionNames()`.

```php
// ✅ CORRECT — includes permissions assigned via the user's ROLE
$user->getAllPermissions()->pluck('name')->toArray()

// ❌ WRONG — returns DIRECT permissions only (empty for role-based users like salesman)
$user->getPermissionNames()->toArray()
```

**Why:** `UserSeeder` assigns permissions to *roles* (e.g. `$salesman->syncPermissions(...)`), not directly to users. `getPermissionNames()` only returns direct permissions → returns `[]` for all role-based users → frontend shows no menu items (or shows all via fallback).

`getAllPermissions()` = direct permissions + permissions via roles (what you always want).
