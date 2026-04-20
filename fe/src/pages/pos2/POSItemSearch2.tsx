import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, Package } from 'lucide-react';
import { posApi } from '@/api/pos';
import { itemGroupsApi } from '@/api/inventory';
import { formatCurrency } from '@/lib/utils';
import type { ItemGroup } from '@/types';
import type { POSItem } from '@/api/pos';

interface Props {
  godownId: string;
  onAdd: (item: POSItem) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

export default function POSItemSearch2({ godownId, onAdd, searchRef }: Props) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<POSItem[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypeTime = useRef<number>(0);

  // Load item groups for category tabs
  useEffect(() => {
    itemGroupsApi.list().then((res) => {
      const list = res.data.data ?? [];
      setGroups(list);
    }).catch(() => {});
  }, []);

  const fetchItems = useCallback(async (q: string, groupId: string) => {
    setLoading(true);
    try {
      const res = await posApi.searchItems({
        search: q || undefined,
        godown_id: godownId || undefined,
        item_group_id: groupId || undefined,
      });
      setItems(res.data.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [godownId]);

  // Initial load
  useEffect(() => {
    fetchItems('', '');
  }, [fetchItems]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);

    const now = Date.now();
    const timeSinceLast = now - lastTypeTime.current;
    lastTypeTime.current = now;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Barcode scanner: ≥ 6 chars arriving very fast (< 100ms between keystrokes)
    if (val.length >= 6 && timeSinceLast < 100) {
      // Immediate search as barcode
      fetchItems(val, activeGroup);
      return;
    }

    timerRef.current = setTimeout(() => fetchItems(val, activeGroup), 300);
  }

  function handleGroupChange(gId: string) {
    setActiveGroup(gId);
    fetchItems(query, gId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && items.length > 0) {
      onAdd(items[0]);
      // Play beep sound
      playBeep();
      setQuery('');
      setTimeout(() => fetchItems('', activeGroup), 50);
    }
  }

  function handleCardClick(item: POSItem) {
    onAdd(item);
    playBeep();
    searchRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Search item or scan barcode… (F2)"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* Category tabs */}
      {groups.length > 0 && (
        <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handleGroupChange('')}
            className={`shrink-0 px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              activeGroup === ''
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => handleGroupChange(g.id)}
              className={`shrink-0 px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                activeGroup === g.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3 pt-1">
        {loading && (
          <div className="flex items-center justify-center h-24">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 text-gray-400">
            <Package className="h-8 w-8 mb-1 opacity-40" />
            <p className="text-sm">No items found</p>
          </div>
        )}
        {!loading && (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleCardClick(item)}
                className="flex flex-col items-start text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-400 hover:shadow-md active:scale-95 transition-all group"
              >
                <div className="w-full flex items-start justify-between gap-1 mb-1">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight line-clamp-2 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                    {item.name}
                  </p>
                </div>
                {item.sku && (
                  <p className="text-xs text-gray-400 mb-1 font-mono">{item.sku}</p>
                )}
                <div className="w-full flex items-end justify-between mt-auto">
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {item.selling_price != null ? formatCurrency(item.selling_price) : '—'}
                  </span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    item.current_stock > 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {item.current_stock > 0 ? `${item.current_stock} ${item.unit}` : 'Out'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // AudioContext not available
  }
}
