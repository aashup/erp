import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { paymentReceiptsApi } from '@/api/accounting';
import type { PaymentReceipt } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface PaymentVoucherDetailModalProps {
  record: PaymentReceipt | null;
  onClose: () => void;
}

const PAYMENT_MODE_LABEL: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank Transfer',
  cheque: 'Cheque',
  upi: 'UPI',
  other: 'Other',
};

export function PaymentVoucherDetailModal({ record, onClose }: PaymentVoucherDetailModalProps) {
  const { data: journalRes, isLoading } = useQuery({
    queryKey: ['payment-receipt-journal', record?.id],
    queryFn: () => paymentReceiptsApi.journal(record!.id),
    select: (res) => res.data.data,
    enabled: !!record,
  });

  if (!record) return null;

  const voucher = journalRes ?? null;
  const lines = voucher?.lines ?? [];
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = lines.length > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <Modal
      open={!!record}
      onClose={onClose}
      title={`${record.type === 'payment' ? 'Payment' : 'Receipt'} — ${record.receipt_number}`}
      size="lg"
    >
      <div className="space-y-5">
        {/* ── Payment Info ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoRow label="Number" value={record.receipt_number} />
          <InfoRow label="Date" value={formatDate(record.receipt_date)} />
          <InfoRow label="Party" value={record.party?.name ?? '—'} />
          <InfoRow
            label="Amount"
            value={
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(record.amount)}
              </span>
            }
          />
          <InfoRow label="Mode" value={<Badge>{PAYMENT_MODE_LABEL[record.payment_mode] ?? record.payment_mode}</Badge>} />
          {record.reference_number && (
            <InfoRow label="Reference" value={record.reference_number} />
          )}
          {record.bank_name && <InfoRow label="Bank" value={record.bank_name} />}
          {record.notes && (
            <div className="col-span-2">
              <InfoRow label="Notes" value={record.notes} />
            </div>
          )}
        </div>

        {/* ── Auto-posted Journal Entry ─────────────────────────────────── */}
        <div className="border-t dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Auto-posted Journal Entry
            </h3>
            {voucher && (
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {voucher.voucher_number}
              </span>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading journal…</p>
          ) : !voucher ? (
            <p className="text-sm text-gray-400 py-4 text-center">No journal entry found.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <th className="py-2 text-left">Ledger</th>
                    <th className="py-2 text-right w-28">Debit (₹)</th>
                    <th className="py-2 text-right w-28">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr
                      key={line.id}
                      className="border-b dark:border-gray-700 last:border-0"
                    >
                      <td className="py-2 text-gray-800 dark:text-gray-200">
                        {line.ledger?.name ?? line.ledger_id}
                        {line.narration && (
                          <span className="ml-2 text-[11px] text-gray-400">
                            {line.narration}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono text-blue-700 dark:text-blue-300">
                        {line.debit > 0 ? formatCurrency(line.debit) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="py-2 text-right font-mono text-orange-600 dark:text-orange-400">
                        {line.credit > 0 ? formatCurrency(line.credit) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 dark:border-gray-600 font-semibold text-sm">
                    <td className="pt-3 pb-1 text-gray-600 dark:text-gray-400">Total</td>
                    <td className="pt-3 pb-1 text-right font-mono text-blue-700 dark:text-blue-300">
                      {formatCurrency(totalDebit)}
                    </td>
                    <td className="pt-3 pb-1 text-right font-mono text-orange-600 dark:text-orange-400">
                      {formatCurrency(totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Balanced indicator */}
              <div className="mt-3 flex items-center gap-2">
                {isBalanced ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      Balanced — Dr = Cr
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      Unbalanced — Diff: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Small helper ────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-500 dark:text-gray-400 min-w-[80px]">{label}:</span>
      <span className="text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  );
}
