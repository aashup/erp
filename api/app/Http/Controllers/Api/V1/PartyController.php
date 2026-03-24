<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Party;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PartyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Party::class);

        $parties = Party::query()
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%")->orWhere('gstin', 'like', "%{$s}%"))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->paginate($request->per_page ?? 25);

        return response()->json($parties);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Party::class);

        $validated = $request->validate([
            'type' => 'required|in:customer,vendor,both',
            'name' => 'required|string|max:255',
            'gstin' => 'nullable|string|size:15',
            'pan' => 'nullable|string|size:10',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'state_code' => 'nullable|string|size:2',
            'pincode' => 'nullable|string|max:6',
            'phone' => 'nullable|string|max:15',
            'email' => 'nullable|email',
            'contact_person' => 'nullable|string|max:255',
            'credit_limit' => 'nullable|numeric|min:0',
            'opening_balance' => 'nullable|numeric',
            'balance_type' => 'nullable|in:debit,credit',
        ]);

        $party = Party::create($validated);

        return response()->json(['data' => $party], 201);
    }

    public function show(Party $party): JsonResponse
    {
        $this->authorize('view', $party);

        return response()->json(['data' => $party]);
    }

    public function update(Request $request, Party $party): JsonResponse
    {
        $this->authorize('update', $party);

        $validated = $request->validate([
            'type' => 'sometimes|in:customer,vendor,both',
            'name' => 'sometimes|string|max:255',
            'gstin' => 'nullable|string|size:15',
            'pan' => 'nullable|string|size:10',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'state_code' => 'nullable|string|size:2',
            'pincode' => 'nullable|string|max:6',
            'phone' => 'nullable|string|max:15',
            'email' => 'nullable|email',
            'contact_person' => 'nullable|string|max:255',
            'credit_limit' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
        ]);

        $party->update($validated);

        return response()->json(['data' => $party]);
    }

    public function destroy(Party $party): JsonResponse
    {
        $this->authorize('delete', $party);

        $party->delete();

        return response()->json(['message' => 'Party deleted']);
    }
}
