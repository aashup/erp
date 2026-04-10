# Implementation Plan: Voucher Sequential Numbering via Company Settings

## Context
Currently, the voucher numbering system uses a simple counter-based approach: `count(vouchers of that type) + 1`. This approach has issues across multiple devices/sessions and doesn't persist a dedicated sequence number. The goal is to implement a persistent, company-specific voucher index system using the `company_settings` table, where each voucher type (contra, payment, receipt, journal, purchase, sales) has its own counter that increments when a voucher is created.

**Desired behavior:**
- Each company stores a `vouchers_index` JSON setting with 6 keys: `contra`, `payment`, `receipt`, `journal`, `purchase`, `sales`
- Each key starts at value `1`
- When a voucher is created, the corresponding counter is incremented and used as the numeric part of the voucher_number
- Format remains: `PREFIX-00001` (where prefix is PUR, SAL, PAY, REC, JOU, CON)

---

## Implementation Steps

### Phase 1: Database & Model Layer

#### 1.1 Update CompanySetting Model
**File:** `/Users/aashu/erp/api/app/Models/CompanySetting.php`

Add a new constant for the voucher index key and helper methods:
```php
public const VOUCHERS_INDEX_KEY = 'vouchers_index';

public const DEFAULT_VOUCHERS_INDEX = [
    'contra' => 1,
    'payment' => 1,
    'receipt' => 1,
    'journal' => 1,
    'purchase' => 1,
    'sales' => 1,
];

/**
 * Get the current voucher index for a company and voucher type
 * @param string $voucherType (contra, payment, receipt, journal, purchase, sales)
 * @return int
 */
public static function getVoucherIndex($companyId, $voucherType): int

/**
 * Increment and return the next voucher number for a type
 * @return int
 */
public static function getAndIncrementVoucherIndex($companyId, $voucherType): int
```

#### 1.2 Seeder for Initialization
**File:** New or update existing company seeder
- When creating a company, automatically set `company_settings` with key `vouchers_index` and value = `json_encode(DEFAULT_VOUCHERS_INDEX)`

---

### Phase 2: Backend Logic Updates

#### 2.1 Add Dynamic Prefix Method to Voucher Model
**File:** `/Users/aashu/erp/api/app/Models/Voucher.php`

Add a method to map voucher types to their prefixes:
```php
/**
 * Get the prefix for a voucher type
 * @param string $voucherType (contra, payment, receipt, journal, purchase, sales)
 * @return string (e.g., 'PUR', 'SAL', 'PAY', etc.)
 */
public static function getTypePrefix($voucherType): string {
    return match($voucherType) {
        'purchase' => 'PUR',
        'sales' => 'SAL',
        'payment' => 'PAY',
        'receipt' => 'REC',
        'journal' => 'JOU',
        'contra' => 'CON',
        default => 'VOC',
    };
}
```

This method centralizes prefix logic, making it easy to customize prefixes from one location.

#### 2.2 Update VoucherController
**File:** `/Users/aashu/erp/api/app/Http/Controllers/Api/V1/VoucherController.php`

In the `store()` method (lines 47-97):
- Replace the current auto-numbering logic (lines 73-79) with call to `CompanySetting::getAndIncrementVoucherIndex()`
- Instead of: `count + 1`, use: retrieve the next number from settings and increment
- Use `Voucher::getTypePrefix()` to get the dynamic prefix

**Pseudocode:**
```php
$voucherType = $validated['voucher_type']; // e.g., 'purchase'
$nextNumber = CompanySetting::getAndIncrementVoucherIndex($this->company->id, $voucherType);
$prefix = Voucher::getTypePrefix($voucherType);
$voucher_number = "{$prefix}-" . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
```

#### 2.3 Update AccountingService
**File:** `/Users/aashu/erp/api/app/Services/AccountingService.php`

In `generateVoucherNumber()` method (lines 391-404):
- Replace current logic with same approach as VoucherController
- Use `Voucher::getTypePrefix()` for consistent prefix resolution
- Use `CompanySetting::getAndIncrementVoucherIndex()` 

**Note:** This ensures consistency between manual and auto-posted vouchers, with prefixes managed centrally.

---

### Phase 3: Testing & Verification

#### 3.1 Backend Testing
- Create test company via seeder
- Verify `company_settings` contains `vouchers_index` with default values
- Create vouchers via API:
  - POST `/api/v1/vouchers` with type 'purchase' → voucher_number should be "PUR-00001"
  - Create another purchase voucher → should be "PUR-00002"
  - Create a sales voucher → should be "SAL-00001"
  - Verify settings counter incremented: `CompanySetting::where('key', 'vouchers_index')->first()->value`
- Create auto-posted voucher (simulate payment receipt) → should use next number from settings

#### 3.2 Frontend Testing (if needed)
- Navigate to `/accounting/vouchers/new`
- Create vouchers via VouchersEntry form
- Verify assigned voucher numbers match backend counter
- Check that multiple rapid submissions don't cause duplicate numbers (test concurrency)

---

## Files to Create/Modify

### Modify:
1. `/Users/aashu/erp/api/app/Models/CompanySetting.php` — Add constants, helper methods
2. `/Users/aashu/erp/api/app/Models/Voucher.php` — Add getTypePrefix() method
3. `/Users/aashu/erp/api/app/Http/Controllers/Api/V1/VoucherController.php` — Update store() logic
4. `/Users/aashu/erp/api/app/Services/AccountingService.php` — Update generateVoucherNumber() logic
5. Company seeder (if exists) or `/Users/aashu/erp/api/database/seeders/` — Initialize vouchers_index on creation

### No changes needed:
- Frontend (VouchersEntry.tsx, form pages) — auto-numbering is now backend-driven
- Database schema (company_settings already supports JSON values)
- Voucher model or table structure

---

## Key Design Decisions

1. **CompanySetting as source of truth** — The `vouchers_index` JSON is the single source of authority for the next sequential number. No fallback to counting.

2. **Type-based counters** — Each of the 6 types has its own counter, allowing independent sequences (e.g., purchase can be at 100 while sales is at 5).

3. **Atomic increment** — Use database-level locking (via transaction or similar) when incrementing to prevent race conditions across simultaneous requests.

4. **Backward compatible format** — Voucher_number format unchanged; existing code parsing "PUR-00001" will still work.

5. **Fresh start for existing data** — Existing vouchers keep their current numbers; new vouchers start from 1 for each type. No retroactive renumbering.

---

## Success Criteria

✅ New company created with `vouchers_index` setting initialized  
✅ Manual voucher creation via API increments and uses setting counter  
✅ Auto-posted vouchers (from invoice confirmation) use same counter  
✅ Each voucher type has independent counter  
✅ Voucher_number format matches pattern: `PREFIX-NNNNN` (e.g., "PUR-00001")  
✅ No duplicate voucher numbers within a company  
✅ Existing vouchers unaffected; new numbering applies going forward  
