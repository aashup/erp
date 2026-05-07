import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useFYStore } from '@/store/fyStore';
import { reportsApi, type AuditTrailEntry } from '@/api/accounting';
import { formatDate, localDateToUtcRange } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_BADGE: Record<string, string> = {
  created: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  updated: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  deleted: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const MODULE_BADGE: Record<string, string> = {
  sales_invoice: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  sales_order: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  sales_return: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  purchase_invoice: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  purchase_order: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  purchase_return: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  payment_receipt: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  voucher: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  ledger: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  accounting_group: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  item: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  item_group: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  unit: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  batch: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  party: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  user: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

function moduleLabel(key: string | null): string {
  if (!key) return '—';
  return key
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ─── Diff Panel ───────────────────────────────────────────────────────────────

function AuditDiffPanel({ entry, onClose }: { entry: AuditTrailEntry; onClose: () => void }) {
  const after = isPlainObject(entry.properties?.attributes) ? entry.properties!.attributes! : {};
  const before = isPlainObject(entry.properties?.old) ? entry.properties!.old! : {};

  const allKeys = useMemo(() => {
    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    return Array.from(keys).sort();
  }, [before, after]);

  const event = entry.event ?? '';
  const showBefore = event === 'updated' || event === 'deleted';
  const showAfter = event === 'updated' || event === 'created';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  EVENT_BADGE[event] ?? EVENT_BADGE.updated
                }`}
              >
                {event || 'event'}
              </span>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  MODULE_BADGE[entry.subject_type ?? ''] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {moduleLabel(entry.subject_type)}
              </span>
              <h3 className="truncate font-semibold text-gray-900 dark:text-white">
                {entry.subject_label ?? entry.subject_id ?? '—'}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {entry.causer ? entry.causer.name : 'System'} ·{' '}
              {new Date(entry.created_at).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {allKeys.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No property data captured.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">
                    Field
                  </th>
                  {showBefore && (
                    <th className="px-3 py-2 text-left font-semibold text-red-600 dark:text-red-400">
                      Before
                    </th>
                  )}
                  {showAfter && (
                    <th className="px-3 py-2 text-left font-semibold text-green-600 dark:text-green-400">
                      After
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {allKeys.map((key) => {
                  const a = after[key];
                  const b = before[key];
                  const changed = event === 'updated' && fmtValue(a) !== fmtValue(b);
                  return (
                    <tr
                      key={key}
                      className={`border-b border-gray-100 dark:border-gray-800 ${
                        changed ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-700 dark:text-gray-300">
                        {key}
                      </td>
                      {showBefore && (
                        <td className="break-all px-3 py-2 font-mono text-gray-600 dark:text-gray-400">
                          {fmtValue(b)}
                        </td>
                      )}
                      {showAfter && (
                        <td className="break-all px-3 py-2 font-mono text-gray-700 dark:text-gray-200">
                          {fmtValue(a)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface FiltersDraft {
  dateFrom: string;
  dateTo: string;
  causerId: string;
  subjectType: string;
  event: string;
  search: string;
}

const EMPTY_FILTERS: FiltersDraft = {
  dateFrom: '',
  dateTo: '',
  causerId: '',
  subjectType: '',
  event: '',
  search: '',
};

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  draft: FiltersDraft;
  setDraft: (f: FiltersDraft) => void;
  onApply: () => void;
  onReset: () => void;
  users: { id: string; name: string; email: string }[];
  subjectTypes: { key: string; label: string }[];
  events: string[];
}

function FilterPanelInner({
  open,
  onClose,
  draft,
  setDraft,
  onApply,
  onReset,
  users,
  subjectTypes,
  events,
}: FilterPanelProps) {
  const inputCls =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-96 transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={draft.dateFrom}
                  onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="date"
                  value={draft.dateTo}
                  onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                User
              </label>
              <select
                value={draft.causerId}
                onChange={(e) => setDraft({ ...draft, causerId: e.target.value })}
                className={inputCls}
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Module
              </label>
              <select
                value={draft.subjectType}
                onChange={(e) => setDraft({ ...draft, subjectType: e.target.value })}
                className={inputCls}
              >
                <option value="">All modules</option>
                {subjectTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Action
              </label>
              <select
                value={draft.event}
                onChange={(e) => setDraft({ ...draft, event: e.target.value })}
                className={inputCls}
              >
                <option value="">All actions</option>
                {events.map((e) => (
                  <option key={e} value={e}>
                    {e.charAt(0).toUpperCase() + e.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Search
              </label>
              <input
                type="text"
                placeholder="Description or values…"
                value={draft.search}
                onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
            <button
              onClick={onReset}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Reset
            </button>
            <button
              onClick={onApply}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditTrail() {
  usePageTitle('Audit Trail');
  const selectedFY = useFYStore((s) => s.selectedFY);

  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<FiltersDraft>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FiltersDraft>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [drillDown, setDrillDown] = useState<AuditTrailEntry | null>(null);

  const filtersQuery = useQuery({
    queryKey: ['audit-trail-filters'],
    queryFn: () => reportsApi.auditTrailFilters(),
    select: (res) => res.data,
    staleTime: 60_000,
  });

  const queryParams = useMemo(() => {
    const p: Record<string, string | number> = { per_page: 50, page };
    if (applied.dateFrom && applied.dateTo) {
      const { date_from, date_to } = localDateToUtcRange(applied.dateFrom, applied.dateTo);
      p.date_from = date_from;
      p.date_to = date_to;
    }
    if (applied.causerId) p.causer_id = applied.causerId;
    if (applied.subjectType) p.subject_type = applied.subjectType;
    if (applied.event) p.event = applied.event;
    if (applied.search) p.search = applied.search;
    return p;
  }, [applied, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['report-audit-trail', applied, page, selectedFY?.id],
    queryFn: () => reportsApi.auditTrail(queryParams),
    select: (res) => res.data,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (applied.dateFrom || applied.dateTo) n++;
    if (applied.causerId) n++;
    if (applied.subjectType) n++;
    if (applied.event) n++;
    if (applied.search) n++;
    return n;
  }, [applied]);

  const handleApply = () => {
    setApplied(draft);
    setPage(1);
    setFilterOpen(false);
  };
  const handleReset = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
    setFilterOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Trail</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Every create, update, and delete across the system.
            {meta ? ` · ${meta.total} total entries` : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setDraft(applied);
            setFilterOpen(true);
          }}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            activeFilterCount > 0
              ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs dark:border-indigo-800 dark:bg-indigo-900/20">
          {applied.dateFrom || applied.dateTo ? (
            <span className="text-indigo-700 dark:text-indigo-300">
              {applied.dateFrom || '…'} → {applied.dateTo || '…'}
            </span>
          ) : null}
          {applied.causerId && (
            <span className="text-indigo-700 dark:text-indigo-300">
              User:{' '}
              {filtersQuery.data?.users.find((u) => u.id === applied.causerId)?.name ?? '—'}
            </span>
          )}
          {applied.subjectType && (
            <span className="text-indigo-700 dark:text-indigo-300">
              Module: {moduleLabel(applied.subjectType)}
            </span>
          )}
          {applied.event && (
            <span className="text-indigo-700 dark:text-indigo-300">Action: {applied.event}</span>
          )}
          {applied.search && (
            <span className="text-indigo-700 dark:text-indigo-300">"{applied.search}"</span>
          )}
          <button onClick={handleReset} className="ml-auto text-indigo-400 hover:text-indigo-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">No audit entries match your filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Date / Time
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    User
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Module
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Action
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Record
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setDrillDown(row)}
                    className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/40 dark:border-gray-700/40 dark:hover:bg-blue-900/10"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-400">
                      <div>{formatDate(row.created_at)}</div>
                      <div className="text-[10px] text-gray-400">
                        {new Date(row.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {row.causer ? (
                        <div>
                          <div className="text-gray-800 dark:text-gray-200">{row.causer.name}</div>
                          <div className="text-[10px] text-gray-400">{row.causer.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">System</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          MODULE_BADGE[row.subject_type ?? ''] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {moduleLabel(row.subject_type)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          EVENT_BADGE[row.event ?? ''] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {row.event ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-blue-700 hover:underline dark:text-blue-400">
                      {row.subject_label ?? row.subject_id ?? '—'}
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-gray-500 dark:text-gray-400">
                      {row.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">
                Page {meta.current_page} of {meta.last_page} · {meta.total} entries
              </span>
              <div className="flex gap-2">
                <button
                  disabled={meta.current_page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-40 dark:border-gray-600"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  disabled={meta.current_page >= meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-40 dark:border-gray-600"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <FilterPanelInner
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        draft={draft}
        setDraft={setDraft}
        onApply={handleApply}
        onReset={handleReset}
        users={filtersQuery.data?.users ?? []}
        subjectTypes={filtersQuery.data?.subject_types ?? []}
        events={filtersQuery.data?.events ?? ['created', 'updated', 'deleted']}
      />

      {drillDown && <AuditDiffPanel entry={drillDown} onClose={() => setDrillDown(null)} />}
    </div>
  );
}
