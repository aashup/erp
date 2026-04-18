import { useState, useEffect } from 'react';
import { X, Printer, Search, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { salesInvoicesApi } from '@/api/sales';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { SalesInvoice } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onPrint: (invoiceId: string) => void;
}

export default function POSReprintPanel({ open, onClose, onPrint }: Props) {
  const [search, setSearch] = useState('');

  // Reset search when panel opens
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ['pos-reprint-invoices'],
    queryFn: () =>
      salesInvoicesApi.list({ status: 'confirmed', per_page: '50', sort: '-created_at' }),
    enabled: open,
    staleTime: 30_000,
    select: (res) => (res.data.data ?? []) as SalesInvoice[],
  });

  const invoices = (data ?? []).filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.party?.name?.toLowerCase().includes(q)
    );
  });

  function handlePrint(inv: SalesInvoice) {
    onPrint(inv.id);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-80 bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">Reprint Invoice</h2>
            {data && data.length > 0 && (
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">
                {data.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice / customer…"
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400 dark:focus:border-indigo-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-24">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && invoices.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <FileText className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">
                {search ? 'No matching invoices' : 'No invoices found'}
              </p>
            </div>
          )}

          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {inv.invoice_number}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {inv.party?.name ?? 'Walk-in Customer'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(inv.invoice_date as unknown as string)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(Number(inv.grand_total))}
                </span>
                <button
                  onClick={() => handlePrint(inv)}
                  className="flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-1.5 transition-colors"
                  title={`Print ${inv.invoice_number}`}
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
