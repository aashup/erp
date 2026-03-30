# SlideSelect Component — Implementation Plan

## Context

Forms across the ERP (Purchase Invoices, Sales Invoices, Payments, Vouchers) use native `<Select>` or raw `<select>` for entity selection (parties, items, ledgers, godowns). These don't support search/filter, keyboard navigation, or API-based dynamic loading. The `SlideSelect` component is a reusable right-side sliding panel with search, keyboard nav, and API integration.

---

## Files

| File | Purpose |
|------|---------|
| `fe/src/components/ui/SlideSelect.tsx` | Main component (trigger input + slide panel + list + search + keyboard) |
| `fe/src/hooks/useDebounce.ts` | Reusable debounce hook |

The existing `Select.tsx` is **kept** for small static enum lists (status, payment mode, voucher type).

---

## Component API

```typescript
interface SlideSelectOption {
  value: string;
  label: string;
  subtitle?: string;   // secondary line (SKU, GSTIN, group name)
}

interface SlideSelectProps {
  name: string;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  panelTitle?: string;

  // Static data source
  options?: SlideSelectOption[];

  // API data source
  queryKey?: string[];
  queryFn?: (params) => Promise<{ data: PaginatedResponse<any> }>;
  mapFn?: (item: any) => SlideSelectOption;

  // Controlled value (works with react-hook-form setValue/watch)
  value?: string;
  displayValue?: string;   // initial label when editing
  onChange?: (value: string, option: SlideSelectOption | null) => void;
}
```

## Usage Examples

### API-based (party selection):
```tsx
<SlideSelect
  name="party_id"
  label="Vendor"
  value={watch('party_id')}
  onChange={(val) => setValue('party_id', val, { shouldValidate: true })}
  error={errors.party_id?.message}
  panelTitle="Select Vendor"
  queryKey={['parties-vendors']}
  queryFn={(params) => partiesApi.list({ ...params, type: 'vendor' })}
  mapFn={(p: Party) => ({ value: p.id, label: p.name, subtitle: p.gstin ?? '' })}
  displayValue={editData?.party?.name}
/>
```

### Static options:
```tsx
<SlideSelect
  name="godown_id"
  label="Godown"
  value={watch('godown_id')}
  onChange={(val) => setValue('godown_id', val, { shouldValidate: true })}
  options={godownOptions}
  panelTitle="Select Godown"
/>
```

### Line-item with side effects:
```tsx
<SlideSelect
  name={`lines.${index}.item_id`}
  value={watch(`lines.${index}.item_id`)}
  onChange={(val) => {
    setValue(`lines.${index}.item_id`, val, { shouldValidate: true });
    const item = itemMap.get(val);
    if (item) {
      setValue(`lines.${index}.rate`, item.purchase_price ?? 0);
      setValue(`lines.${index}.gst_rate`, item.gst_rate ?? 18);
    }
  }}
  error={errors.lines?.[index]?.item_id?.message}
  panelTitle="Select Item"
  queryKey={['items-all']}
  queryFn={(params) => itemsApi.list(params)}
  mapFn={(i: Item) => ({ value: i.id, label: i.name, subtitle: [i.sku, i.hsn_code].filter(Boolean).join(' | ') })}
/>
```

## Features
- Right-side sliding panel with backdrop and animation
- Real-time search/filter (client-side for static, debounced API for dynamic)
- Keyboard navigation (Arrow keys, Enter, Escape)
- Pagination for API mode
- Dark mode support
- Body scroll lock
- Clear selection button
- Loading/empty/error states
