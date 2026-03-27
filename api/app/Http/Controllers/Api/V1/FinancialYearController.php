<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinancialYearController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', FinancialYear::class);

        $years = FinancialYear::query()
            ->orderByDesc('start_date')
            ->paginate($request->per_page ?? 50);

        return response()->json($years);
    }

    public function show(FinancialYear $financialYear): JsonResponse
    {
        $this->authorize('view', $financialYear);

        return response()->json(['data' => $financialYear]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', FinancialYear::class);

        $validated = $request->validate([
            'label' => 'required|string|max:20',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'is_current' => 'boolean',
        ]);

        $companyId = $request->user()->company_id;
        $validated['company_id'] = $companyId;
        $validated['is_locked'] = false;

        // If marking as current, unset others
        if (! empty($validated['is_current'])) {
            FinancialYear::where('company_id', $companyId)
                ->where('is_current', true)
                ->update(['is_current' => false]);
        }

        $year = FinancialYear::create($validated);

        return response()->json(['data' => $year], 201);
    }

    public function update(Request $request, FinancialYear $financialYear): JsonResponse
    {
        $this->authorize('update', $financialYear);

        $validated = $request->validate([
            'label' => 'sometimes|string|max:20',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after:start_date',
            'is_locked' => 'boolean',
            'is_current' => 'boolean',
        ]);

        $companyId = $request->user()->company_id;

        // If marking as current, unset others
        if (! empty($validated['is_current'])) {
            FinancialYear::where('company_id', $companyId)
                ->where('is_current', true)
                ->where('id', '!=', $financialYear->id)
                ->update(['is_current' => false]);
        }

        $financialYear->update($validated);

        return response()->json(['data' => $financialYear]);
    }

    public function destroy(FinancialYear $financialYear): JsonResponse
    {
        $this->authorize('delete', $financialYear);

        if ($financialYear->is_current) {
            return response()->json(['message' => 'Cannot delete the current financial year.'], 422);
        }

        if ($financialYear->journalEntries()->exists()) {
            return response()->json(['message' => 'Cannot delete — journal entries exist in this financial year.'], 422);
        }

        $financialYear->delete();

        return response()->json(['message' => 'Financial year deleted']);
    }

    /**
     * Set a financial year as the current/default one.
     */
    public function setCurrent(Request $request, FinancialYear $financialYear): JsonResponse
    {
        $this->authorize('update', $financialYear);

        $companyId = $request->user()->company_id;

        DB::transaction(function () use ($financialYear, $companyId) {
            FinancialYear::where('company_id', $companyId)
                ->where('is_current', true)
                ->update(['is_current' => false]);

            $financialYear->update(['is_current' => true]);
        });

        return response()->json([
            'message' => "Financial year {$financialYear->label} set as current.",
            'data' => $financialYear->fresh(),
        ]);
    }
}
