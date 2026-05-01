import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { employeesApi } from '@/api/payroll';
import { ledgersApi } from '@/api/accounting';
import type { Employee } from '@/types';
import { X, Wallet } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useDateStore } from '@/store/dateStore';
import toast from 'react-hot-toast';

interface Props {
  employee: Employee | null;
  onClose: () => void;
}

export default function EmployeeAdvancePanel({ employee, onClose }: Props) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('payroll.edit');

  const { selectedDate } = useDateStore();
  const [amount, setAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(selectedDate);
  const [description, setDescription] = useState('');
  const [paymentLedgerId, setPaymentLedgerId] = useState('');
  
  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['employee-advance-balance', employee?.id],
    queryFn: () => employeesApi.getAdvanceBalance(employee!.id),
    select: (res) => res.data,
    enabled: !!employee,
  });

  const { data: cashBankLedgers } = useQuery({
    queryKey: ['cash-bank-ledgers'],
    queryFn: () => ledgersApi.list({ group_system_key: 'cash_account,bank_account', per_page: '100' }),
    select: (res) => res.data.data,
    enabled: !!employee && canEdit,
  });

  useEffect(() => {
    if (cashBankLedgers && cashBankLedgers.length > 0 && !paymentLedgerId) {
      setPaymentLedgerId(cashBankLedgers[0].id);
    }
  }, [cashBankLedgers]);

  const payMutation = useMutation({
    mutationFn: (data: { payment_ledger_id: string; amount: number; advance_date: string; description?: string }) =>
      employeesApi.payAdvance(employee!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-advance-balance', employee?.id] });
      setAmount('');
      setDescription('');
      setAdvanceDate(today);
      toast.success('Advance paid and voucher posted');
    },
    onError: () => toast.error('Failed to post advance'),
  });

  const handlePay = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !paymentLedgerId) return;
    payMutation.mutate({ payment_ledger_id: paymentLedgerId, amount: amt, advance_date: advanceDate, description: description || undefined });
  };

  if (!employee) return null;

  const outstanding = balanceData?.outstanding ?? 0;
  const vouchers = balanceData?.vouchers ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <Wallet className="h-5 w-5 text-amber-500" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">{employee.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Advance Account</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Outstanding balance */}
        <div className={`flex items-center justify-between border-b px-5 py-3 ${outstanding > 0 ? 'border-amber-100 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20' : 'border-gray-100 bg-gray-50 dark:border-gray-700/50 dark:bg-gray-800/60'}`}>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Outstanding Advance</span>
          <span className={`font-mono text-base font-bold ${outstanding > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {balanceLoading ? '…' : formatCurrency(outstanding)}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Pay Advance form */}
          {canEdit && (
            <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Pay Advance</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Amount (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Date *</label>
                    <input
                      type="date"
                      value={advanceDate}
                      onChange={(e) => setAdvanceDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Pay From *</label>
                  <select
                    value={paymentLedgerId}
                    onChange={(e) => setPaymentLedgerId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {(cashBankLedgers ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}{l.group?.name ? ` (${l.group.name})` : ''}
                      </option>
                    ))}
                    {(!cashBankLedgers || cashBankLedgers.length === 0) && (
                      <option value="" disabled>No cash/bank ledgers found</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional note"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                <Button
                  onClick={handlePay}
                  loading={payMutation.isPending}
                  disabled={!amount || parseFloat(amount) <= 0 || !paymentLedgerId}
                  className="w-full"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Pay Advance
                </Button>
              </div>
            </div>
          )}

          {/* Advance history */}
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">History</p>
            {balanceLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : vouchers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No advances recorded yet</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {vouchers.map((v) => (
                  <div key={v.id} className="flex items-start justify-between py-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{v.voucher_number}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(v.voucher_date)}</p>
                      {v.narration && <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{v.narration}</p>}
                    </div>
                    <span className="ml-4 whitespace-nowrap font-semibold text-amber-700 dark:text-amber-400">
                      {formatCurrency(v.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
