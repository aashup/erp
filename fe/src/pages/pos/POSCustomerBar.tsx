import { useState, useRef, useEffect } from 'react';
import { User, UserPlus, X, Search } from 'lucide-react';
import { posApi } from '@/api/pos';
import { partiesApi } from '@/api/parties';
import { formatCurrency } from '@/lib/utils';
import type { Party } from '@/types';

interface PartyBalance {
  balance: number;
  balance_abs: number;
  type: 'dr' | 'cr';
}

interface Props {
  customer: Party | null;
  onCustomerChange: (party: Party | null) => void;
}

export default function POSCustomerBar({ customer, onCustomerChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Real ledger balance for the selected customer
  const [balance, setBalance] = useState<PartyBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Fetch real ledger balance whenever the selected customer changes
  useEffect(() => {
    setBalance(null);
    if (!customer || customer.name === 'Walk-in Customer') return;
    setBalanceLoading(true);
    partiesApi.balance(customer.id)
      .then((res) => setBalance(res.data.data))
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [customer?.id]);

  function handleSearch(q: string) {
    setSearch(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await partiesApi.list({ type: 'customer', search: q, per_page: '10' });
        setResults(res.data.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  async function handleQuickAdd() {
    if (!quickName.trim()) return;
    setSaving(true);
    try {
      const res = await posApi.quickParty({ name: quickName.trim(), phone: quickPhone.trim() || undefined });
      onCustomerChange(res.data.data);
      setOpen(false);
      setShowQuickAdd(false);
      setQuickName('');
      setQuickPhone('');
    } finally {
      setSaving(false);
    }
  }

  function select(party: Party) {
    onCustomerChange(party);
    setOpen(false);
    setSearch('');
    setResults([]);
  }

  // Balance display helpers
  const balanceColor = balance
    ? balance.type === 'dr'
      ? 'text-red-500 dark:text-red-400'      // owes us — show as red (outstanding)
      : 'text-green-600 dark:text-green-400'  // credit — show as green (advance)
    : 'text-indigo-500 dark:text-indigo-400';

  const balanceLabel = balance
    ? `${formatCurrency(balance.balance_abs)} ${balance.type.toUpperCase()}`
    : null;

  return (
    <div className="relative flex items-center gap-2">
      {customer ? (
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg px-3 py-1.5">
          <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{customer.name}</p>
            {customer.phone && <p className="text-xs text-indigo-500 dark:text-indigo-400">{customer.phone}</p>}
            <p className={`text-xs font-medium ${balanceColor}`}>
              {balanceLoading
                ? 'Loading…'
                : balanceLabel
                ? `Bal: ${balanceLabel}`
                : 'Bal: ₹0'}
            </p>
          </div>
          <button
            onClick={() => onCustomerChange(null)}
            className="ml-1 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 transition-colors"
        >
          <User className="h-4 w-4" />
          Walk-in Customer
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50">
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {loading && <p className="text-xs text-center text-gray-400 py-4">Searching…</p>}
            {!loading && results.length === 0 && search && (
              <p className="text-xs text-center text-gray-400 py-4">No customer found</p>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => select(p)}
                className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-left transition-colors"
              >
                <User className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</p>
                  {p.phone && <p className="text-xs text-gray-400">{p.phone}</p>}
                </div>
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-gray-100 dark:border-gray-700">
            {!showQuickAdd ? (
              <button
                onClick={() => setShowQuickAdd(true)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Quick Add Customer
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Customer name *"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400"
                />
                <input
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowQuickAdd(false)}
                    className="flex-1 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleQuickAdd}
                    disabled={saving || !quickName.trim()}
                    className="flex-1 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium"
                  >
                    {saving ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { setOpen(false); setSearch(''); setResults([]); setShowQuickAdd(false); }}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
