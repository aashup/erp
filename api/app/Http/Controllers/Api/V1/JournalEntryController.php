<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JournalEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class JournalEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', JournalEntry::class);

        $entries = JournalEntry::with('lines.account')
            ->when($request->voucher_type, fn ($q, $t) => $q->where('voucher_type', $t))
            ->when($request->search, fn ($q, $s) => $q->where('voucher_number', 'like', "%{$s}%"))
            ->latest('voucher_date')
            ->paginate($request->per_page ?? 25);

        return response()->json($entries);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', JournalEntry::class);

        $validated = $request->validate([
            'financial_year_id' => 'required|uuid|exists:financial_years,id',
            'voucher_number' => 'required|string|unique:journal_entries',
            'voucher_date' => 'required|date',
            'voucher_type' => 'required|in:purchase,sales,payment,receipt,journal,contra',
            'narration' => 'nullable|string',
            'lines' => 'required|array|min:2',
            'lines.*.account_id' => 'required|uuid|exists:chart_of_accounts,id',
            'lines.*.debit' => 'required|numeric|min:0',
            'lines.*.credit' => 'required|numeric|min:0',
            'lines.*.narration' => 'nullable|string',
        ]);

        // Validate debit = credit
        $totalDebit = collect($validated['lines'])->sum('debit');
        $totalCredit = collect($validated['lines'])->sum('credit');

        if (round($totalDebit, 2) !== round($totalCredit, 2)) {
            return response()->json(['message' => 'Total debit must equal total credit'], 422);
        }

        $entry = DB::transaction(function () use ($validated, $request) {
            $entry = JournalEntry::create([
                ...$validated,
                'source' => 'manual',
                'is_posted' => true,
                'created_by' => $request->user()->id,
            ]);

            foreach ($validated['lines'] as $line) {
                $entry->lines()->create($line);
            }

            return $entry->load('lines.account');
        });

        return response()->json(['data' => $entry], 201);
    }

    public function show(JournalEntry $journalEntry): JsonResponse
    {
        $this->authorize('view', $journalEntry);

        return response()->json(['data' => $journalEntry->load('lines.account', 'financialYear')]);
    }

    public function destroy(JournalEntry $journalEntry): JsonResponse
    {
        $this->authorize('delete', $journalEntry);

        return response()->json(['message' => 'Journal entries are append-only. Create a reversal entry instead.'], 422);
    }
}
