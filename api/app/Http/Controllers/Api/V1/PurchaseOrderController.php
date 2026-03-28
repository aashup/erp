<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Godown;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseOrder;
use App\Models\StockLedger;
use App\Services\AccountingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    use \App\Traits\FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', PurchaseOrder::class);

        $query = PurchaseOrder::with('party', 'branch')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('po_number', 'like', "%{$s}%"))
            ->latest('po_date');

        $this->applyFYFilter($query, $request, 'po_date');

        $orders = $query->paginate($request->per_page ?? 25);

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', PurchaseOrder::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'po_number' => 'nullable|string|unique:purchase_orders',
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
            // Auto-generate PO number if not provided
            if (empty($validated['po_number'])) {
                $validated['po_number'] = 'PO-'.str_pad(
                    PurchaseOrder::withoutGlobalScopes()->count() + 1,
                    6,
                    '0',
                    STR_PAD_LEFT
                );
            }

            $po = PurchaseOrder::create([
                ...$validated,
                'created_by' => $request->user()->id,
                'updated_by' => null,
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
                    'created_by' => $request->user()->id,
                    'updated_by' => null,
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
        ]);

        $purchaseOrder->update([
            ...$validated,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $purchaseOrder]);
    }

    /**
     * Update PO status with business logic.
     *
     * Allowed transitions:
     *   draft → confirmed | cancelled
     *   confirmed → partially_received | received | cancelled
     *   partially_received → received | cancelled
     *
     * On confirm: auto-creates a purchase invoice from PO lines.
     */
    public function updateStatus(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorize('update', $purchaseOrder);

        $validated = $request->validate([
            'status' => 'required|in:draft,confirmed,partially_received,received,cancelled',
        ]);

        $newStatus = $validated['status'];
        $currentStatus = $purchaseOrder->status;

        // Validate allowed transitions
        $allowedTransitions = [
            'draft' => ['confirmed', 'cancelled'],
            'confirmed' => ['partially_received', 'received', 'cancelled'],
            'partially_received' => ['received', 'cancelled'],
            'received' => [],      // terminal
            'cancelled' => [],     // terminal
        ];

        if (! in_array($newStatus, $allowedTransitions[$currentStatus] ?? [])) {
            throw ValidationException::withMessages([
                'status' => ["Cannot change status from '{$currentStatus}' to '{$newStatus}'."],
            ]);
        }

        $result = DB::transaction(function () use ($purchaseOrder, $newStatus, $request) {
            $purchaseOrder->update([
                'status' => $newStatus,
                'updated_by' => $request->user()->id,
            ]);

            // On confirm → auto-create purchase invoice from PO lines
            if ($newStatus === 'confirmed') {
                $this->createInvoiceFromPo($purchaseOrder, $request);
            }

            return $purchaseOrder->load('lines.item', 'party', 'branch', 'purchaseInvoices');
        });

        return response()->json([
            'data' => $result,
            'message' => "Purchase order status changed to '{$newStatus}'.",
        ]);
    }

    /**
     * Auto-create a purchase invoice when PO is confirmed.
     */
    private function createInvoiceFromPo(PurchaseOrder $po, Request $request): PurchaseInvoice
    {
        $po->loadMissing('lines', 'party');

        // Determine inter-state from party vs company state codes
        $companyStateCode = $request->user()->company?->state_code;
        $partyStateCode = $po->party?->state_code;
        $isInterState = $companyStateCode && $partyStateCode && $companyStateCode !== $partyStateCode;

        // Get default godown
        $defaultGodown = Godown::where('company_id', $po->company_id)
            ->where('is_default', true)
            ->first();

        // Generate invoice number
        $invoiceNumber = 'PI-'.str_pad(
            PurchaseInvoice::withoutGlobalScopes()->count() + 1,
            6,
            '0',
            STR_PAD_LEFT
        );

        $invoice = PurchaseInvoice::create([
            'company_id' => $po->company_id,
            'party_id' => $po->party_id,
            'branch_id' => $po->branch_id,
            'purchase_order_id' => $po->id,
            'godown_id' => $defaultGodown?->id,
            'invoice_number' => $invoiceNumber,
            'invoice_date' => now()->toDateString(),
            'is_inter_state' => $isInterState,
            'status' => 'confirmed',
            'created_by' => $request->user()->id,
            'updated_by' => null,
        ]);

        foreach ($po->lines as $poLine) {
            $taxable = $poLine->taxable_amount;
            $gstAmt = $taxable * $poLine->gst_rate / 100;

            $invoice->lines()->create([
                'item_id' => $poLine->item_id,
                'godown_id' => $defaultGodown?->id,
                'quantity' => $poLine->quantity,
                'rate' => $poLine->rate,
                'discount_percent' => $poLine->discount_percent,
                'taxable_amount' => $taxable,
                'gst_rate' => $poLine->gst_rate,
                'cgst' => $isInterState ? 0 : $gstAmt / 2,
                'sgst' => $isInterState ? 0 : $gstAmt / 2,
                'igst' => $isInterState ? $gstAmt : 0,
                'line_total' => $taxable + $gstAmt,
                'created_by' => $request->user()->id,
                'updated_by' => null,
            ]);

            // Stock ledger entry — stock IN
            StockLedger::create([
                'company_id' => $po->company_id,
                'item_id' => $poLine->item_id,
                'godown_id' => $defaultGodown?->id,
                'type' => 'purchase',
                'reference_type' => PurchaseInvoice::class,
                'reference_id' => $invoice->id,
                'quantity' => $poLine->quantity,
                'rate' => $poLine->rate,
                'value' => $poLine->quantity * $poLine->rate,
                'narration' => "Auto from PO #{$po->po_number}",
                'created_by' => $request->user()->id,
            ]);

            // Mark PO line as fully received
            $poLine->update(['received_quantity' => $poLine->quantity]);
        }

        // Update invoice totals
        $invoice->refresh();
        $invoice->update([
            'total_amount' => $invoice->lines->sum('taxable_amount'),
            'taxable_amount' => $invoice->lines->sum('taxable_amount'),
            'cgst_total' => $invoice->lines->sum('cgst'),
            'sgst_total' => $invoice->lines->sum('sgst'),
            'igst_total' => $invoice->lines->sum('igst'),
            'grand_total' => $invoice->lines->sum('line_total'),
            'balance_due' => $invoice->lines->sum('line_total'),
        ]);

        // Auto-post journal entry for purchase
        app(AccountingService::class)->postPurchaseInvoice($invoice, $request->user()->id);

        return $invoice;
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
