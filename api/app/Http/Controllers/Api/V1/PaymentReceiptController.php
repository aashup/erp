<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PaymentReceipt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentReceiptController extends Controller
{
    use \App\Traits\FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', PaymentReceipt::class);

        $query = PaymentReceipt::with('party')
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->search, fn ($q, $s) => $q->where('receipt_number', 'like', "%{$s}%"))
            ->latest('receipt_date');

        $this->applyFYFilter($query, $request, 'receipt_date');

        $receipts = $query->paginate($request->per_page ?? 25);

        return response()->json($receipts);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', PaymentReceipt::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'type' => 'required|in:payment,receipt',
            'receipt_number' => 'required|string|unique:payment_receipts',
            'receipt_date' => 'required|date',
            'amount' => 'required|numeric|min:0.01',
            'payment_mode' => 'required|in:cash,bank,cheque,upi,other',
            'reference_number' => 'nullable|string',
            'bank_name' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $receipt = PaymentReceipt::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $receipt], 201);
    }

    public function show(PaymentReceipt $paymentReceipt): JsonResponse
    {
        $this->authorize('view', $paymentReceipt);

        return response()->json(['data' => $paymentReceipt->load('party')]);
    }

    public function destroy(PaymentReceipt $paymentReceipt): JsonResponse
    {
        $this->authorize('delete', $paymentReceipt);

        $paymentReceipt->delete();

        return response()->json(['message' => 'Payment/receipt deleted']);
    }
}
