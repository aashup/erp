import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function calcGST(amount: number, rate: number, isInterState: boolean) {
  const gstAmount = (amount * rate) / 100;
  if (isInterState) {
    return { igst: gstAmount, cgst: 0, sgst: 0 };
  }
  return { igst: 0, cgst: gstAmount / 2, sgst: gstAmount / 2 };
}

/**
 * Round-off rule: fraction > 0.6 → ceil, otherwise → floor.
 * Returns roundOff (signed difference) and netPayable (whole number).
 * Examples: 143.68 → netPayable=144, roundOff=+0.32
 *           100.45 → netPayable=100, roundOff=-0.45
 */
export function calcRoundOff(total: number): { roundOff: number; netPayable: number } {
  const fraction = Math.round((total - Math.floor(total)) * 100) / 100;
  const netPayable = fraction > 0.6 ? Math.ceil(total) : Math.floor(total);
  return { roundOff: +(netPayable - total).toFixed(2), netPayable };
}
