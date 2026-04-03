# Multi-Unit Support with Conversion Factors

## Context

Items currently have a single `unit` string (e.g., "PCS", "KG"). In real Indian SME ERPs (Tally/Marg), items can be bought and sold in different units — e.g., medicine bought in Boxes (1 Box = 10 Strips), rice sold in Bags (1 Bag = 25 KG). We need to add alternate units with conversion factors per item, allow unit selection on invoice/order lines, and auto-convert to base unit for stock tracking.

**Key principle**: Stock ledger always stores quantities in the **base unit**. Invoice lines store the **transaction unit** (what the user sees). Accounting amounts are unaffected.

---

## 1. Database Schema Changes

### 1a. New table: `item_unit_conversions`
Add to `api/database/migrations/2026_03_23_200007_create_items_table.php` (after `items` table):

```
item_unit_conversions:
  id (uuid PK)
  item_id (FK → items, cascadeOnDelete)
  unit_code (string, e.g. "BOX")
  conversion_factor (decimal 15,4) — 1 of this unit = X base units
  purchase_price (decimal 15,2, nullable) — default buy price in this unit
  selling_price (decimal 15,2, nullable) — default sell price in this unit
  sync columns + timestamps
  UNIQUE(item_id, unit_code)
```

### 1b. Add 3 columns to ALL 6 line tables
Add to `po_lines`, `so_lines`, `purchase_invoice_lines`, `sales_invoice_lines`, `purchase_return_lines`, `sales_return_lines`:

```
unit (string, nullable) — transaction unit (null = base unit)
conversion_factor (decimal 15,4, default 1)
base_quantity (decimal 15,3) — quantity × conversion_factor
```

**Migration files to modify:**
- `2026_03_23_200007_create_items_table.php` — add `item_unit_conversions` table
- `2026_03_24_000011_create_purchase_orders_table.php` — `po_lines`
- `2026_03_24_000012_create_sales_orders_table.php` — `so_lines`
- `2026_03_24_000014_create_purchase_invoices_table.php` — `purchase_invoice_lines`
- `2026_03_24_000015_create_purchase_returns_table.php` — `purchase_return_lines`
- `2026_03_24_000016_create_sales_invoices_table.php` — `sales_invoice_lines`
- `2026_03_24_000017_create_sales_returns_table.php` — `sales_return_lines`

### 1c. Stock ledger — NO schema changes
Already has `quantity`, `rate`, `value`. Controllers will pass `base_quantity` and `base_rate` instead.

---

## 2. Backend Changes

### 2a. New Model: `ItemUnitConversion`
- File: `api/app/Models/ItemUnitConversion.php`
- Traits: `HasUuids`, `HasSyncColumns`
- `belongsTo(Item::class)`
- Fillable: item_id, unit_code, conversion_factor, purchase_price, selling_price

### 2b. Update `Item` model
- File: `api/app/Models/Item.php`
- Add: `unitConversions() → hasMany(ItemUnitConversion::class)`

### 2c. Update `ItemController`
- File: `api/app/Http/Controllers/Api/V1/ItemController.php`
- `index()` / `show()`: Eager-load `unitConversions`
- `store()`: Accept `unit_conversions[]` array, create rows after item creation
- `update()`: Sync unit_conversions (delete removed, upsert rest)
- Validation: `unit_conversions.*.unit_code` must be in company units, must differ from base unit, unique per item

### 2d. Update all line Models (6 files)
Add `unit`, `conversion_factor`, `base_quantity` to `$fillable` and `$casts`:
- `PurchaseInvoiceLine`, `SalesInvoiceLine`, `PoLine`, `SoLine`, `PurchaseReturnLine`, `SalesReturnLine`

### 2e. Update Invoice/Order Controllers (4 files)
Add to validation: `lines.*.unit`, `lines.*.conversion_factor`

Update line processing loop:
```php
$conversionFactor = $line['conversion_factor'] ?? 1;
$baseQuantity = $line['quantity'] * $conversionFactor;
// Save on line: unit, conversion_factor, base_quantity
// Stock ledger: quantity = base_quantity, rate = line_rate / conversionFactor
```

**Controllers to modify:**
- `PurchaseInvoiceController.php` — stock ledger uses +base_quantity
- `SalesInvoiceController.php` — stock ledger uses -base_quantity
- `PurchaseOrderController.php` — store unit/conversion_factor on po_lines
- `SalesOrderController.php` — store unit/conversion_factor on so_lines

---

## 3. Frontend Changes

### 3a. Types (`fe/src/types/index.ts`)
- Add `ItemUnitConversion` interface
- Add `unit_conversions?: ItemUnitConversion[]` to `Item`
- Add `unit?: string`, `conversion_factor?: number`, `base_quantity?: number` to all 6 line interfaces

### 3b. Items Page (`fe/src/pages/inventory/Items.tsx`)
- Add "Alternate Units" section below base unit selector in the item form
- Dynamic rows: unit_code (select from company units, exclude base unit), conversion_factor (number), purchase_price (optional), selling_price (optional)
- Display: "1 BOX = 10 STRIP" format
- Send `unit_conversions[]` in create/update API calls

### 3c. Invoice/Order Form Pages (4 files)
- Add unit dropdown per line item (options: base unit + item's alternate units)
- On item selection: load available units, default to base unit
- On unit change: set conversion_factor, auto-fill rate from conversion's default price
- Show helper text: "= X base_units" next to quantity
- Send `unit` and `conversion_factor` per line in API request

**Pages to modify:**
- `fe/src/pages/purchase/PurchaseInvoices.tsx`
- `fe/src/pages/sales/SalesInvoiceFormPage.tsx`
- `fe/src/pages/purchase/PurchaseOrders.tsx`
- `fe/src/pages/sales/SalesOrders.tsx`

---

## 4. End-to-End Flow Example

**Setup**: Paracetamol, base_unit = STRIP. Alternate: 1 BOX = 10 STRIP (purchase_price=450)

**Purchase 5 BOX @ ₹450/BOX:**
- Invoice line: qty=5, rate=450, unit=BOX, conversion_factor=10, base_quantity=50
- Taxable: 5 × 450 = ₹2,250 (unchanged calculation)
- Stock ledger: qty=+50 (STRIP), rate=45, value=2250
- Accounting: uses taxable_amount=2250 (unchanged)

**Sell 2 BOX @ ₹600/BOX:**
- Invoice line: qty=2, rate=600, unit=BOX, conversion_factor=10, base_quantity=20
- Stock ledger: qty=-20 (STRIP), rate=60, value=1200

---

## 5. What Does NOT Change
- Stock ledger schema
- AccountingService (uses taxable_amount/grand_total, not quantities)
- CompanySetting / Units settings page (master unit catalog stays as-is)
- Stock summary queries (`SUM(quantity)` still works — always in base unit)

---

## 6. Implementation Order
1. Migration changes (7 files)
2. New model `ItemUnitConversion` + update `Item` model
3. Update 6 line models ($fillable/$casts)
4. Update `ItemController` (CRUD with unit_conversions)
5. Update 4 invoice/order controllers (unit handling + stock ledger conversion)
6. Frontend types
7. Items page (alternate units form)
8. Invoice/order form pages (unit selector per line)
9. Update seeders with sample conversions

---

## 7. Verification
- `php artisan migrate:fresh --seed` — confirm migrations run clean
- Create item with alternate units via API/UI
- Create purchase invoice using alternate unit — verify stock ledger has base_quantity
- Create sales invoice using alternate unit — verify stock deducted in base unit
- Check stock summary — should show totals in base unit
- Verify accounting vouchers are unaffected (same amounts)
