<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $period = $request->query('period', 'today');
        $companyId = $request->user()->company_id;
        $range = $this->getDateRange($period);

        $salesTotal = SalesInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$range['from'], $range['to']])
            ->sum('grand_total');

        $purchaseTotal = PurchaseInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$range['from'], $range['to']])
            ->sum('grand_total');

        $pnl = $salesTotal - $purchaseTotal;

        return response()->json([
            'data' => [
                'period' => $period,
                'from' => $range['from']->toDateString(),
                'to' => $range['to']->toDateString(),
                'total_sales' => round((float) $salesTotal, 2),
                'total_purchase' => round((float) $purchaseTotal, 2),
                'pnl' => round((float) $pnl, 2),
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
