import type { SalesInvoice, SalesInvoiceLine, Company } from '@/types';

export interface ThermalRenderOptions {
  paperSize: '2inch' | '3inch';
}

// ── Private helpers ───────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Matches PHP number_format($value, $decimals) — Western thousands separator */
function fmt(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ── Number to Words (Indian system) — port of NumberToWords.php ───────────────

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function intToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + intToWords(Math.abs(n));

  let words = '';

  if (n >= 10_000_000) {
    words += intToWords(Math.floor(n / 10_000_000)) + ' Crore ';
    n %= 10_000_000;
  }
  if (n >= 100_000) {
    words += intToWords(Math.floor(n / 100_000)) + ' Lakh ';
    n %= 100_000;
  }
  if (n >= 1_000) {
    words += intToWords(Math.floor(n / 1_000)) + ' Thousand ';
    n %= 1_000;
  }
  if (n >= 100) {
    words += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n > 0) {
    if (n < 20) {
      words += ONES[n];
    } else {
      words += TENS[Math.floor(n / 10)];
      if (n % 10 > 0) words += ' ' + ONES[n % 10];
    }
  }

  return words.trim();
}

function numberToWords(amount: number): string {
  const abs = Math.round(Math.abs(amount) * 100) / 100;
  const rupees = Math.floor(abs);
  const paisa = Math.round((abs - rupees) * 100);

  const rupeesWords = rupees > 0 ? intToWords(rupees) + ' Rupees' : 'Zero Rupees';
  const paisaWords = paisa > 0 ? intToWords(paisa) + ' Paisa' : 'Zero Paisa';
  const prefix = amount < 0 ? 'Minus ' : '';

  return prefix + rupeesWords + ' And ' + paisaWords + ' Only';
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildItemsTable(lines: SalesInvoiceLine[]): string {
  const rows = lines.map((line: SalesInvoiceLine) => {
    const name = escapeHtml(line.item?.name ?? 'Item');
    const qty = fmt(Number(line.quantity), 2);
    const rate = fmt(Number(line.rate), 0);
    const total = fmt(Number(line.line_total), 0);
    return `<tr style="border-bottom: 1px dotted #ccc;">
        <td style="text-align: left; padding: 2px; font-size: 9px; font-weight: bold;">${name}</td>
        <td style="text-align: center; padding: 2px; font-size: 9px;">${qty}</td>
        <td style="text-align: right; padding: 2px; font-size: 9px;">${rate}</td>
        <td style="text-align: right; padding: 2px; font-size: 9px;">${total}</td>
      </tr>`;
  }).join('');

  return `<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
    <thead>
      <tr style="border-bottom: 1px dashed #000;">
        <th style="text-align: left; padding: 2px; font-size: 9px;">Item</th>
        <th style="text-align: center; padding: 2px; font-size: 9px;">Qty</th>
        <th style="text-align: right; padding: 2px; font-size: 9px;">Rate</th>
        <th style="text-align: right; padding: 2px; font-size: 9px;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildGstSummary(invoice: SalesInvoice): string {
  const row = (label: string, value: number) =>
    `<div style="display: flex; justify-content: space-between; font-size: 9px; margin: 2px 0;">
      <span>${label}:</span>
      <span>${fmt(value, 0)}</span>
    </div>`;

  const rows: string[] = [];
  if (Number(invoice.cgst_total) > 0) rows.push(row('CGST', Number(invoice.cgst_total)));
  if (Number(invoice.sgst_total) > 0) rows.push(row('SGST', Number(invoice.sgst_total)));
  if (Number(invoice.igst_total) > 0) rows.push(row('IGST', Number(invoice.igst_total)));

  return `<div style="margin: 10px 0; border-top: 1px dashed #000; padding-top: 5px;">${rows.join('')}</div>`;
}

// ── Conditional processing ────────────────────────────────────────────────────

/**
 * Process {{-- comments --}} and {{#if variable}}...{{/if}} blocks.
 * Iterates until stable so nested ifs are resolved inside-out.
 */
function processConditionals(html: string, truthyMap: Record<string, boolean>): string {
  // Strip {{-- Blade-style comments --}}
  html = html.replace(/\{\{--[\s\S]*?--\}\}/g, '');

  // Resolve {{#if var}}...{{/if}} blocks, innermost first, until none remain
  const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  let prev = '';
  while (prev !== html) {
    prev = html;
    html = html.replace(ifRegex, (_match, variable: string, content: string) => {
      return truthyMap[variable] ? content : '';
    });
  }

  return html;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Replace all {{variable}} tokens in a thermal template HTML string with real
 * invoice data. Also handles {{#if var}}...{{/if}} conditionals and
 * {{-- comments --}}. Mirrors ThermalTemplateRenderer.php — no library needed.
 */
export function render(
  templateHtml: string,
  invoice: SalesInvoice,
  company: Company,
  options: ThermalRenderOptions,
): string {
  const grandTotal = Number(invoice.grand_total);
  const roundedTotal = Math.round(grandTotal);
  const roundOff = roundedTotal - grandTotal;

  const party = invoice.party;
  const lines = invoice.lines ?? [];

  const itemsTableHtml = buildItemsTable(lines);
  const gstSummaryHtml = buildGstSummary(invoice);

  // Truthy map used by {{#if variable}} conditionals
  const truthyMap: Record<string, boolean> = {
    company_name:    !!(company.name),
    company_gstin:   !!(company.gstin),
    company_address: !!(company.address),
    company_phone:   !!(company.phone),
    company_email:   !!(company.email),
    customer_name:   !!(party?.name),
    customer_gstin:  !!(party?.gstin),
    customer_address:!!(party?.address),
    customer_city:   !!(party?.city),
    customer_phone:  !!(party?.phone),
    cgst_total:      Number(invoice.cgst_total) > 0,
    sgst_total:      Number(invoice.sgst_total) > 0,
    igst_total:      Number(invoice.igst_total) > 0,
    round_off:       roundOff !== 0,
    round_off_raw:   roundOff !== 0,
    balance_due:     Number(invoice.balance_due) > 0,
    balance_due_raw: Number(invoice.balance_due) > 0,
  };

  // Step 1: strip comments and resolve conditionals
  let html = processConditionals(templateHtml, truthyMap);

  // Step 2: replace all {{variable}} tokens
  const variables: Record<string, string> = {
    '{{company_name}}': company.name ?? '',
    '{{company_gstin}}': company.gstin ?? '',
    '{{company_address}}': company.address ?? '',
    '{{company_phone}}': company.phone ?? '',
    '{{company_email}}': company.email ?? '',
    '{{invoice_number}}': invoice.invoice_number ?? '',
    '{{invoice_date}}': invoice.invoice_date ?? '',
    '{{invoice_date_formatted}}': invoice.invoice_date
      ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        })
      : '',
    '{{customer_name}}': party?.name ?? '',
    '{{customer_gstin}}': party?.gstin ?? '',
    '{{customer_address}}': party?.address ?? '',
    '{{customer_city}}': party?.city ?? '',
    '{{customer_phone}}': party?.phone ?? '',
    '{{subtotal}}': fmt(Number(invoice.total_amount), 2),
    '{{subtotal_raw}}': String(invoice.total_amount),
    '{{cgst_total}}': fmt(Number(invoice.cgst_total), 2),
    '{{cgst_total_raw}}': String(invoice.cgst_total),
    '{{sgst_total}}': fmt(Number(invoice.sgst_total), 2),
    '{{sgst_total_raw}}': String(invoice.sgst_total),
    '{{igst_total}}': fmt(Number(invoice.igst_total), 2),
    '{{igst_total_raw}}': String(invoice.igst_total),
    '{{round_off}}': fmt(roundOff, 2),
    '{{round_off_raw}}': String(roundOff),
    '{{grand_total}}': fmt(roundedTotal, 2),
    '{{grand_total_raw}}': String(roundedTotal),
    '{{balance_due}}': fmt(Number(invoice.balance_due), 2),
    '{{balance_due_raw}}': String(invoice.balance_due),
    '{{amount_in_words}}': numberToWords(roundedTotal),
    '{{items_table}}': itemsTableHtml,
    '{{items_list}}': itemsTableHtml,
    '{{gst_summary}}': gstSummaryHtml,
    '{{paper_width}}': options.paperSize === '3inch' ? '80mm' : '58mm',
  };

  return Object.entries(variables).reduce(
    (h, [token, value]) => h.replaceAll(token, value),
    html,
  );
}

/**
 * Open a browser print window with rendered thermal HTML.
 * Width matches physical paper: 3inch → 380px, 2inch → 300px.
 */
export function openThermalPrintWindow(
  html: string,
  paperSize: '2inch' | '3inch',
  autoPrint = true,
): Window | null {
  const winWidth = paperSize === '3inch' ? 380 : 300;
  const win = window.open('', '_blank', `width=${winWidth},height=650`);
  if (!win) return null;

  win.document.write(html);
  win.document.close();

  if (autoPrint) {
    win.onload = () => { win.focus(); win.print(); };
  }

  return win;
}
