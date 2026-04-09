<?php

namespace Database\Seeders;

use App\Models\AccountingGroup;
use App\Models\Company;
use App\Models\CompanySetting;
use App\Models\Ledger;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AccountingGroupSeeder extends Seeder
{
    // use WithoutModelEvents;

    /**
     * Standard Chart of Accounts for Indian SME.
     * Parent groups (level 1) — these form the tree roots.
     */
    protected array $tallyGroups = [
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
        ['code' => '1210', 'name' => 'Bank Accounts', 'type' => 'asset', 'parent_code' => '1200', 'system_key' => 'bank_account',
            'ledgers' => [
                ['name' => 'HDFC Bank', 'system_key' => 'bank_account'],
            ],
        ],
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

        // Current Liabilities
        ['code' => '2010', 'name' => 'Duties & Taxes', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'duties_taxes',
            'ledgers' => [
                ['name' => 'Output CGST', 'system_key' => 'output_cgst'],
                ['name' => 'Output SGST', 'system_key' => 'output_sgst'],
                ['name' => 'Output IGST', 'system_key' => 'output_igst'],
                ['name' => 'Input CGST', 'system_key' => 'input_cgst'],
                ['name' => 'Input SGST', 'system_key' => 'input_sgst'],
                ['name' => 'Input IGST', 'system_key' => 'input_igst'],
            ],
        ],
        ['code' => '2020', 'name' => 'Provisions', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => null],
        ['code' => '2030', 'name' => 'Sundry Creditors', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'sundry_creditors'],

        // Loans
        ['code' => '2110', 'name' => 'Bank OD A/c', 'type' => 'liability', 'parent_code' => '2100', 'system_key' => null],
        ['code' => '2120', 'name' => 'Secured Loans', 'type' => 'liability', 'parent_code' => '2100', 'system_key' => null],
        ['code' => '2130', 'name' => 'Unsecured Loans', 'type' => 'liability', 'parent_code' => '2100', 'system_key' => null],
        ['code' => '3010', 'name' => 'Reserves & Surplus', 'type' => 'equity', 'parent_code' => '3000', 'system_key' => null],

        // Specific mapping groups (optional redundancy avoided)
        ['code' => '2022', 'name' => 'Salary', 'type' => 'liability', 'parent_code' => '2020', 'system_key' => 'salary_expense',
            'ledgers' => [
                ['name' => 'Salary Payable', 'system_key' => 'salary_expense'],
            ],
        ],
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = Company::first();

        if (! $company) {
            $company = Company::factory()->create();
        }

        $groups = $this->tallyGroups;
        $companyId = $company->id;

        DB::transaction(function () use ($groups, $companyId) {

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

            // Third pass: create ledgers under their own group (not parent)
            foreach ($groups as $group) {
                if (! empty($group['ledgers'])) {
                    $groupId = $codeToId[$group['code']] ?? null;

                    foreach ($group['ledgers'] as $ledger) {
                        Ledger::create([
                            'company_id' => $companyId,
                            'name' => $ledger['name'],
                            'group_id' => $groupId,
                            'system_key' => $ledger['system_key'] ?? null,
                            'is_system' => true,
                            'allow_manual_entry' => true,
                        ]);
                    }
                }
            }
            CompanySetting::setValue($companyId, 'default_groups_loaded', 'tally');
        });
    }
}
