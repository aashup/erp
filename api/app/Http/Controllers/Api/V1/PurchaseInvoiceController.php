<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PurchaseInvoice;
use App\Models\StockLedger;
use App\Services\AccountingService;
use App\Traits\FiltersByFinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseInvoiceController extends Controller
{
    use FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', PurchaseInvoice::class);

        $query = PurchaseInvoice::with('party', 'branch')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('invoice_number', 'like', "%{$s}%"))
            ->latest('invoice_date');

        $this->applyFYFilter($query, $request, 'invoice_date');

        $invoices = $query->paginate($request->per_page ?? 25);

        return response()->json($invoices);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', PurchaseInvoice::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'purchase_order_id' => 'nullable|uuid|exists:purchase_orders,id',
            'invoice_number' => 'required|string|unique:purchase_invoices',
            'vendor_invoice_number' => 'nullable|string',
            'invoice_date' => 'required|date',
            'due_date' => 'nullable|date',
            'is_inter_state' => 'boolean',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.item_id' => 'required|uuid|exists:items,id',
            'lines.*.batch_id' => 'nullable|uuid|exists:batches,id',
            'lines.*.quantity' => 'required|numeric|min:0.001',
            'lines.*.rate' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate' => 'required|numeric|min:0',
            'lines.*.godown_id' => 'nullable|uuid|exists:godowns,id',

        ]);

        $invoice = DB::transaction(function () use ($validated, $request) {
            $isInterState = $validated['is_inter_state'] ?? false;

            $invoice = PurchaseInvoice::create([
                ...$validated,
                'created_by' => $request->user()->id,
                'updated_by' => null,
            ]);

            foreach ($validated['lines'] as $line) {
                $taxable = ($line['quantity'] * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $invoiceLine = $invoice->lines()->create([
                    ...$line,
                    'taxable_amount' => $taxable,
                    'cgst' => $isInterState ? 0 : $gstAmt / 2,
                    'sgst' => $isInterState ? 0 : $gstAmt / 2,
                    'igst' => $isInterState ? $gstAmt : 0,
                    'line_total' => $taxable + $gstAmt,
                    'created_by' => $request->user()->id,
                    'updated_by' => null,
                ]);

                // Stock ledger entry
                StockLedger::create([
                    'company_id' => $request->user()->company_id,
                    'item_id' => $line['item_id'],
                    'batch_id' => $line['batch_id'] ?? null,
                    'godown_id' => $line['godown_id'] ?? null,
                    'type' => 'purchase',
                    'reference_type' => PurchaseInvoice::class,
                    'reference_id' => $invoice->id,
                    'quantity' => $line['quantity'],
                    'rate' => $line['rate'],
                    'value' => $line['quantity'] * $line['rate'],
                    'created_by' => $request->user()->id,
                ]);
            }

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
            $invoice->refresh();
            app(AccountingService::class)->postPurchaseInvoice($invoice, $request->user()->id);

            return $invoice->load('lines.item', 'party');
        });

        return response()->json(['data' => $invoice], 201);
    }

    public function show(PurchaseInvoice $purchaseInvoice): JsonResponse
    {
        $this->authorize('view', $purchaseInvoice);

        return response()->json([
            'data' => $purchaseInvoice->load('lines.item', 'lines.batch', 'party', 'branch', 'godown'),
        ]);
    }

    public function update(Request $request, PurchaseInvoice $purchaseInvoice): JsonResponse
    {
        $this->authorize('update', $purchaseInvoice);

        if ($purchaseInvoice->status !== 'draft') {
            return response()->json(['message' => 'Only draft invoices can be edited'], 422);
        }

        $validated = $request->validate([
            'status' => 'sometimes|in:draft,confirmed,cancelled',
            'notes' => 'nullable|string',
        ]);

        $purchaseInvoice->update([
            ...$validated,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $purchaseInvoice]);
    }

    public function destroy(PurchaseInvoice $purchaseInvoice): JsonResponse
    {
        $this->authorize('delete', $purchaseInvoice);

        if ($purchaseInvoice->status !== 'draft') {
            return response()->json(['message' => 'Only draft invoices can be deleted'], 422);
        }

        $purchaseInvoice->delete();

        return response()->json(['message' => 'Purchase invoice deleted']);
    }
}
