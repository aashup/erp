# Project Context: PHP + React Application

## Prompt Caching Configuration

This project uses prompt caching to reduce API costs and improve performance:

### Cache Settings
- **Type**: Ephemeral (15-minute default, 2-hour for stable content)
- **Cost Savings**: Cache reads cost 90% less than regular tokens
- **Performance**: Responses up to 2x faster for cached content

### What Gets Cached
1. **System Instructions** (this CLAUDE.md)
   - TTL: 1 hour (stable content)
   - Minimum 1,024 tokens required

2. **Large Documents**
   - API documentation
   - Database schemas
   - Project specifications
   - TTL: 5 minutes

3. **Conversation History**
   - Previous messages in multi-turn conversations
   - TTL: 5 minutes

### How It Works
- First request: Content is cached (1.25x cost)
- Subsequent requests: Cached content reused (0.1x cost)
- Automatic cache refresh on each hit

### Important Notes
- Minimum content size: 1,024 tokens for Sonnet models
- Cache expires if unused for 5 minutes (1-hour for extended cache)
- Breaking changes: Modifying cached content invalidates the cache


# Frontend Structure (React + Vite + TypeScript)

## Directory Layout

```
fe/src/
├── api/                    # API service modules (axios-based)
│   ├── auth.ts, parties.ts, inventory.ts, purchase.ts, sales.ts
│   ├── accounting.ts       # accountingGroupsApi, ledgersApi, vouchersApi, reportsApi, paymentReceiptsApi
│   ├── settings.ts, financialYears.ts, dashboard.ts
├── components/
│   ├── layout/             # AppLayout, AuthLayout, Sidebar, Header
│   └── ui/                 # Button, Input, Select, SlideSelect, Modal, Card, DataTable, Pagination, Badge
├── hooks/                  # useFinancialYear, useSelectedFYId, useOnlineStatus, useSync, useDebounce
├── lib/
│   ├── axios.ts            # Axios instance, auto-attaches JWT + financial_year_id
│   └── utils.ts            # cn(), formatCurrency(), formatDate(), calcGST()
├── pages/
│   ├── accounting/         # ChartOfAccounts, Ledgers, VouchersEntry, JournalEntries, TrialBalance, ProfitAndLoss, Payments
│   ├── inventory/          # Items, Godowns, StockLedger, StockSummary, etc.
│   ├── purchase/           # PurchaseOrders, PurchaseInvoices
│   ├── sales/              # SalesOrders, SalesInvoices, SalesInvoiceFormPage
│   ├── auth/               # Login, Register
│   ├── Parties.tsx, Branches.tsx, Settings.tsx
│   └── dashboard/
├── store/                  # Zustand: authStore, fyStore, themeStore
├── types/index.ts          # All TypeScript interfaces
├── App.tsx                 # React Router v7 routes + React Query provider
└── main.tsx                # Entry point
```

## CRUD Page Pattern (e.g., Parties.tsx, Ledgers.tsx)

1. **useQuery** fetches paginated list with search/filter params
2. **useMutation** for create/update/delete with queryClient.invalidateQueries
3. **useForm** with zodResolver for form validation
4. **DataTable** component for list with ColumnDef[]
5. **Modal** component for create/edit form
6. **Pagination** component for page navigation
7. Flow: Page loads → query → table renders → click Add/Edit → modal → submit → mutation → invalidate → refetch

## API Service Pattern

```typescript
export const fooApi = {
  list: (params?) => api.get<PaginatedResponse<Foo>>('/foo', { params }),
  get: (id) => api.get<ApiResponse<Foo>>(`/foo/${id}`),
  create: (data) => api.post<ApiResponse<Foo>>('/foo', data),
  update: (id, data) => api.put<ApiResponse<Foo>>(`/foo/${id}`, data),
  delete: (id) => api.delete(`/foo/${id}`),
};
```

## Key Libraries
- React 19, React Router v7, React Query v5, Zustand v5
- react-hook-form v7 + zod v4 (validation)
- @tanstack/react-table v8 (tables)
- Tailwind CSS v4 with dark mode
- lucide-react (icons), react-hot-toast (notifications)
- recharts (charts), dexie (offline IndexedDB)

## Accounting Pages

| Page | Route | Purpose |
|------|-------|---------|
| ChartOfAccounts.tsx | /accounting/groups | Tree view of accounting groups with CRUD |
| Ledgers.tsx | /accounting/ledgers | Ledger list with group filter, CRUD modal |
| VouchersEntry.tsx | /accounting/vouchers/new | Create manual journal voucher with multi-line debit/credit |
| JournalEntries.tsx | /accounting/journal | List all vouchers with type filter |
| TrialBalance.tsx | /accounting/trial-balance | Hierarchical trial balance report |
| ProfitAndLoss.tsx | /accounting/profit-loss | P&L statement |
| Payments.tsx | /accounting/payments | Payment/Receipt list and creation |

## Type Definitions (fe/src/types/index.ts)

Key interfaces: Company, User, Branch, FinancialYear, Item, Batch, Godown, Party, AccountingGroup, Ledger, Voucher, VoucherLine, PaymentReceipt, StockLedgerEntry, PurchaseOrder/Invoice, SalesOrder/Invoice

All entities include SyncColumns: sync_status, device_id, synced_at, updated_at_local, created_at, updated_at

Response wrappers: ApiResponse<T>, PaginatedResponse<T>

## State Management
- **authStore**: user, token, isAuthenticated, setAuth(), logout()
- **fyStore**: selectedFY, allFYs, setSelectedFY() (persisted to localStorage)
- **themeStore**: isDarkMode, toggleDarkMode()

## SlideSelect Component (`fe/src/components/ui/SlideSelect.tsx`)

Reusable searchable select that opens a right-side sliding panel. Use for entity selection (parties, items, ledgers, godowns) — replaces native `<Select>` when search/filter is needed.

- **Static mode**: pass `options: SlideSelectOption[]` for client-side filtering
- **API mode**: pass `queryKey`, `queryFn`, `mapFn` for server-side search with pagination
- **Form integration**: uses `value`/`onChange` pattern (NOT `register()`). Use with `watch()` + `setValue()` from react-hook-form
- **Features**: keyboard nav (arrows/Enter/Escape), debounced search, dark mode, body scroll lock, clear button
- **Keep existing `Select.tsx`** for small static enum lists (status, payment mode, voucher type)
- See `fe/SLIDE_SELECT_PLAN.md` for full usage examples

## Routing (App.tsx)
- AuthLayout wraps /login, /register
- AppLayout wraps all protected routes
- React Query defaults: 1 retry, 30s staleTime, no refetch on window focus
