<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Models\CompanySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChartOfAccountController extends Controller
{
    /**
     * Tally Prime default groups (28 groups with hierarchy).
     */
    private array $tallyGroups = [
        // Primary groups (parent_id = null)
        ['code' => '1000', 'name' => 'Fixed Assets', 'type' => 'asset', 'parent_code' => null],
        ['code' => '1100', 'name' => 'Investments', 'type' => 'asset', 'parent_code' => null],
        ['code' => '1200', 'name' => 'Current Assets', 'type' => 'asset', 'parent_code' => null],
        ['code' => '2000', 'name' => 'Current Liabilities', 'type' => 'liability', 'parent_code' => null],
        ['code' => '2100', 'name' => 'Loans (Liability)', 'type' => 'liability', 'parent_code' => null],
        ['code' => '2200', 'name' => 'Suspense A/c', 'type' => 'liability', 'parent_code' => null],
        ['code' => '3000', 'name' => 'Capital Account', 'type' => 'equity', 'parent_code' => null],
        ['code' => '4000', 'name' => 'Sales Accounts', 'type' => 'income', 'parent_code' => null],
        ['code' => '4100', 'name' => 'Direct Income', 'type' => 'income', 'parent_code' => null],
        ['code' => '4200', 'name' => 'Indirect Income', 'type' => 'income', 'parent_code' => null],
        ['code' => '5000', 'name' => 'Purchase Accounts', 'type' => 'expense', 'parent_code' => null],
        ['code' => '5100', 'name' => 'Direct Expenses', 'type' => 'expense', 'parent_code' => null],
        ['code' => '5200', 'name' => 'Indirect Expenses', 'type' => 'expense', 'parent_code' => null],
        // Sub-groups under Current Assets (1200)
        ['code' => '1210', 'name' => 'Bank Accounts', 'type' => 'asset', 'parent_code' => '1200'],
        ['code' => '1220', 'name' => 'Cash-in-hand', 'type' => 'asset', 'parent_code' => '1200'],
        ['code' => '1230', 'name' => 'Deposits (Asset)', 'type' => 'asset', 'parent_code' => '1200'],
        ['code' => '1240', 'name' => 'Loans & Advances (Asset)', 'type' => 'asset', 'parent_code' => '1200'],
        ['code' => '1250', 'name' => 'Stock-in-hand', 'type' => 'asset', 'parent_code' => '1200'],
        ['code' => '1260', 'name' => 'Sundry Debtors', 'type' => 'asset', 'parent_code' => '1200'],
        // Sub-groups under Current Liabilities (2000)
        ['code' => '2010', 'name' => 'Duties & Taxes', 'type' => 'liability', 'parent_code' => '2000'],
        ['code' => '2020', 'name' => 'Provisions', 'type' => 'liability', 'parent_code' => '2000'],
        ['code' => '2030', 'name' => 'Sundry Creditors', 'type' => 'liability', 'parent_code' => '2000'],
        // Sub-groups under Loans (Liability) (2100)
        ['code' => '2110', 'name' => 'Bank OD A/c', 'type' => 'liability', 'parent_code' => '2100'],
        ['code' => '2120', 'name' => 'Secured Loans', 'type' => 'liability', 'parent_code' => '2100'],
        ['code' => '2130', 'name' => 'Unsecured Loans', 'type' => 'liability', 'parent_code' => '2100'],
        // Sub-group under Capital Account (3000)
        ['code' => '3010', 'name' => 'Reserves & Surplus', 'type' => 'equity', 'parent_code' => '3000'],
    ];

    /**
     * Marg ERP default groups (trade-specific for Pharma/FMCG).
     */
    private array $margGroups = [
        // Primary groups (parent_id = null)
        ['code' => '1000', 'name' => 'Cash and Bank Book', 'type' => 'asset', 'parent_code' => null],
        ['code' => '1100', 'name' => 'Sundry Debtors', 'type' => 'asset', 'parent_code' => null],
        ['code' => '2000', 'name' => 'Sundry Creditors', 'type' => 'liability', 'parent_code' => null],
        ['code' => '3000', 'name' => 'Capital Account', 'type' => 'equity', 'parent_code' => null],
        ['code' => '4000', 'name' => 'Income Account', 'type' => 'income', 'parent_code' => null],
        ['code' => '5000', 'name' => 'Expenditure Account', 'type' => 'expense', 'parent_code' => null],
        // Sub-group under Sundry Debtors (1100)
        ['code' => '1110', 'name' => 'Sundry Debtors (Field Staff)', 'type' => 'asset', 'parent_code' => '1100'],
        // Sub-groups under Sundry Creditors (2000)
        ['code' => '2010', 'name' => 'Creditors (Suppliers)', 'type' => 'liability', 'parent_code' => '2000'],
        ['code' => '2020', 'name' => 'Creditors (Manufacturers)', 'type' => 'liability', 'parent_code' => '2000'],
        ['code' => '2030', 'name' => 'Creditors (Expenses Payable)', 'type' => 'liability', 'parent_code' => '2000'],
        // Sub-group under Capital Account (3000)
        ['code' => '3010', 'name' => 'Reserves & Surplus', 'type' => 'equity', 'parent_code' => '3000'],
        // Sub-groups under Income Account (4000)
        ['code' => '4010', 'name' => 'Income (Direct)', 'type' => 'income', 'parent_code' => '4000'],
        ['code' => '4020', 'name' => 'Income (Indirect)', 'type' => 'income', 'parent_code' => '4000'],
        // Sub-groups under Expenditure Account (5000)
        ['code' => '5010', 'name' => 'Expenses (Direct)', 'type' => 'expense', 'parent_code' => '5000'],
        ['code' => '5020', 'name' => 'Expenses (Indirect)', 'type' => 'expense', 'parent_code' => '5000'],
    ];

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
            'opening_balance' => 'nullable|numeric|min:0',
            'balance_type' => 'nullable|in:dr,cr',
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

    /**
     * Load default account groups (Tally or Marg) — one-time operation.
     */
    public function loadDefaults(Request $request): JsonResponse
    {
        $request->validate([
            'preset' => 'required|in:tally,marg',
        ]);

        $companyId = $request->user()->company_id;
        $preset = $request->input('preset');

        // Check if defaults already loaded
        $loaded = CompanySetting::getValue($companyId, 'default_groups_loaded');
        if ($loaded) {
            return response()->json([
                'message' => "Default groups already loaded ({$loaded}). This is a one-time operation.",
            ], 422);
        }

        $groups = $preset === 'tally' ? $this->tallyGroups : $this->margGroups;

        DB::transaction(function () use ($groups, $companyId) {
            // Soft-delete existing system accounts that are NOT referenced by journal lines
            $referencedIds = DB::table('journal_lines')
                ->join('chart_of_accounts', 'journal_lines.account_id', '=', 'chart_of_accounts.id')
                ->where('chart_of_accounts.company_id', $companyId)
                ->where('chart_of_accounts.is_system', true)
                ->pluck('journal_lines.account_id')
                ->unique();

            // Soft-delete unreferenced system accounts
            ChartOfAccount::where('company_id', $companyId)
                ->where('is_system', true)
                ->whereNotIn('id', $referencedIds)
                ->delete();

            // Deactivate referenced system accounts (can't delete, but hide them)
            if ($referencedIds->isNotEmpty()) {
                ChartOfAccount::where('company_id', $companyId)
                    ->where('is_system', true)
                    ->whereIn('id', $referencedIds)
                    ->update(['is_active' => false]);
            }

            // First pass: create all primary groups (no parent)
            $codeToId = [];
            foreach ($groups as $group) {
                if ($group['parent_code'] === null) {
                    $account = ChartOfAccount::create([
                        'company_id' => $companyId,
                        'parent_id' => null,
                        'code' => $group['code'],
                        'name' => $group['name'],
                        'type' => $group['type'],
                        'group' => $group['type'],
                        'is_system' => true,
                        'is_active' => true,
                    ]);
                    $codeToId[$group['code']] = $account->id;
                }
            }

            // Second pass: create sub-groups with parent references
            foreach ($groups as $group) {
                if ($group['parent_code'] !== null) {
                    $parentId = $codeToId[$group['parent_code']] ?? null;
                    $account = ChartOfAccount::create([
                        'company_id' => $companyId,
                        'parent_id' => $parentId,
                        'code' => $group['code'],
                        'name' => $group['name'],
                        'type' => $group['type'],
                        'group' => $group['type'],
                        'is_system' => true,
                        'is_active' => true,
                    ]);
                    $codeToId[$group['code']] = $account->id;
                }
            }
        });

        // Mark as loaded — prevents future loads
        CompanySetting::setValue($companyId, 'default_groups_loaded', $preset);

        $accounts = ChartOfAccount::where('company_id', $companyId)
            ->where('is_system', true)
            ->with('children')
            ->whereNull('parent_id')
            ->orderBy('code')
            ->get();

        return response()->json([
            'message' => ucfirst($preset) . ' default groups loaded successfully.',
            'loaded_preset' => $preset,
            'data' => $accounts,
        ]);
    }
}
