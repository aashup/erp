<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FinancialYear;
use App\Models\Ledger;
use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $period = $request->query('period', 'today');
        $companyId = $request->user()->company_id;
        $range = $this->getDateRange($period);

        // If financial_year_id is provided, clamp the range to the FY boundaries
        if ($request->financial_year_id) {
            $fy = FinancialYear::find($request->financial_year_id);
            if ($fy) {
                $fyStart = Carbon::parse($fy->start_date)->startOfDay();
                $fyEnd = Carbon::parse($fy->end_date)->endOfDay();
                // Clamp: only show data within both the period AND the FY
                if ($range['from']->lt($fyStart)) {
                    $range['from'] = $fyStart;
                }
                if ($range['to']->gt($fyEnd)) {
                    $range['to'] = $fyEnd;
                }
            }
        }

        $salesTotal = SalesInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$range['from'], $range['to']])
            ->sum('grand_total');

        $purchaseTotal = PurchaseInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$range['from'], $range['to']])
            ->sum('grand_total');

        $confirmedSales = SalesInvoice::query()
            ->where('company_id', $companyId)
            ->where('status', 'confirmed')
            ->whereBetween('invoice_date', [$range['from'], $range['to']]);

        $confirmedPurchases = PurchaseInvoice::query()
            ->where('company_id', $companyId)
            ->where('status', 'confirmed')
            ->whereBetween('invoice_date', [$range['from'], $range['to']]);

        $netRevenue = (float) $confirmedSales->sum('taxable_amount');
        $gstOutput = (float) $confirmedSales->sum(DB::raw('cgst_total + sgst_total + igst_total'));
        $gstInputCredit = (float) $confirmedPurchases->sum(DB::raw('cgst_total + sgst_total + igst_total'));
        $payableTax = $gstOutput - $gstInputCredit;

        // ── P&L from journal lines (matches P&L report exactly) ────────────────
        // Income ledgers: amount = net credit (credit − debit)
        // Expense ledgers: amount = net debit (debit − credit)
        $pnlLedgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereHas('group', fn ($q) => $q->whereIn('type', ['income', 'expense']))
            ->whereNull('deleted_at')
            ->get();

        $pnlIncome  = 0.0;
        $pnlExpense = 0.0;

        if ($pnlLedgers->isNotEmpty()) {
            $journalTotals = DB::table('voucher_lines')
                ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
                ->where('vouchers.company_id', $companyId)
                ->where('vouchers.is_posted', true)
                ->whereIn('voucher_lines.ledger_id', $pnlLedgers->pluck('id'))
                ->whereDate('vouchers.voucher_date', '>=', $range['from']->toDateString())
                ->whereDate('vouchers.voucher_date', '<=', $range['to']->toDateString())
                ->select(
                    'voucher_lines.ledger_id',
                    DB::raw('SUM(voucher_lines.debit) as total_debit'),
                    DB::raw('SUM(voucher_lines.credit) as total_credit')
                )
                ->groupBy('voucher_lines.ledger_id')
                ->get()
                ->keyBy('ledger_id');

            foreach ($pnlLedgers as $ledger) {
                $txn    = $journalTotals[$ledger->id] ?? null;
                $debit  = (float) ($txn->total_debit ?? 0);
                $credit = (float) ($txn->total_credit ?? 0);

                if ($ledger->group?->type === 'income') {
                    $pnlIncome  += $credit - $debit;
                } else {
                    $pnlExpense += $debit - $credit;
                }
            }
        }

        // ── Stock valuation: SUM(qty) × purchase_price (matches P&L report) ──
        // We use quantity × cost price, NOT the value column, because sales entries
        // store selling price in value — using value would overstate closing stock.
        $stockValue = function (?string $beforeDate, ?string $upToDate) use ($companyId): float {
            $q = DB::table('stock_ledger')->where('company_id', $companyId);
            if ($beforeDate) {
                $q->whereDate('created_at', '<', $beforeDate);
            } elseif ($upToDate) {
                $q->whereDate('created_at', '<=', $upToDate);
            }
            $rows = $q->select('item_id', DB::raw('SUM(quantity) as total_qty'))
                ->groupBy('item_id')
                ->havingRaw('SUM(quantity) > 0')
                ->get();
            if ($rows->isEmpty()) {
                return 0.0;
            }
            $prices = DB::table('items')
                ->whereIn('id', $rows->pluck('item_id'))
                ->pluck('purchase_price', 'id');
            $val = 0.0;
            foreach ($rows as $row) {
                $val += (float) $row->total_qty * (float) ($prices[$row->item_id] ?? 0);
            }
            return $val;
        };

        $openingStock = $stockValue($range['from']->toDateString(), null);
        $closingStock = $stockValue(null, $range['to']->toDateString());

        // Net P&L = Income − Expense + Closing Stock − Opening Stock
        $pnl = $pnlIncome - $pnlExpense + $closingStock - $openingStock;

        return response()->json([
            'data' => [
                'period'          => $period,
                'from'            => $range['from']->toDateString(),
                'to'              => $range['to']->toDateString(),
                'total_sales'     => round((float) $salesTotal, 2),
                'total_purchase'  => round((float) $purchaseTotal, 2),
                'pnl_income'      => round($pnlIncome, 2),
                'pnl_expense'     => round($pnlExpense, 2),
                'opening_stock'   => round($openingStock, 2),
                'closing_stock'   => round($closingStock, 2),
                'pnl'             => round($pnl, 2),
                'net_revenue'     => round($netRevenue, 2),
                'gst_output'      => round($gstOutput, 2),
                'gst_input_credit' => round($gstInputCredit, 2),
                'payable_tax'     => round($payableTax, 2),
            ],
        ]);
    }

    public function chart(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $months = (int) $request->query('months', 12);
        $months = min(max($months, 3), 24);

        // Build the last N months range
        $end = Carbon::today()->endOfMonth();
        $start = Carbon::today()->subMonths($months - 1)->startOfMonth();

        // Clamp to financial year if provided
        if ($request->financial_year_id) {
            $fy = FinancialYear::find($request->financial_year_id);
            if ($fy) {
                $fyStart = Carbon::parse($fy->start_date)->startOfMonth();
                $fyEnd = Carbon::parse($fy->end_date)->endOfMonth();
                if ($start->lt($fyStart)) {
                    $start = $fyStart;
                }
                if ($end->gt($fyEnd)) {
                    $end = $fyEnd;
                }
            }
        }

        $salesByMonth = SalesInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$start, $end])
            ->selectRaw("DATE_FORMAT(invoice_date, '%Y-%m') as month, SUM(grand_total) as total, SUM(taxable_amount) as revenue")
            ->groupBy('month')
            ->pluck('total', 'month')
            ->toArray();

        $revenueByMonth = SalesInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$start, $end])
            ->selectRaw("DATE_FORMAT(invoice_date, '%Y-%m') as month, SUM(taxable_amount) as revenue")
            ->groupBy('month')
            ->pluck('revenue', 'month')
            ->toArray();

        $purchaseByMonth = PurchaseInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$start, $end])
            ->selectRaw("DATE_FORMAT(invoice_date, '%Y-%m') as month, SUM(grand_total) as total")
            ->groupBy('month')
            ->pluck('total', 'month')
            ->toArray();

        // Build ordered labels and data arrays
        $labels = [];
        $sales = [];
        $purchase = [];
        $revenue = [];
        $cursor = $start->copy();

        while ($cursor->lte($end)) {
            $key = $cursor->format('Y-m');
            $labels[] = $cursor->format('M Y'); // e.g. "Apr 2026"
            $sales[] = round((float) ($salesByMonth[$key] ?? 0), 2);
            $purchase[] = round((float) ($purchaseByMonth[$key] ?? 0), 2);
            $revenue[] = round((float) ($revenueByMonth[$key] ?? 0), 2);
            $cursor->addMonth();
        }

        return response()->json([
            'data' => compact('labels', 'sales', 'purchase', 'revenue'),
        ]);
    }

    private function getDateRange(string $period): array
    {
        $now = Carbon::today();

        return match ($period) {
            'today' => [
                'from' => $now->copy()->startOfDay(),
                'to' => $now->copy()->endOfDay(),
            ],
            'this_week' => [
                'from' => $now->copy()->startOfWeek(),
                'to' => $now->copy()->endOfWeek(),
            ],
            'this_month' => [
                'from' => $now->copy()->startOfMonth(),
                'to' => $now->copy()->endOfMonth(),
            ],
            'this_year' => [
                'from' => $now->copy()->startOfYear(),
                'to' => $now->copy()->endOfYear(),
            ],
            default => [
                'from' => $now->copy()->startOfDay(),
                'to' => $now->copy()->endOfDay(),
            ],
        };
    }
}
