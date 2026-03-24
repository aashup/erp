<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SalesOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalesOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', SalesOrder::class);

        $orders = SalesOrder::with('party', 'branch')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('so_number', 'like', "%{$s}%"))
            ->latest('so_date')
            ->paginate($request->per_page ?? 25);

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', SalesOrder::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'so_number' => 'required|string|unique:sales_orders',
            'so_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date|after_or_equal:so_date',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.item_id' => 'required|uuid|exists:items,id',
            'lines.*.quantity' => 'required|numeric|min:0.001',
            'lines.*.rate' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate' => 'required|numeric|min:0',
        ]);

        $so = DB::transaction(function () use ($validated, $request) {
            $so = SalesOrder::create([
                ...$validated,
                'created_by' => $request->user()->id,
            ]);

            foreach ($validated['lines'] as $line) {
                $taxable = ($line['quantity'] * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $so->lines()->create([
                    ...$line,
                    'taxable_amount' => $taxable,
                    'cgst' => $gstAmt / 2,
                    'sgst' => $gstAmt / 2,
                    'igst' => 0,
                    'line_total' => $taxable + $gstAmt,
                ]);
            }

            $so->update([
                'total_amount' => $so->lines->sum('taxable_amount'),
                'gst_amount' => $so->lines->sum('cgst') + $so->lines->sum('sgst') + $so->lines->sum('igst'),
                'grand_total' => $so->lines->sum('line_total'),
            ]);

            return $so->load('lines.item');
        });

        return response()->json(['data' => $so], 201);
    }

    public function show(SalesOrder $salesOrder): JsonResponse
    {
        $this->authorize('view', $salesOrder);

        return response()->json(['data' => $salesOrder->load('lines.item', 'party', 'branch')]);
    }

    public function update(Request $request, SalesOrder $salesOrder): JsonResponse
    {
        $this->authorize('update', $salesOrder);

        if ($salesOrder->status !== 'draft') {
            return response()->json(['message' => 'Only draft SOs can be edited'], 422);
        }

        $validated = $request->validate([
            'party_id' => 'sometimes|uuid|exists:parties,id',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'status' => 'sometimes|in:draft,confirmed,cancelled',
        ]);

        $salesOrder->update($validated);

        return response()->json(['data' => $salesOrder]);
    }

    public function destroy(SalesOrder $salesOrder): JsonResponse
    {
        $this->authorize('delete', $salesOrder);

        if ($salesOrder->status !== 'draft') {
            return response()->json(['message' => 'Only draft SOs can be deleted'], 422);
        }

        $salesOrder->delete();

        return response()->json(['message' => 'Sales order deleted']);
    }
}
