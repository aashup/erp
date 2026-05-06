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

export function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateToUtcIso(dateStr: string): string {
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${dateStr}T00:00:00${sign}${hh}:${mm}`;
}

export function apiDateToLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
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

export function fyDateBounds(fy: { start_date: string; end_date: string }): { start: string; end: string } {
  return {
    start: fy.start_date.split('T')[0],
    end: fy.end_date.split('T')[0],
  };
}

type Period = 'today' | 'this_week' | 'this_month' | 'this_year';

/**
 * Converts a dashboard period to an explicit ISO date range.
 * - today/this_week/this_month are relative to `selectedDate` (from useDateStore)
 * - this_year uses the selected FY bounds (not calendar year)
 */
export function periodToDateRange(
  period: Period,
  selectedDate: string,
  fy?: { start_date: string; end_date: string } | null,
): { date_from: string; date_to: string } {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Parse as local midnight to avoid UTC-shift when constructing from YYYY-MM-DD
  const d = new Date(selectedDate + 'T00:00:00');

  switch (period) {
    case 'today':
      return { date_from: selectedDate, date_to: selectedDate };

    case 'this_week': {
      const diffToMon = (d.getDay() + 6) % 7; // 0 = already Monday
      const mon = new Date(d);
      mon.setDate(d.getDate() - diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { date_from: fmt(mon), date_to: fmt(sun) };
    }

    case 'this_month': {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { date_from: fmt(first), date_to: fmt(last) };
    }

    case 'this_year': {
      if (fy) {
        const { start, end } = fyDateBounds(fy);
        return { date_from: start, date_to: end };
      }
      return {
        date_from: `${d.getFullYear()}-01-01`,
        date_to: `${d.getFullYear()}-12-31`,
      };
    }
  }
}
