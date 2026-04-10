# Implementation Plan: Voucher Frontend - Backend Integration

## Context
The backend will now handle sequential voucher numbering via the `company_settings` table with `vouchers_index`. The frontend (React/Vite) needs to accommodate this change by:
1. Displaying auto-generated voucher numbers returned from the API
2. Removing any local voucher number generation logic
3. Handling the updated API response structure
4. Ensuring UX remains consistent with new numbering system

**Current state:** Frontend forms may have local number generation or display logic that conflicts with backend auto-generation.

---

## Implementation Steps

### Phase 1: Form Components Update

#### 1.1 JournalVoucherForm.tsx
**File:** `/Users/aashu/erp/fe/src/pages/accounting/vouchers/JournalVoucherForm.tsx`

- **Remove:** Any local voucher number generation logic (if present)
- **Verify:** Form submission sends request to `/api/v1/vouchers` endpoint
- **Display:** Show auto-generated `voucher_number` from API response after creation
- **Update:** On successful POST, display the returned `voucher_number` (e.g., "JOU-00001") in a success message or confirmation

**Key change:**
```typescript
// Before: may generate locally
// After: receive from API response
const response = await vouchersApi.create(formData);
const { voucher_number } = response.data; // Use backend-generated number
```

#### 1.2 ContraVoucherForm.tsx
**File:** `/Users/aashu/erp/fe/src/pages/accounting/vouchers/ContraVoucherForm.tsx`

- Same changes as 1.1
- Ensure `voucher_type: 'contra'` is sent in form data
- Display returned `voucher_number` in format: "CON-00001"

#### 1.3 PaymentReceiptForm.tsx
**File:** `/Users/aashu/erp/fe/src/pages/accounting/vouchers/PaymentReceiptForm.tsx`

- Same changes as 1.1
- Handles two voucher types: 'payment' and 'receipt'
- Ensure correct type is set based on form context
- Display returned numbers: "PAY-00001", "REC-00001"

#### 1.4 VoucherFormHeader.tsx
**File:** `/Users/aashu/erp/fe/src/pages/accounting/vouchers/VoucherFormHeader.tsx`

- **Remove:** Any pre-filled or suggested voucher number fields
- **Verify:** Header doesn't display editable voucher_number input
- **Update:** If showing voucher_number, display it as read-only after creation (from API response)

---

### Phase 2: List & Display Components

#### 2.1 VouchersEntry.tsx (Main Page)
**File:** `/Users/aashu/erp/fe/src/pages/accounting/VouchersEntry.tsx`

**Changes:**
- Verify the voucher list is fetched from `/api/v1/vouchers` (already done in current implementation)
- Ensure `voucher_number` is displayed correctly from API response (should already work)
- Add/verify column for `voucher_number` in the list table

**No major changes needed** — the list already displays API-returned voucher numbers.

**Verification checklist:**
- List shows voucher_number in format: "PUR-00001", "SAL-00001", etc.
- Search/filter works correctly on voucher_number field
- Sort by voucher_number is functional

---

### Phase 3: API Integration

#### 3.1 Accounting API Service
**File:** `/Users/aashu/erp/fe/src/api/accounting.ts`

**Verify/Update:**
- `vouchersApi.create(data)` → POST `/api/v1/vouchers`
  - Ensure response includes `voucher_number` field
  - No need to generate number locally
  - Return full response to form components

**Expected response structure:**
```typescript
{
  id: "uuid",
  company_id: "uuid",
  voucher_number: "PUR-00001",  // Backend-generated
  voucher_type: "purchase",
  voucher_date: "2026-04-10",
  // ... other fields
}
```

- `vouchersApi.list(params)` → GET `/api/v1/vouchers`
  - Already paginated
  - Includes `voucher_number` in results
  - No changes needed

---

### Phase 4: Modal & Detail Views

#### 4.1 Voucher Detail View (if exists)
**File:** Likely in VouchersEntry.tsx or separate component

**Changes:**
- Display `voucher_number` as read-only (no edit capability)
- Verify the number matches backend-assigned value
- Show voucher number prominently (e.g., in header or above form)

---

### Phase 5: Sync & Offline Handling (if applicable)

#### 5.1 Offline Voucher Creation
**If mobile/web supports offline mode:**

- Vouchers created offline cannot pre-assign numbers (backend owns the sequence)
- Solution: Assign temporary `voucher_number_pending` locally, show sync status badge
- On sync completion, replace with actual `voucher_number` from server response
- Update local database with server-assigned number

**Implementation:**
```typescript
// Offline mode
const localVoucher = {
  id: uuidv4(),
  voucher_number_pending: "PUR-??",  // Placeholder
  sync_status: 'pending',
  // ... form data
};

// On sync
const response = await api.pushVoucher(localVoucher);
// Update local DB with actual voucher_number from response
localDB.update(localVoucher.id, { 
  voucher_number: response.voucher_number,
  sync_status: 'synced'
});
```

---

## Files to Create/Modify

### Modify:
1. `/Users/aashu/erp/fe/src/pages/accounting/vouchers/JournalVoucherForm.tsx` — Remove local number generation, display backend-returned number
2. `/Users/aashu/erp/fe/src/pages/accounting/vouchers/ContraVoucherForm.tsx` — Same as above
3. `/Users/aashu/erp/fe/src/pages/accounting/vouchers/PaymentReceiptForm.tsx` — Same as above
4. `/Users/aashu/erp/fe/src/pages/accounting/vouchers/VoucherFormHeader.tsx` — Remove editable voucher_number field if present
5. `/Users/aashu/erp/fe/src/api/accounting.ts` — Verify response structure includes voucher_number

### No changes needed:
- `/Users/aashu/erp/fe/src/pages/accounting/VouchersEntry.tsx` — Already displays API-returned numbers
- API endpoint definitions — Backend handles all numbering

---

## Key Design Decisions

1. **Backend Authority** — Frontend never generates voucher numbers; always received from backend API response.

2. **Read-only Display** — Voucher_number field is display-only in forms, never user-editable.

3. **Transparent Integration** — UI changes are minimal; numbering logic moved to backend, frontend just displays results.

4. **Offline Support** — If offline-first sync is implemented, temporary numbers are replaced with backend-assigned numbers on sync.

5. **Consistent Format** — All forms display voucher_number in `PREFIX-NNNNN` format (e.g., "PUR-00001") from backend.

---

## Testing Checklist

- [ ] Create manual journal voucher → verify displayed number is "JOU-00001"
- [ ] Create second journal voucher → verify number increments to "JOU-00002"
- [ ] Create contra voucher → verify prefix is "CON" and counter starts at 1
- [ ] Create payment voucher → verify prefix is "PAY"
- [ ] Create receipt voucher → verify prefix is "REC"
- [ ] Create purchase voucher → verify prefix is "PUR"
- [ ] Create sales voucher → verify prefix is "SAL"
- [ ] Verify each type has independent counter (e.g., PUR-00001, PUR-00002, etc.)
- [ ] List page displays all voucher numbers correctly
- [ ] Search/filter on voucher_number works
- [ ] Detail view shows correct voucher_number
- [ ] No user can manually override voucher_number
- [ ] Form submission succeeds and shows generated number in response

---

## Success Criteria

✅ Frontend forms receive and display backend-generated voucher numbers  
✅ No local voucher number generation in frontend code  
✅ Voucher_number is read-only in all forms  
✅ List page displays numbers in correct format: PREFIX-NNNNN  
✅ All voucher types (6 types) have independent counters  
✅ UX remains consistent with previous implementation  
✅ If offline mode exists, sync handles number assignment correctly  
