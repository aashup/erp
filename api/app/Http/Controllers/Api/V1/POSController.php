<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentCounter;
use App\Models\FinancialYear;
use App\Models\Godown;
use App\Models\Item;
use App\Models\Ledger;
use App\Models\Party;
use App\Models\PaymentReceipt;
use App\Models\SalesInvoice;
use App\Models\StockLedger;
use App\Services\AccountingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class POSController extends Controller
{
    /**
     * Fast item search for POS — returns items with current stock in specified godown.
     */
    public function items(Request $request): JsonResponse
    {
        $godownId = $request->godown_id;

        $items = Item::with(['itemGroup', 'alternateUnits'])
            ->where('is_active', true)
            ->when(
                $request->search,
                fn ($q, $s) => $q->where(fn ($q2) =>
                    $q2->where('name', 'like', "%{$s}%")->orWhere('sku', 'like', "%{$s}%")
                )
            )
            ->when($request->item_group_id, fn ($q, $g) => $q->where('item_group_id', $g))
            ->orderBy('name')
            ->limit(60)
            ->get();

        // Attach current stock per item for the given godown
        $stockQuery = StockLedger::query()
            ->selectRaw('item_id, SUM(quantity) as current_stock')
            ->where('company_id', $request->user()->company_id)
            ->groupBy('item_id');

        if ($godownId) {
            $stockQuery->where('godown_id', $godownId);
        }

        $stockMap = $stockQuery->pluck('current_stock', 'item_id');

        $items->each(function ($item) use ($stockMap) {
            $item->current_stock = (float) ($stockMap[$item->id] ?? 0);
        });

        return response()->json(['data' => $items]);
    }

    /**
     * POS Checkout — atomically create confirmed invoice + payment receipts + journal entries.
     */
    public function checkout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'party_id'             => 'nullable|uuid|exists:parties,id',
            'godown_id'            => 'required|uuid|exists:godowns,id',
            'is_inter_state'       => 'boolean',
            'invoice_date'         => 'required|date',
            'notes'                => 'nullable|string',
            'post_payment'         => 'boolean',
            'amount_tendered'      => 'nullable|numeric|min:0',
            'change_amount'        => 'nullable|numeric|min:0',
            'lines'                => 'required|array|min:1',
            'lines.*.item_id'      => 'required|uuid|exists:items,id',
            'lines.*.batch_id'     => 'nullable|uuid|exists:batches,id',
            'lines.*.quantity'     => 'required|numeric|min:0.001',
            'lines.*.unit'         => 'nullable|string|max:20',
            'lines.*.conversion_factor' => 'nullable|numeric|min:0.0001',
            'lines.*.rate'         => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate'     => 'required|numeric|min:0',
            'round_off'            => 'nullable|numeric',
            'payments'             => 'nullable|array',
            'payments.*.mode'      => 'required_with:payments|in:cash,upi,card,lend',
            'payments.*.amount'    => 'required_with:payments|numeric|min:0.01',
            'payments.*.reference' => 'nullable|string',
        ]);

        $isPostPayment = ! empty($validated['post_payment']);

        // Post payment requires a real registered customer — not Walk-in
        if ($isPostPayment && empty($validated['party_id'])) {
            throw ValidationException::withMessages([
                'party_id' => 'Post payment requires a registered customer to be selected.',
            ]);
        }

        // Normal payment mode requires at least one payment entry
        if (! $isPostPayment && empty($validated['payments'])) {
            throw ValidationException::withMessages([
                'payments' => 'At least one payment is required.',
            ]);
        }

        // Lend mode requires a registered customer
        $hasLend = ! empty($validated['payments']) && collect($validated['payments'])->contains('mode', 'lend');
        if ($hasLend && empty($validated['party_id'])) {
            throw ValidationException::withMessages([
                'party_id' => 'Lend requires a registered customer to be selected.',
            ]);
        }

        // Resolve party BEFORE transaction — PartyObserver creates ledger entries
        // which must not be nested inside the checkout transaction
        $companyId = $request->user()->company_id;
        $userId    = $request->user()->id;
        $partyId   = $validated['party_id'] ?? null;

        if (! $partyId) {
            $walkIn = Party::firstOrCreate(
                ['company_id' => $companyId, 'name' => 'Walk-in Customer', 'type' => 'customer'],
                ['is_active' => true]
            );
            $partyId = $walkIn->id;
        }

        $invoice = DB::transaction(function () use ($validated, $request, $companyId, $userId, $partyId, $isPostPayment) {
            $isInterState = $validated['is_inter_state'] ?? false;

            // Find financial year for invoice date
            $fy = FinancialYear::where('company_id', $companyId)
                ->whereDate('start_date', '<=', $validated['invoice_date'])
                ->whereDate('end_date', '>=', $validated['invoice_date'])
                ->first();

            if (! $fy) {
                throw ValidationException::withMessages(['invoice_date' => 'No financial year found for the selected date']);
            }

            $counter = DocumentCounter::where('company_id', $companyId)
                ->where('financial_year_id', $fy->id)
                ->where('document_type', 'sales_invoice')
                ->first();

            if (! $counter) {
                throw ValidationException::withMessages(['invoice_date' => 'Document counter not initialized for this financial year']);
            }

            $nextNumber    = $counter->getAndIncrementCounter($companyId, $fy->id, 'sales_invoice');
            $invoiceNumber = $counter->prefix . '-' . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);

            // Determine primary payment mode for display
            $primaryMode = $isPostPayment ? 'post' : ($validated['payments'][0]['mode'] ?? 'cash');

            $invoice = SalesInvoice::create([
                'party_id'          => $partyId,
                'godown_id'         => $validated['godown_id'],
                'invoice_number'    => $invoiceNumber,
                'invoice_date'      => $validated['invoice_date'],
                'is_inter_state'    => $isInterState,
                'status'            => 'confirmed',
                'notes'             => $validated['notes'] ?? null,
                'pos_held'          => false,
                'pos_payment_mode'  => $primaryMode,
                'amount_tendered'   => $validated['amount_tendered'] ?? 0,
                'change_amount'     => $validated['change_amount'] ?? 0,
                'created_by'        => $userId,
                'updated_by'        => null,
            ]);

            foreach ($validated['lines'] as $line) {
                $conversionFactor = (float) ($line['conversion_factor'] ?? 1.0);
                $baseQuantity     = $line['quantity'] * $conversionFactor;
                $taxable          = ($line['quantity'] * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt           = $taxable * $line['gst_rate'] / 100;

                $invoice->lines()->create([
                    'item_id'          => $line['item_id'],
                    'batch_id'         => $line['batch_id'] ?? null,
                    'godown_id'        => $validated['godown_id'],
                    'quantity'         => $line['quantity'],
                    'unit'             => $line['unit'] ?? null,
                    'conversion_factor'=> $conversionFactor,
                    'rate'             => $line['rate'],
                    'discount_percent' => $line['discount_percent'] ?? 0,
                    'taxable_amount'   => $taxable,
                    'gst_rate'         => $line['gst_rate'],
                    'cgst'             => $isInterState ? 0 : $gstAmt / 2,
                    'sgst'             => $isInterState ? 0 : $gstAmt / 2,
                    'igst'             => $isInterState ? $gstAmt : 0,
                    'line_total'       => $taxable + $gstAmt,
                    'created_by'       => $userId,
                ]);

                StockLedger::create([
                    'company_id'     => $companyId,
                    'item_id'        => $line['item_id'],
                    'batch_id'       => $line['batch_id'] ?? null,
                    'godown_id'      => $validated['godown_id'],
                    'type'           => 'sale',
                    'reference_type' => SalesInvoice::class,
                    'reference_id'   => $invoice->id,
                    'quantity'       => -$baseQuantity,
                    'rate'           => $line['rate'],
                    'value'          => $baseQuantity * $line['rate'],
                    'narration'      => "POS Sale #{$invoiceNumber}",
                    'created_by'     => $userId,
                ]);
            }

            $invoice->load('lines');
            $grandTotal = $invoice->lines->sum('line_total');
            $roundOff   = (float) ($validated['round_off'] ?? 0);
            $netPayable = round($grandTotal + $roundOff, 2);

            if ($isPostPayment) {
                // Credit sale — no payment collected now; full amount goes to party ledger
                $invoice->update([
                    'total_amount'   => $invoice->lines->sum('taxable_amount'),
                    'taxable_amount' => $invoice->lines->sum('taxable_amount'),
                    'cgst_total'     => $invoice->lines->sum('cgst'),
                    'sgst_total'     => $invoice->lines->sum('sgst'),
                    'igst_total'     => $invoice->lines->sum('igst'),
                    'grand_total'    => $netPayable,
                    'round_off'      => $roundOff,
                    'amount_paid'    => 0,
                    'balance_due'    => $netPayable,
                ]);

                // Post sales journal only (Dr: Party A/c, Cr: Sales + GST)
                // No receipt journal — payment is deferred
                $invoice->refresh();
                app(AccountingService::class)->postSalesInvoice($invoice, $userId);
            } else {
                $allPayments  = collect($validated['payments']);
                $lendPayments = $allPayments->where('mode', 'lend');
                $cashPayments = $allPayments->where('mode', '!=', 'lend');
                $totalPaid    = $cashPayments->sum('amount');
                $lendAmount   = $lendPayments->sum('amount');
                $balanceDue   = max(0, $netPayable - $totalPaid);

                $invoice->update([
                    'total_amount'   => $invoice->lines->sum('taxable_amount'),
                    'taxable_amount' => $invoice->lines->sum('taxable_amount'),
                    'cgst_total'     => $invoice->lines->sum('cgst'),
                    'sgst_total'     => $invoice->lines->sum('sgst'),
                    'igst_total'     => $invoice->lines->sum('igst'),
                    'grand_total'    => $netPayable,
                    'round_off'      => $roundOff,
                    'amount_paid'    => min($totalPaid, $netPayable),
                    'balance_due'    => $balanceDue,
                ]);

                // Auto-post sales journal entry
                $invoice->refresh();
                app(AccountingService::class)->postSalesInvoice($invoice, $userId);

                // Resolve cash and bank ledgers
                $cashLedger = Ledger::findBySystemKey($companyId, 'cash');
                $bankLedger = Ledger::where('company_id', $companyId)
                    ->whereHas('group', fn ($q) => $q->where('system_key', 'bank_account'))
                    ->first();

                // Create receipt-number counter prefix
                $receiptPrefix = 'RCP';
                $receiptBase   = now()->format('ymdHis');
                $receiptIdx    = 0;

                $party = Party::find($partyId);

                foreach ($validated['payments'] as $payment) {
                    // Lend — amount stays in party ledger as balance_due; no receipt voucher
                    if ($payment['mode'] === 'lend') {
                        continue;
                    }

                    // Map mode to ledger: cash/upi → cash; card → bank
                    $modeLedger  = in_array($payment['mode'], ['cash', 'upi']) ? $cashLedger : $bankLedger;
                    $paymentMode = $payment['mode'] === 'card' ? 'bank' : $payment['mode'];

                    $receiptNumber = $receiptPrefix . '-' . $receiptBase . ($receiptIdx > 0 ? "-{$receiptIdx}" : '');
                    $receiptIdx++;

                    $receipt = PaymentReceipt::create([
                        'company_id'       => $companyId,
                        'party_id'         => $partyId,
                        'type'             => 'receipt',
                        'receipt_number'   => $receiptNumber,
                        'receipt_date'     => $validated['invoice_date'],
                        'amount'           => $payment['amount'],
                        'payment_mode'     => $paymentMode,
                        'reference_number' => $payment['reference'] ?? null,
                        'notes'            => "POS #{$invoiceNumber}",
                        'sales_invoice_id' => $invoice->id,
                        'created_by'       => $userId,
                    ]);

                    // Post receipt journal (Dr Cash/Bank, Cr Party)
                    if ($party) {
                        app(AccountingService::class)->postReceipt(
                            $companyId,
                            $party,
                            (float) $payment['amount'],
                            $paymentMode,
                            $validated['invoice_date'],
                            "POS Receipt #{$invoiceNumber} ({$payment['mode']})",
                            $userId,
                            PaymentReceipt::class,
                            $receipt->id,
                        );
                    }
                }
            }

            return $invoice->load('lines.item', 'party');
        });

        return response()->json(['data' => $invoice], 201);
    }

    /**
     * Save current cart as a held (parked) draft invoice.
     */
    public function hold(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'party_id'             => 'nullable|uuid|exists:parties,id',
            'godown_id'            => 'required|uuid|exists:godowns,id',
            'is_inter_state'       => 'boolean',
            'invoice_date'         => 'required|date',
            'notes'                => 'nullable|string',
            'lines'                => 'required|array|min:1',
            'lines.*.item_id'      => 'required|uuid|exists:items,id',
            'lines.*.batch_id'     => 'nullable|uuid|exists:batches,id',
            'lines.*.quantity'     => 'required|numeric|min:0.001',
            'lines.*.unit'         => 'nullable|string|max:20',
            'lines.*.conversion_factor' => 'nullable|numeric|min:0.0001',
            'lines.*.rate'         => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate'     => 'required|numeric|min:0',
        ]);

        // Resolve party outside transaction (PartyObserver creates ledgers)
        $companyId = $request->user()->company_id;
        $userId    = $request->user()->id;
        $partyId   = $validated['party_id'] ?? null;
        if (! $partyId) {
            $walkIn  = Party::firstOrCreate(
                ['company_id' => $companyId, 'name' => 'Walk-in Customer', 'type' => 'customer'],
                ['is_active' => true]
            );
            $partyId = $walkIn->id;
        }

        $invoice = DB::transaction(function () use ($validated, $request, $companyId, $userId, $partyId) {
            $isInterState = $validated['is_inter_state'] ?? false;

            $invoice = SalesInvoice::create([
                'party_id'       => $partyId,
                'godown_id'      => $validated['godown_id'],
                'invoice_number' => 'HOLD-' . now()->format('ymdHis'),
                'invoice_date'   => $validated['invoice_date'],
                'is_inter_state' => $isInterState,
                'status'         => 'draft',
                'pos_held'       => true,
                'notes'          => $validated['notes'] ?? null,
                'created_by'     => $userId,
            ]);

            foreach ($validated['lines'] as $line) {
                $conversionFactor = (float) ($line['conversion_factor'] ?? 1.0);
                $taxable          = ($line['quantity'] * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt           = $taxable * $line['gst_rate'] / 100;

                $invoice->lines()->create([
                    'item_id'           => $line['item_id'],
                    'batch_id'          => $line['batch_id'] ?? null,
                    'godown_id'         => $validated['godown_id'],
                    'quantity'          => $line['quantity'],
                    'unit'              => $line['unit'] ?? null,
                    'conversion_factor' => $conversionFactor,
                    'rate'              => $line['rate'],
                    'discount_percent'  => $line['discount_percent'] ?? 0,
                    'taxable_amount'    => $taxable,
                    'gst_rate'          => $line['gst_rate'],
                    'cgst'              => $isInterState ? 0 : $gstAmt / 2,
                    'sgst'              => $isInterState ? 0 : $gstAmt / 2,
                    'igst'              => $isInterState ? $gstAmt : 0,
                    'line_total'        => $taxable + $gstAmt,
                    'created_by'        => $userId,
                ]);
            }

            $invoice->load('lines');
            $invoice->update([
                'total_amount'   => $invoice->lines->sum('taxable_amount'),
                'taxable_amount' => $invoice->lines->sum('taxable_amount'),
                'cgst_total'     => $invoice->lines->sum('cgst'),
                'sgst_total'     => $invoice->lines->sum('sgst'),
                'igst_total'     => $invoice->lines->sum('igst'),
                'grand_total'    => $invoice->lines->sum('line_total'),
                'balance_due'    => $invoice->lines->sum('line_total'),
            ]);

            return $invoice->load('lines.item', 'party');
        });

        return response()->json(['data' => $invoice], 201);
    }

    /**
     * List all held (parked) bills for the current company.
     */
    public function heldList(Request $request): JsonResponse
    {
        $invoices = SalesInvoice::with('party', 'lines.item')
            ->where('pos_held', true)
            ->where('status', 'draft')
            ->latest()
            ->get();

        return response()->json(['data' => $invoices]);
    }

    /**
     * Delete a held bill.
     */
    public function deleteHeld(SalesInvoice $salesInvoice): JsonResponse
    {
        if (! $salesInvoice->pos_held || $salesInvoice->status !== 'draft') {
            return response()->json(['message' => 'Not a held bill'], 422);
        }

        $salesInvoice->lines()->delete();
        $salesInvoice->delete();

        return response()->json(['message' => 'Held bill deleted']);
    }

    /**
     * Quick create a customer — only name + phone required.
     */
    public function quickParty(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'  => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
        ]);

        $party = Party::create([
            'company_id' => $request->user()->company_id,
            'name'       => $validated['name'],
            'phone'      => $validated['phone'] ?? null,
            'email'      => $validated['email'] ?? null,
            'type'       => 'customer',
            'is_active'  => true,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $party->fresh()], 201);
    }
}
