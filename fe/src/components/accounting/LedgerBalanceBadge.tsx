import { useQuery } from '@tanstack/react-query';
import { ledgersApi } from '@/api/accounting';
import { formatCurrency } from '@/lib/utils';

interface LedgerBalanceBadgeProps {
  ledgerId: string;
}

export function LedgerBalanceBadge({ ledgerId }: LedgerBalanceBadgeProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['ledger-balance', ledgerId],
    queryFn: () => ledgersApi.balance(ledgerId),
    select: (res) => res.data.data,
    enabled: !!ledgerId,
    staleTime: 30_000,
  });

  if (!ledgerId || isLoading || !data) return null;

  return (
    <span
      className={`text-[11px] font-medium ${
        data.balance_type === 'dr'
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-orange-600 dark:text-orange-400'
      }`}
    >
      Bal: {formatCurrency(data.balance)} {data.balance_type.toUpperCase()}
    </span>
  );
}
