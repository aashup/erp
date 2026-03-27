<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FinancialYear;
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

        $pnl = $salesTotal - $purchaseTotal;

        return response()->json([
            'data' => [
                'period' => $period,
                'from' => $range['from']->toDateString(),
                'to' => $range['to']->toDateString(),
                'total_sales' => round((float) $salesTotal, 2),
                'total_purchase' => round((float) $purchaseTotal, 2),
                'pnl' => round((float) $pnl, 2),
                'net_revenue' => round($netRevenue, 2),
                'gst_output' => round($gstOutput, 2),
                'gst_input_credit' => round($gstInputCredit, 2),
                'payable_tax' => round($payableTax, 2),
            ],
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
