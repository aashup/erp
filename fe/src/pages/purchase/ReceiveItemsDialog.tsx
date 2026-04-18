import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { purchaseOrdersApi } from '@/api/purchase';
import type { PurchaseOrder } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface Props {
  po: PurchaseOrder;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReceiveItemsDialog({ po, open, onClose, onSuccess }: Props) {
  const [receiptDate, setReceiptDate] = useState('');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  // Initialize quantities when dialog opens
  useEffect(() => {
    if (open && po.lines) {
      const init: Record<string, string> = {};
      for (const line of po.lines) {
        const pending = Math.max(0, line.quantity - line.received_quantity);
        if (pending > 0) {
          init[line.id] = String(pending);
        }
      }
      setQuantities(init);
      setReceiptDate('');
      setNotes('');
    }
  }, [open, po]);

  const pendingLines = (po.lines ?? []).filter(
    (l) => l.quantity - l.received_quantity > 0,
  );

  const mutation = useMutation({
    mutationFn: () => {
      const lines = pendingLines
        .map((l) => ({ po_line_id: l.id, quantity: parseFloat(quantities[l.id] ?? '0') }))
        .filter((l) => l.quantity > 0);

      if (lines.length === 0) {
        throw new Error('Enter at least one quantity to receive');
      }

      return purchaseOrdersApi.receiveItems(po.id, {
        ...(receiptDate ? { receipt_date: receiptDate } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines,
      });
    },
    onSuccess: (res) => {
      toast.success(res.data?.message ?? 'Items received successfully');
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string; response?: { data?: { message?: string } } });
      toast.error(msg?.response?.data?.message ?? msg?.message ?? 'Failed to receive items');
    },
  });

  const handleSubmit = () => {
    const hasQty = pendingLines.some((l) => parseFloat(quantities[l.id] ?? '0') > 0);
    if (!hasQty) {
      toast.error('Enter at least one quantity to receive');
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Receive Items — PO ${po.po_number}`} size="xl">
      <div className="space-y-4">
        {/* Line items table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="pb-2 pr-3">Item</th>
                <th className="pb-2 pr-3 text-right">Ordered</th>
                <th className="pb-2 pr-3 text-right">Received</th>
                <th className="pb-2 pr-3 text-right">Pending</th>
                <th className="pb-2 text-right">Receive Now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {pendingLines.map((line) => {
                const pending = Math.max(0, line.quantity - line.received_quantity);
                return (
                  <tr key={line.id}>
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">
                      {line.item?.name ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-400">
                      {line.quantity}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-400">
                      {line.received_quantity}
                    </td>
                    <td className="py-2 pr-3 text-right text-amber-600 dark:text-amber-400 font-medium">
                      {pending}
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max={pending}
                        step="0.001"
                        value={quantities[line.id] ?? ''}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))
                        }
                        className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </td>
                  </tr>
                );
              })}
              {pendingLines.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500 dark:text-gray-400">
                    All items have been fully received.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Optional fields */}
        {pendingLines.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Receipt Date <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Notes <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Partial delivery, batch 1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          {pendingLines.length > 0 && (
            <Button onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Receive Items'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
