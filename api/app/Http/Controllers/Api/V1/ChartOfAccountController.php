<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChartOfAccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ChartOfAccount::class);

        $accounts = ChartOfAccount::with('children')
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->boolean('root_only'), fn ($q) => $q->whereNull('parent_id'))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('code')
            ->paginate($request->per_page ?? 100);

        return response()->json($accounts);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', ChartOfAccount::class);

        $validated = $request->validate([
            'parent_id' => 'nullable|uuid|exists:chart_of_accounts,id',
            'code' => 'required|string|max:20',
            'name' => 'required|string|max:255',
            'type' => 'required|in:asset,liability,equity,income,expense',
            'group' => 'nullable|string|max:100',
        ]);

        $account = ChartOfAccount::create($validated);

        return response()->json(['data' => $account], 201);
    }

    public function show(ChartOfAccount $chartOfAccount): JsonResponse
    {
        $this->authorize('view', $chartOfAccount);

        return response()->json(['data' => $chartOfAccount->load('children', 'parent')]);
    }

    public function update(Request $request, ChartOfAccount $chartOfAccount): JsonResponse
    {
        $this->authorize('update', $chartOfAccount);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'group' => 'nullable|string|max:100',
            'is_active' => 'boolean',
        ]);

        $chartOfAccount->update($validated);

        return response()->json(['data' => $chartOfAccount]);
    }

    public function destroy(ChartOfAccount $chartOfAccount): JsonResponse
    {
        $this->authorize('delete', $chartOfAccount);

        $chartOfAccount->delete();

        return response()->json(['message' => 'Account deleted']);
    }
}
