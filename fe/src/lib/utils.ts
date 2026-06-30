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

// Converts a local YYYY-MM-DD pair to UTC ISO start/end datetimes using the
// browser's own timezone. No offset is hardcoded — parsing without a timezone
// suffix treats the string as local time, so toISOString() gives the correct UTC.
export function localDateToUtcRange(
  startDate: string,
  endDate: string,
): { date_from: string; date_to: string } {
  return {
    date_from: new Date(startDate + 'T00:00:00').toISOString(),
    date_to:   new Date(endDate   + 'T23:59:59.999').toISOString(),
  };
}

type Period = 'today' | 'this_week' | 'this_month' | 'this_year';

export function periodToDateRange(
  period: Period,
  selectedDate: string,
  fy?: { start_date: string; end_date: string } | null,
): { date_from: string; date_to: string } {
  const d = new Date(selectedDate + 'T00:00:00');

  const localStr = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  switch (period) {
    case 'today':
      return localDateToUtcRange(selectedDate, selectedDate);

    case 'this_week': {
      const diffToMon = (d.getDay() + 6) % 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return localDateToUtcRange(localStr(mon), localStr(sun));
    }

    case 'this_month': {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last  = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return localDateToUtcRange(localStr(first), localStr(last));
    }

    case 'this_year': {
      if (fy) {
        // FY dates in DB are already stored with the IST→UTC day-shift baked in
        // (April 1 IST → stored as 2026-03-31). Appending a UTC suffix directly
        // gives the correct UTC anchor without double-shifting.
        const fyStart = fy.start_date.split('T')[0];
        const fyEnd   = fy.end_date.split('T')[0];
        return {
          date_from: fyStart + 'T00:00:00.000Z',
          date_to:   fyEnd   + 'T23:59:59.999Z',
        };
      }
      return localDateToUtcRange(
        `${d.getFullYear()}-01-01`,
        `${d.getFullYear()}-12-31`,
      );
    }
  }
}
