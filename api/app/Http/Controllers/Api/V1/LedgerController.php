<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Ledger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LedgerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Ledger::class);

        $query = Ledger::with('group')
            ->when($request->group_id, fn ($q, $g) => $q->where('group_id', $g))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('alias', 'like', "%{$s}%");
            }))
            ->orderBy('name');

        $ledgers = $query->paginate($request->per_page ?? 25);

        return response()->json($ledgers);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Ledger::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'alias' => 'nullable|string|max:255',
            'group_id' => 'required|uuid|exists:accounting_groups,id',
            'opening_balance' => 'nullable|numeric|min:0',
            'opening_type' => 'nullable|in:dr,cr',
            'opening_date' => 'nullable|date',
            'is_bill_wise' => 'boolean',
            'is_cost_center_applicable' => 'boolean',
            'allow_manual_entry' => 'boolean',
        ]);

        $ledger = Ledger::create([
            ...$validated,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $ledger->load('group')], 201);
    }

    public function show(Ledger $ledger): JsonResponse
    {
        $this->authorize('view', $ledger);

        return response()->json(['data' => $ledger->load('group')]);
    }

    public function update(Request $request, Ledger $ledger): JsonResponse
    {
        $this->authorize('update', $ledger);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'alias' => 'nullable|string|max:255',
            'group_id' => 'sometimes|uuid|exists:accounting_groups,id',
            'opening_balance' => 'nullable|numeric|min:0',
            'opening_type' => 'nullable|in:dr,cr',
            'opening_date' => 'nullable|date',
            'is_bill_wise' => 'boolean',
            'is_cost_center_applicable' => 'boolean',
            'allow_manual_entry' => 'boolean',
        ]);

        $ledger->update([
            ...$validated,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $ledger->load('group')]);
    }

    public function destroy(Ledger $ledger): JsonResponse
    {
        $this->authorize('delete', $ledger);

        if ($ledger->is_system) {
            return response()->json(['message' => 'System ledgers cannot be deleted.'], 422);
        }

        $ledger->delete();

        return response()->json(['message' => 'Ledger deleted']);
    }
}
