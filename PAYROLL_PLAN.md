# Plan: Add Payroll Module

## Context
The ERP currently covers Inventory, Purchase, Sales, Accounting, and POS. This plan adds a complete Indian Payroll module — Employee master, Salary Structures, monthly Payroll Runs (attendance-based pro-rata), PF/ESI/PT deductions, auto double-entry journal posting on approval, and PDF payslips.

---

## Scope
- Full Indian payroll: Basic, HRA, DA, Conveyance, Special Allowance
- Deductions: PF Employee (12% Basic), ESI Employee (0.75% Gross if Gross ≤ ₹21,000), Professional Tax (fixed per structure), TDS (manual override)
- Employer contributions: PF Employer (13% Basic), ESI Employer (3.25% Gross)
- Attendance-based pro-rata: `(present_days / working_days) × component`
- Auto journal posting on approval
- PDF payslip per employee via DomPDF

---

## Database

Add all payroll table definitions at the end of `api/database/migrations/2026_04_11_create_document_counters_table.php` (last migration file).

### Tables:

```sql
-- departments
id UUID PK, company_id FK, name, is_active bool DEFAULT true, timestamps, soft_deletes

-- designations  
id UUID PK, company_id FK, department_id FK nullable, name, is_active bool, timestamps, soft_deletes

-- employees
id UUID PK, company_id FK, employee_code VARCHAR, name, gender ENUM(male,female,other),
date_of_birth DATE nullable, phone, email nullable, address TEXT nullable, city, state,
department_id FK nullable, designation_id FK nullable,
joining_date DATE, employment_type ENUM(permanent,contract,part_time),
bank_account_name nullable, bank_account_no nullable, bank_ifsc nullable, bank_name nullable,
pan nullable, pf_number nullable, esi_number nullable,
is_pf_applicable bool DEFAULT true, is_esi_applicable bool DEFAULT true,
is_active bool DEFAULT true, + sync_columns, timestamps, soft_deletes

-- salary_structures
id UUID PK, company_id FK, employee_id FK,
effective_from DATE,
basic DECIMAL(12,2), hra DECIMAL(12,2), da DECIMAL(12,2) DEFAULT 0,
conveyance DECIMAL(12,2) DEFAULT 0, medical DECIMAL(12,2) DEFAULT 0,
special_allowance DECIMAL(12,2) DEFAULT 0,
professional_tax DECIMAL(8,2) DEFAULT 0,
tds_amount DECIMAL(8,2) DEFAULT 0,
is_active bool DEFAULT true, + sync_columns, timestamps

-- payroll_runs
id UUID PK, company_id FK, month TINYINT(2), year SMALLINT,
working_days TINYINT DEFAULT 26,
status ENUM(draft,approved,paid) DEFAULT draft,
total_gross DECIMAL(14,2) DEFAULT 0, total_deductions DECIMAL(14,2) DEFAULT 0,
total_net DECIMAL(14,2) DEFAULT 0,
total_pf_employer DECIMAL(12,2) DEFAULT 0, total_esi_employer DECIMAL(12,2) DEFAULT 0,
notes TEXT nullable, voucher_id UUID FK nullable,
approved_at TIMESTAMP nullable, approved_by UUID FK nullable,
+ sync_columns, timestamps, soft_deletes
UNIQUE(company_id, month, year)

-- payroll_entries
id UUID PK, payroll_run_id FK, employee_id FK,
present_days TINYINT DEFAULT 0,
basic DECIMAL(12,2), hra DECIMAL(12,2), da DECIMAL(12,2),
conveyance DECIMAL(12,2), medical DECIMAL(12,2), special_allowance DECIMAL(12,2),
gross_salary DECIMAL(14,2),
pf_employee DECIMAL(10,2), esi_employee DECIMAL(10,2),
professional_tax DECIMAL(8,2), tds DECIMAL(10,2),
total_deductions DECIMAL(14,2), net_salary DECIMAL(14,2),
pf_employer DECIMAL(10,2), esi_employer DECIMAL(10,2),
+ sync_columns, timestamps
```

---

## Backend Files

### Models (`api/app/Models/`)
- `Department.php`, `Designation.php`, `Employee.php`, `SalaryStructure.php`, `PayrollRun.php`, `PayrollEntry.php`
- All use: `HasUuid`, `BelongsToCompany`, `HasSyncColumns`, `SoftDeletes`

### Controllers (`api/app/Http/Controllers/Api/V1/`)
1. `DepartmentController.php` — standard CRUD
2. `DesignationController.php` — standard CRUD
3. `EmployeeController.php` — CRUD + `salaryStructure()` method
4. `SalaryStructureController.php` — CRUD scoped to employee
5. `PayrollController.php` — generate, show, approve, markPaid, destroy, payslip(PDF)

### Policies
- `EmployeePolicy.php` — permissions: `payroll.view`, `payroll.create`, `payroll.edit`, `payroll.delete`
- `PayrollPolicy.php` — same

### Service: `PayrollService.php`
```
generate(company_id, month, year, working_days):
  - Fetch active employees → find active salary_structure
  - Pro-rata: value × (present_days / working_days)  [present_days defaults to working_days in draft]
  - Compute:
      gross = basic + hra + da + conveyance + medical + special_allowance
      pf_employee  = is_pf_applicable ? basic × 0.12 : 0
      esi_employee = (is_esi_applicable && gross ≤ 21000) ? gross × 0.0075 : 0
      pf_employer  = is_pf_applicable ? basic × 0.13 : 0
      esi_employer = (is_esi_applicable && gross ≤ 21000) ? gross × 0.0325 : 0
      total_deductions = pf_employee + esi_employee + pt + tds
      net_salary = gross - total_deductions
  - Create PayrollRun (draft) + PayrollEntries

postJournal(payroll_run):
  Dr: Salary Expense = total_gross + total_pf_employer + total_esi_employer
  Cr: Salary Payable = total_net
  Cr: PF Payable     = total_pf_employee + total_pf_employer
  Cr: ESI Payable    = total_esi_employee + total_esi_employer
  Cr: PT Payable     = sum of professional_tax
  Cr: TDS Payable    = sum of tds
```

### Update `DefaultGroupsService.php`
Add system-key ledgers:
- `salary_expense` → Direct Expenses
- `salary_payable`, `pf_payable`, `esi_payable`, `pt_payable` → Current Liabilities

### Update `AccountingService.php`
Add `postPayroll(PayrollRun $run, int $userId)` method.

### Payslip PDF
- `api/resources/views/payroll/payslip.blade.php` — company header, employee info, earnings table, deductions table, net salary in words

### Routes (`api/routes/api.php`)
```php
Route::apiResource('departments', DepartmentController::class);
Route::apiResource('designations', DesignationController::class);
Route::apiResource('employees', EmployeeController::class);
Route::get('employees/{employee}/salary-structure', [EmployeeController::class, 'salaryStructure']);
Route::post('employees/{employee}/salary-structure', [SalaryStructureController::class, 'storeForEmployee']);
Route::apiResource('salary-structures', SalaryStructureController::class)->only(['show','update','destroy']);
Route::get('payroll-runs', [PayrollController::class, 'index']);
Route::post('payroll-runs/generate', [PayrollController::class, 'generate']);
Route::get('payroll-runs/{payrollRun}', [PayrollController::class, 'show']);
Route::delete('payroll-runs/{payrollRun}', [PayrollController::class, 'destroy']);
Route::patch('payroll-runs/{payrollRun}/approve', [PayrollController::class, 'approve']);
Route::patch('payroll-runs/{payrollRun}/mark-paid', [PayrollController::class, 'markPaid']);
Route::get('payroll-runs/{payrollRun}/payslip/{employee}', [PayrollController::class, 'payslip']);
```

---

## Frontend Files

### `fe/src/api/payroll.ts`
Exports: `departmentsApi`, `designationsApi`, `employeesApi`, `salaryStructuresApi`, `payrollApi`

### Pages (`fe/src/pages/payroll/`)
1. `Departments.tsx` — simple list + inline modal
2. `Employees.tsx` — list (code, name, dept, designation, PF/ESI badges) + create/edit modal + link to salary structure
3. `SalaryStructureModal.tsx` — modal for salary structure form
4. `PayrollRuns.tsx` — list with month/year, status badge, total net
5. `PayrollRunDetail.tsx` — entries table, editable present_days (draft only), Approve / Mark Paid / Download Payslips

### `fe/src/config/menuConfig.ts`
Add Payroll section (after Accounting):
```
Payroll (payroll.view)
  ├── Employees      /payroll/employees
  ├── Departments    /payroll/departments
  └── Payroll Runs   /payroll/runs
```

### `fe/src/App.tsx`
Add 4 routes: `/payroll/employees`, `/payroll/departments`, `/payroll/runs`, `/payroll/runs/:id`

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `api/database/migrations/2026_04_11_create_document_counters_table.php` | Add 5 payroll tables |
| `api/routes/api.php` | Add payroll routes |
| `api/app/Services/DefaultGroupsService.php` | Add 5 system-key ledgers |
| `api/app/Services/AccountingService.php` | Add `postPayroll()` |
| `fe/src/config/menuConfig.ts` | Add Payroll menu section |
| `fe/src/App.tsx` | Add 4 routes |

---

## Implementation Order

1. Migration → `migrate:fresh --seed`
2. Models + Traits
3. Policies (register in AuthServiceProvider)
4. DefaultGroupsService + AccountingService updates
5. PayrollService
6. Controllers + Routes
7. Payslip Blade template
8. Frontend API service
9. Frontend pages
10. Menu + Routes

---

## Verification

1. `php artisan migrate:fresh --seed` — tables created, ledgers seeded
2. Create Department → Designation → Employee → Salary Structure
3. Generate payroll run for current month
4. Edit present_days, verify pro-rata
5. Approve → verify voucher posted with correct Dr/Cr
6. Download payslip PDF
7. Trial Balance — Salary Expense Dr matches total_net
