<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', PurchaseOrder::class);

        $orders = PurchaseOrder::with('party', 'branch')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('po_number', 'like', "%{$s}%"))
            ->latest('po_date')
            ->paginate($request->per_page ?? 25);

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', PurchaseOrder::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'po_number' => 'string|unique:purchase_orders',
            'po_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date|after_or_equal:po_date',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.item_id' => 'required|uuid|exists:items,id',
            'lines.*.quantity' => 'required|numeric|min:0.001',
            'lines.*.rate' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate' => 'required|numeric|min:0',
        ]);

        $po = DB::transaction(function () use ($validated, $request) {
            $po = PurchaseOrder::create([
                ...$validated,
                'created_by' => $request->user()->id,
            ]);

            foreach ($validated['lines'] as $line) {
                $taxable = ($line['quantity'] * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $po->lines()->create([
                    ...$line,
                    'taxable_amount' => $taxable,
                    'cgst' => $gstAmt / 2,
                    'sgst' => $gstAmt / 2,
                    'igst' => 0,
                    'line_total' => $taxable + $gstAmt,
                ]);
            }

            $po->update([
                'total_amount' => $po->lines->sum('taxable_amount'),
                'gst_amount' => $po->lines->sum('cgst') + $po->lines->sum('sgst') + $po->lines->sum('igst'),
                'grand_total' => $po->lines->sum('line_total'),
            ]);

            return $po->load('lines.item');
        });

        return response()->json(['data' => $po], 201);
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorize('view', $purchaseOrder);

        return response()->json(['data' => $purchaseOrder->load('lines.item', 'party', 'branch')]);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorize('update', $purchaseOrder);

        if ($purchaseOrder->status !== 'draft') {
            return response()->json(['message' => 'Only draft POs can be edited'], 422);
        }

        $validated = $request->validate([
            'party_id' => 'sometimes|uuid|exists:parties,id',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'status' => 'sometimes|in:draft,confirmed,cancelled',
        ]);

        $purchaseOrder->update($validated);

        return response()->json(['data' => $purchaseOrder]);
    }

    public function destroy(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorize('delete', $purchaseOrder);

        if ($purchaseOrder->status !== 'draft') {
            return response()->json(['message' => 'Only draft POs can be deleted'], 422);
        }

        $purchaseOrder->delete();

        return response()->json(['message' => 'Purchase order deleted']);
    }
}
