import { useEffect, useState } from 'react';
import { X, Clock, Trash2, RotateCcw } from 'lucide-react';
import { posApi } from '@/api/pos';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { SalesInvoice } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onResume: (invoice: SalesInvoice) => void;
  refreshKey?: number;
}

export default function POSHeldBills2({ open, onClose, onResume, refreshKey }: Props) {
  const [bills, setBills] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    posApi.getHeld()
      .then((res) => setBills(res.data.data ?? []))
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
  }, [open, refreshKey]);

  async function handleDelete(id: string) {
    try {
      await posApi.deleteHeld(id);
      setBills((prev) => prev.filter((b) => b.id !== id));
      toast.success('Held bill removed');
    } catch {
      toast.error('Failed to remove held bill');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-80 bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">Held Bills</h2>
            {bills.length > 0 && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                {bills.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-24">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && bills.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <Clock className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No held bills</p>
            </div>
          )}
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="border-b border-gray-100 dark:border-gray-800 px-4 py-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{bill.invoice_number}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {bill.party?.name ?? 'Walk-in Customer'}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(bill.invoice_date as unknown as string)}</p>
                  {(bill.lines?.length ?? 0) > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {bill.lines!.length} item{bill.lines!.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(bill.grand_total as unknown as number)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { onResume(bill); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Resume
                </button>
                <button
                  onClick={() => handleDelete(bill.id)}
                  className="flex items-center justify-center text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
