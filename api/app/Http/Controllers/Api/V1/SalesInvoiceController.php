<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Godown;
use App\Models\SalesInvoice;
use App\Models\StockLedger;
use App\Services\AccountingService;
use App\Services\InvoicePdfService;
use App\Traits\FiltersByFinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SalesInvoiceController extends Controller
{
    use FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', SalesInvoice::class);

        $query = SalesInvoice::with('party', 'branch')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('invoice_number', 'like', "%{$s}%"));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'invoice_number' => $query->orderBy('sales_invoices.invoice_number', $sortOrder),
                'customer' => $query->join('parties', 'sales_invoices.party_id', '=', 'parties.id')->orderBy('parties.name', $sortOrder),
                'invoice_date' => $query->orderBy('sales_invoices.invoice_date', $sortOrder),
                'grand_total' => $query->orderBy('sales_invoices.grand_total', $sortOrder),
                'balance_due' => $query->orderBy('sales_invoices.balance_due', $sortOrder),
                'status' => $query->orderBy('sales_invoices.status', $sortOrder),
                default => $query->latest('sales_invoices.invoice_date'),
            };
        } else {
            $query->latest('sales_invoices.invoice_date');
        }

        $this->applyFYFilter($query, $request, 'sales_invoices.invoice_date');

        $invoices = $query->paginate($request->per_page ?? 25);

        return response()->json($invoices);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', SalesInvoice::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'sales_order_id' => 'nullable|uuid|exists:sales_orders,id',
            'invoice_number' => 'required|string|unique:sales_invoices',
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

            $invoice = SalesInvoice::create([
                ...$validated,
                'created_by' => $request->user()->id,
                'updated_by' => null,
            ]);

            foreach ($validated['lines'] as $line) {
                $taxable = ($line['quantity'] * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $invoice->lines()->create([
                    ...$line,
                    'taxable_amount' => $taxable,
                    'cgst' => $isInterState ? 0 : $gstAmt / 2,
                    'sgst' => $isInterState ? 0 : $gstAmt / 2,
                    'igst' => $isInterState ? $gstAmt : 0,
                    'line_total' => $taxable + $gstAmt,
                    'created_by' => $request->user()->id,
                    'updated_by' => null,
                ]);

                // Stock ledger entry (stock out)
                StockLedger::create([
                    'company_id' => $request->user()->company_id,
                    'item_id' => $line['item_id'],
                    'batch_id' => $line['batch_id'] ?? null,
                    'godown_id' => $line['godown_id'],
                    'type' => 'sale',
                    'reference_type' => SalesInvoice::class,
                    'reference_id' => $invoice->id,
                    'quantity' => -$line['quantity'],
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

            // Auto-post journal entry for sales
            $invoice->refresh();
            app(AccountingService::class)->postSalesInvoice($invoice, $request->user()->id);

            return $invoice->load('lines.item', 'party');
        });

        return response()->json(['data' => $invoice], 201);
    }

    public function show(SalesInvoice $salesInvoice): JsonResponse
    {
        $this->authorize('view', $salesInvoice);

        return response()->json([
            'data' => $salesInvoice->load('lines.item', 'lines.batch', 'party', 'branch', 'godown'),
        ]);
    }

    public function update(Request $request, SalesInvoice $salesInvoice): JsonResponse
    {
        $this->authorize('update', $salesInvoice);

        if ($salesInvoice->status !== 'draft') {
            return response()->json(['message' => 'Only draft invoices can be edited'], 422);
        }

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'sales_order_id' => 'nullable|uuid|exists:sales_orders,id',
            'invoice_number' => ['required', 'string', Rule::unique('sales_invoices', 'invoice_number')->ignore($salesInvoice->id)],
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

        $salesInvoice = DB::transaction(function () use ($validated, $salesInvoice, $request) {
            $isInterState = $validated['is_inter_state'] ?? false;

            $salesInvoice->update([
                'party_id' => $validated['party_id'],
                'branch_id' => $validated['branch_id'] ?? null,
                'sales_order_id' => $validated['sales_order_id'] ?? null,
                'invoice_number' => $validated['invoice_number'],
                'invoice_date' => $validated['invoice_date'],
                'due_date' => $validated['due_date'] ?? null,
                'is_inter_state' => $isInterState,
                'notes' => $validated['notes'] ?? null,
                'updated_by' => $request->user()->id,
            ]);

            $salesInvoice->lines()->delete();
            StockLedger::where('reference_type', SalesInvoice::class)
                ->where('reference_id', $salesInvoice->id)
                ->delete();

            foreach ($validated['lines'] as $line) {
                $taxable = ($line['quantity'] * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $salesInvoice->lines()->create([
                    ...$line,
                    'taxable_amount' => $taxable,
                    'cgst' => $isInterState ? 0 : $gstAmt / 2,
                    'sgst' => $isInterState ? 0 : $gstAmt / 2,
                    'igst' => $isInterState ? $gstAmt : 0,
                    'line_total' => $taxable + $gstAmt,
                    'created_by' => $request->user()->id,
                    'updated_by' => null,
                ]);

                StockLedger::create([
                    'company_id' => $request->user()->company_id,
                    'item_id' => $line['item_id'],
                    'batch_id' => $line['batch_id'] ?? null,
                    'godown_id' => $line['godown_id'] ?? null,
                    'type' => 'sale',
                    'reference_type' => SalesInvoice::class,
                    'reference_id' => $salesInvoice->id,
                    'quantity' => -$line['quantity'],
                    'rate' => $line['rate'],
                    'value' => $line['quantity'] * $line['rate'],
                    'created_by' => $request->user()->id,
                ]);
            }

            $salesInvoice->load('lines');

            $salesInvoice->update([
                'total_amount' => $salesInvoice->lines->sum('taxable_amount'),
                'taxable_amount' => $salesInvoice->lines->sum('taxable_amount'),
                'cgst_total' => $salesInvoice->lines->sum('cgst'),
                'sgst_total' => $salesInvoice->lines->sum('sgst'),
                'igst_total' => $salesInvoice->lines->sum('igst'),
                'grand_total' => $salesInvoice->lines->sum('line_total'),
                'balance_due' => $salesInvoice->lines->sum('line_total'),
            ]);

            return $salesInvoice->load('lines.item', 'party', 'branch');
        });

        return response()->json(['data' => $salesInvoice]);
    }

    /**
     * Update Sales Invoice status with business logic.
     *
     * Allowed transitions:
     *   draft → confirmed | cancelled
     *   confirmed → cancelled
     *
     * On confirm: creates stock ledger entries (stock OUT) for each line.
     */
    public function updateStatus(Request $request, SalesInvoice $salesInvoice): JsonResponse
    {
        $this->authorize('update', $salesInvoice);

        $validated = $request->validate([
            'status' => 'required|in:draft,confirmed,cancelled',
        ]);

        $newStatus = $validated['status'];
        $currentStatus = $salesInvoice->status;

        $allowedTransitions = [
            'draft' => ['confirmed', 'cancelled'],
            'confirmed' => ['cancelled'],
            'cancelled' => [],
        ];

        if (! in_array($newStatus, $allowedTransitions[$currentStatus] ?? [])) {
            throw ValidationException::withMessages([
                'status' => ["Cannot change status from '{$currentStatus}' to '{$newStatus}'."],
            ]);
        }

        $result = DB::transaction(function () use ($salesInvoice, $newStatus, $request) {
            $salesInvoice->update([
                'status' => $newStatus,
                'updated_by' => $request->user()->id,
            ]);

            // On confirm → create stock ledger entries (stock out) + journal entry
            if ($newStatus === 'confirmed') {
                $salesInvoice->loadMissing('lines');

                $defaultGodown = Godown::where('company_id', $salesInvoice->company_id)
                    ->where('is_default', true)
                    ->first();

                foreach ($salesInvoice->lines as $line) {
                    StockLedger::create([
                        'company_id' => $salesInvoice->company_id,
                        'item_id' => $line->item_id,
                        'batch_id' => $line->batch_id ?? null,
                        'godown_id' => $line->godown_id ?? $defaultGodown?->id,
                        'type' => 'sale',
                        'reference_type' => SalesInvoice::class,
                        'reference_id' => $salesInvoice->id,
                        'quantity' => -$line->quantity,
                        'rate' => $line->rate,
                        'value' => $line->quantity * $line->rate,
                        'narration' => "Invoice #{$salesInvoice->invoice_number} confirmed",
                        'created_by' => $request->user()->id,
                    ]);
                }

                // Auto-post journal entry
                $salesInvoice->refresh();
                app(AccountingService::class)->postSalesInvoice($salesInvoice, $request->user()->id);
            }

            // On cancel → reverse stock if previously confirmed
            if ($newStatus === 'cancelled' && $currentStatus === 'confirmed') {
                $salesInvoice->loadMissing('lines');

                $defaultGodown = Godown::where('company_id', $salesInvoice->company_id)
                    ->where('is_default', true)
                    ->first();

                foreach ($salesInvoice->lines as $line) {
                    StockLedger::create([
                        'company_id' => $salesInvoice->company_id,
                        'item_id' => $line->item_id,
                        'batch_id' => $line->batch_id ?? null,
                        'godown_id' => $line->godown_id ?? $defaultGodown?->id,
                        'type' => 'sale_reversal',
                        'reference_type' => SalesInvoice::class,
                        'reference_id' => $salesInvoice->id,
                        'quantity' => $line->quantity,
                        'rate' => $line->rate,
                        'value' => $line->quantity * $line->rate,
                        'narration' => "Reversal: Invoice #{$salesInvoice->invoice_number} cancelled",
                        'created_by' => $request->user()->id,
                    ]);
                }
            }

            return $salesInvoice->load('lines.item', 'party', 'branch');
        });

        return response()->json([
            'data' => $result,
            'message' => "Sales invoice status changed to '{$newStatus}'.",
        ]);
    }

    /**
     * Generate and download PDF for a sales invoice.
     */
    public function pdf(Request $request, SalesInvoice $salesInvoice)
    {
        $this->authorize('view', $salesInvoice);

        $templateSlug = $request->query('template');

        $service = app(InvoicePdfService::class);
        $pdf = $service->generate($salesInvoice, $templateSlug);

        // Mark as printed on first download
        if (! $salesInvoice->is_printed) {
            $salesInvoice->update(['is_printed' => true]);
        }

        $filename = "Invoice-{$salesInvoice->invoice_number}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Return rendered HTML for a sales invoice (for browser print).
     */
    public function html(Request $request, SalesInvoice $salesInvoice)
    {
        $this->authorize('view', $salesInvoice);

        $templateSlug = $request->query('template');
        $paperSize = $request->query('paper_size');

        $service = app(InvoicePdfService::class);
        $html = $service->generateHtml($salesInvoice, $templateSlug, $paperSize);

        // Mark as printed on first view
        if (! $salesInvoice->is_printed) {
            $salesInvoice->update(['is_printed' => true]);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=utf-8',
        ]);
    }

    public function destroy(SalesInvoice $salesInvoice): JsonResponse
    {
        $this->authorize('delete', $salesInvoice);

        if ($salesInvoice->status !== 'draft') {
            return response()->json(['message' => 'Only draft invoices can be deleted'], 422);
        }

        $salesInvoice->delete();

        return response()->json(['message' => 'Sales invoice deleted']);
    }
}
