<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountingGroup;
use App\Models\CompanySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountingGroupController extends Controller
{
    /**
     * Tally Prime default groups (28 groups with hierarchy).
     */
    private array $tallyGroups = [
        // Primary groups
        ['code' => '1000', 'name' => 'Fixed Assets', 'type' => 'asset', 'parent_code' => null, 'system_key' => null],
        ['code' => '1100', 'name' => 'Investments', 'type' => 'asset', 'parent_code' => null, 'system_key' => null],
        ['code' => '1200', 'name' => 'Current Assets', 'type' => 'asset', 'parent_code' => null, 'system_key' => null],
        ['code' => '2000', 'name' => 'Current Liabilities', 'type' => 'liability', 'parent_code' => null, 'system_key' => null],
        ['code' => '2100', 'name' => 'Loans (Liability)', 'type' => 'liability', 'parent_code' => null, 'system_key' => null],
        ['code' => '2200', 'name' => 'Suspense A/c', 'type' => 'liability', 'parent_code' => null, 'system_key' => null],
        ['code' => '3000', 'name' => 'Capital Account', 'type' => 'equity', 'parent_code' => null, 'system_key' => null,
            'ledgers' => [
                ['name' => 'Capital Account', 'system_key' => 'capital_account'],
            ],
        ],

        ['code' => '4000', 'name' => 'Sales Accounts', 'type' => 'income', 'parent_code' => null, 'system_key' => null,
            'ledgers' => [
                ['name' => 'Sales', 'system_key' => 'sales_account'],
            ],
        ],

        ['code' => '4100', 'name' => 'Direct Income', 'type' => 'income', 'parent_code' => null, 'system_key' => null],
        ['code' => '4200', 'name' => 'Indirect Income', 'type' => 'income', 'parent_code' => null, 'system_key' => null],

        ['code' => '5000', 'name' => 'Purchase Accounts', 'type' => 'expense', 'parent_code' => null, 'system_key' => null,
            'ledgers' => [
                ['name' => 'Purchase', 'system_key' => 'purchase_account'],
            ],
        ],

        ['code' => '5100', 'name' => 'Direct Expenses', 'type' => 'expense', 'parent_code' => null, 'system_key' => null],
        ['code' => '5200', 'name' => 'Indirect Expenses', 'type' => 'expense', 'parent_code' => null, 'system_key' => null],

        // Current Assets sub-groups
        ['code' => '1210', 'name' => 'Bank Accounts', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => 'bank_account'],

        ['code' => '1220', 'name' => 'Cash-in-hand', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => 'cash_account',
            'ledgers' => [
                ['name' => 'Cash', 'system_key' => 'cash'],
            ],
        ],

        ['code' => '1230', 'name' => 'Deposits (Asset)', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => null],
        ['code' => '1240', 'name' => 'Loans & Advances (Asset)', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => null],

        ['code' => '1250', 'name' => 'Stock-in-hand', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => null,
            'ledgers' => [
                ['name' => 'Stock-in-Hand', 'system_key' => 'stock'],
            ],
        ],

        ['code' => '1260', 'name' => 'Sundry Debtors', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => 'sundry_debtors'],

        // GST Input Ledgers
        ['code' => '1270', 'name' => 'Input CGST', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => 'input_cgst',
            'ledgers' => [
                ['name' => 'Input CGST', 'system_key' => 'input_cgst'],
            ],
        ],
        ['code' => '1280', 'name' => 'Input SGST', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => 'input_sgst',
            'ledgers' => [
                ['name' => 'Input SGST', 'system_key' => 'input_sgst'],
            ],
        ],
        ['code' => '1290', 'name' => 'Input IGST', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => 'input_igst',
            'ledgers' => [
                ['name' => 'Input IGST', 'system_key' => 'input_igst'],
            ],
        ],

        // Current Liabilities
        ['code' => '2010', 'name' => 'Duties & Taxes', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => null],
        ['code' => '2020', 'name' => 'Provisions', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => null],
        ['code' => '2030', 'name' => 'Sundry Creditors', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'sundry_creditors'],
        // GST Output Ledgers
        ['code' => '2040', 'name' => 'Output CGST', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'output_cgst',
            'ledgers' => [
                ['name' => 'Output CGST', 'system_key' => 'output_cgst'],
            ],
        ],
        ['code' => '2050', 'name' => 'Output SGST', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'output_sgst',
            'ledgers' => [
                ['name' => 'Output SGST', 'system_key' => 'output_sgst'],
            ],
        ],
        ['code' => '2060', 'name' => 'Output IGST', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'output_igst',
            'ledgers' => [
                ['name' => 'Output IGST', 'system_key' => 'output_igst'],
            ],
        ],
        // Loans
        ['code' => '2110', 'name' => 'Bank OD A/c', 'type' => 'liability', 'parent_code' => '2100', 'system_key' => null],
        ['code' => '2120', 'name' => 'Secured Loans', 'type' => 'liability', 'parent_code' => '2100', 'system_key' => null],
        ['code' => '2130', 'name' => 'Unsecured Loans', 'type' => 'liability', 'parent_code' => '2100', 'system_key' => null],
        ['code' => '3010', 'name' => 'Reserves & Surplus', 'type' => 'equity', 'parent_code' => '3000', 'system_key' => null],

        // Specific mapping groups (optional redundancy avoided)
        ['code' => '4010', 'name' => 'Sales Account', 'type' => 'income', 'parent_code' => '4000', 'system_key' => 'sales_account'],
        ['code' => '5010', 'name' => 'Purchase Account', 'type' => 'expense', 'parent_code' => '5000', 'system_key' => 'purchase_account'],
    ];

    private array $margGroups = [
        // Primary groups
        ['code' => '1000', 'name' => 'Cash and Bank Book', 'type' => 'asset', 'parent_code' => null, 'system_key' => null],
        ['code' => '1100', 'name' => 'Sundry Debtors', 'type' => 'asset', 'parent_code' => null, 'system_key' => 'sundry_debtors'],
        ['code' => '2000', 'name' => 'Sundry Creditors', 'type' => 'liability', 'parent_code' => null, 'system_key' => 'sundry_creditors'],
        ['code' => '3000', 'name' => 'Capital Account', 'type' => 'equity', 'parent_code' => null, 'system_key' => null,
            'ledgers' => [
                ['name' => 'Capital Account', 'system_key' => 'capital_account'],
            ],
        ],
        ['code' => '4000', 'name' => 'Income Account', 'type' => 'income', 'parent_code' => null, 'system_key' => null,
            'ledgers' => [
                ['name' => 'Sales', 'system_key' => 'sales_account'],
            ],
        ],
        ['code' => '5000', 'name' => 'Expenditure Account', 'type' => 'expense', 'parent_code' => null, 'system_key' => null,
            'ledgers' => [
                ['name' => 'Purchase', 'system_key' => 'purchase_account'],
            ],
        ],
        // Cash & Bank
        ['code' => '1010', 'name' => 'Cash Account', 'type' => 'asset', 'parent_code' => '1000', 'system_key' => 'cash_account',
            'ledgers' => [
                ['name' => 'Cash', 'system_key' => 'cash'],
            ],
        ],
        ['code' => '1020', 'name' => 'Bank Account', 'type' => 'asset', 'parent_code' => '1000', 'system_key' => 'bank_account'],
        // Debtors
        ['code' => '1110', 'name' => 'Sundry Debtors (Field Staff)', 'type' => 'asset', 'parent_code' => '1100', 'system_key' => null],
        // GST Input
        ['code' => '1120', 'name' => 'Input CGST', 'type' => 'asset', 'parent_code' => '1100', 'system_key' => 'input_cgst',
            'ledgers' => [
                ['name' => 'Input CGST', 'system_key' => 'input_cgst'],
            ],
        ],
        ['code' => '1130', 'name' => 'Input SGST', 'type' => 'asset', 'parent_code' => '1100', 'system_key' => 'input_sgst',
            'ledgers' => [
                ['name' => 'Input SGST', 'system_key' => 'input_sgst'],
            ],
        ],
        ['code' => '1140', 'name' => 'Input IGST', 'type' => 'asset', 'parent_code' => '1100', 'system_key' => 'input_igst',
            'ledgers' => [
                ['name' => 'Input IGST', 'system_key' => 'input_igst'],
            ],
        ],
        // Creditors
        ['code' => '2010', 'name' => 'Creditors (Suppliers)', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => null],
        ['code' => '2020', 'name' => 'Creditors (Manufacturers)', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => null],
        ['code' => '2030', 'name' => 'Creditors (Expenses Payable)', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => null],
        // GST Output
        ['code' => '2040', 'name' => 'Output CGST', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'output_cgst',
            'ledgers' => [
                ['name' => 'Output CGST', 'system_key' => 'output_cgst'],
            ],
        ],
        ['code' => '2050', 'name' => 'Output SGST', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'output_sgst',
            'ledgers' => [
                ['name' => 'Output SGST', 'system_key' => 'output_sgst'],
            ],
        ],
        ['code' => '2060', 'name' => 'Output IGST', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'output_igst',
            'ledgers' => [
                ['name' => 'Output IGST', 'system_key' => 'output_igst'],
            ],
        ],
        // Capital sub-group
        ['code' => '3010', 'name' => 'Reserves & Surplus', 'type' => 'equity', 'parent_code' => '3000', 'system_key' => null],
        // Income
        ['code' => '4010', 'name' => 'Sales Account', 'type' => 'income', 'parent_code' => '4000', 'system_key' => 'sales_account'],
        ['code' => '4020', 'name' => 'Income (Indirect)', 'type' => 'income', 'parent_code' => '4000', 'system_key' => null],
        // Expense
        ['code' => '5010', 'name' => 'Purchase Account', 'type' => 'expense', 'parent_code' => '5000', 'system_key' => 'purchase_account'],
        ['code' => '5020', 'name' => 'Expenses (Indirect)', 'type' => 'expense', 'parent_code' => '5000', 'system_key' => null],
    ];

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', AccountingGroup::class);

        $accounts = AccountingGroup::with('children')
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->boolean('root_only'), fn ($q) => $q->whereNull('parent_id'))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('code')
            ->paginate($request->per_page ?? 100);

        return response()->json($accounts);
    }

    public function show(AccountingGroup $accountingGroup): JsonResponse
    {
        $this->authorize('view', $accountingGroup);

        return response()->json(['data' => $accountingGroup->load('children', 'parent')]);
    }

    public function update(Request $request, AccountingGroup $accountingGroup): JsonResponse
    {
        $this->authorize('update', $accountingGroup);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'is_active' => 'boolean',
            'balance_type' => 'nullable|in:dr,cr',
        ]);

        $accountingGroup->update($validated);

        return response()->json(['data' => $accountingGroup]);
    }

    public function destroy(AccountingGroup $accountingGroup): JsonResponse
    {
        $this->authorize('delete', $accountingGroup);

        $accountingGroup->delete();

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
            // Soft-delete existing system accounts that are NOT referenced by voucher lines
            $referencedIds = DB::table('voucher_lines')
                ->join('accounting_groups', 'voucher_lines.account_id', '=', 'accounting_groups.id')
                ->where('accounting_groups.company_id', $companyId)
                ->where('accounting_groups.is_system', true)
                ->pluck('voucher_lines.account_id')
                ->unique();

            // Soft-delete unreferenced system accounts
            AccountingGroup::where('company_id', $companyId)
                ->where('is_system', true)
                ->whereNotIn('id', $referencedIds)
                ->delete();

            // Deactivate referenced system accounts (can't delete, but hide them)
            if ($referencedIds->isNotEmpty()) {
                AccountingGroup::where('company_id', $companyId)
                    ->where('is_system', true)
                    ->whereIn('id', $referencedIds)
                    ->update(['is_active' => false]);
            }

            // First pass: create all primary groups (no parent)
            $codeToId = [];
            foreach ($groups as $group) {
                if ($group['parent_code'] === null) {
                    $account = AccountingGroup::create([
                        'company_id' => $companyId,
                        'parent_id' => null,
                        'code' => $group['code'],
                        'name' => $group['name'],
                        'type' => $group['type'],
                        'system_key' => $group['system_key'] ?? null,
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
                    $account = AccountingGroup::create([
                        'company_id' => $companyId,
                        'parent_id' => $parentId,
                        'code' => $group['code'],
                        'name' => $group['name'],
                        'type' => $group['type'],
                        'system_key' => $group['system_key'] ?? null,
                        'is_system' => true,
                        'is_active' => true,
                    ]);
                    $codeToId[$group['code']] = $account->id;
                }
            }

            foreach ($groups as $group) {

                if (! empty($group['ledgers'])) {
                    foreach ($group['ledgers'] as $ledger) {
                        Ledger::create([
                            'name' => $ledger['name'],
                            'group_id' => $codeToId[$group['parent_code']] ?? null,
                            'is_system' => true,
                        ]);
                    }
                }
            }
        });

        // Mark as loaded — prevents future loads
        CompanySetting::setValue($companyId, 'default_groups_loaded', $preset);

        $accounts = AccountingGroup::where('company_id', $companyId)
            ->where('is_system', true)
            ->with('children')
            ->whereNull('parent_id')
            ->orderBy('code')
            ->get();

        return response()->json([
            'message' => ucfirst($preset).' default groups loaded successfully.',
            'loaded_preset' => $preset,
            'data' => $accounts,
        ]);
    }
}
