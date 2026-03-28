<?php

namespace Database\Seeders;

use App\Models\ChartOfAccount;
use App\Models\Company;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ChartOfAccountSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Standard Chart of Accounts for Indian SME.
     * Parent groups (level 1) — these form the tree roots.
     */
    protected array $standardAccounts = [
        // Assets
        ['code' => '1000', 'name' => 'Fixed Assets', 'type' => 'asset', 'group' => 'fixed_asset', 'system_key' => null],
        ['code' => '1100', 'name' => 'Current Assets', 'type' => 'asset', 'group' => 'current_asset', 'system_key' => null],
        ['code' => '1200', 'name' => 'Investments', 'type' => 'asset', 'group' => 'investment', 'system_key' => null],
        ['code' => '1300', 'name' => 'Cash and Bank', 'type' => 'asset', 'group' => 'current_asset', 'system_key' => null],

        // Liabilities
        ['code' => '2000', 'name' => 'Current Liabilities', 'type' => 'liability', 'group' => 'current_liability', 'system_key' => null],
        ['code' => '2100', 'name' => 'Long Term Liabilities', 'type' => 'liability', 'group' => 'long_term_liability', 'system_key' => null],
        ['code' => '2200', 'name' => 'Provisions', 'type' => 'liability', 'group' => 'current_liability', 'system_key' => null],

        // Equity
        ['code' => '3000', 'name' => 'Equity', 'type' => 'equity', 'group' => 'equity', 'system_key' => null],
        ['code' => '3100', 'name' => 'Reserves and Surplus', 'type' => 'equity', 'group' => 'equity', 'system_key' => null],

        // Income
        ['code' => '4000', 'name' => 'Sales', 'type' => 'income', 'group' => 'sales', 'system_key' => null],
        ['code' => '4100', 'name' => 'Other Income', 'type' => 'income', 'group' => 'other_income', 'system_key' => null],
        ['code' => '4200', 'name' => 'Purchase Returns', 'type' => 'income', 'group' => 'other_income', 'system_key' => null],

        // Expenses
        ['code' => '5000', 'name' => 'Purchases', 'type' => 'expense', 'group' => 'purchase', 'system_key' => null],
        ['code' => '5100', 'name' => 'Direct Expenses', 'type' => 'expense', 'group' => 'direct_expense', 'system_key' => null],
        ['code' => '5200', 'name' => 'Indirect Expenses', 'type' => 'expense', 'group' => 'indirect_expense', 'system_key' => null],
        ['code' => '5300', 'name' => 'Financial Expenses', 'type' => 'expense', 'group' => 'financial_expense', 'system_key' => null],
        ['code' => '5400', 'name' => 'Sales Returns', 'type' => 'expense', 'group' => 'direct_expense', 'system_key' => null],
    ];

    /**
     * Essential sub-accounts with system_key for programmatic lookup.
     * These are required for auto journal entries (sales, purchase, payment, GST).
     */
    protected array $essentialAccounts = [
        // Under Current Assets (1100)
        ['code' => '1110', 'name' => 'Sundry Debtors', 'type' => 'asset', 'parent_code' => '1100', 'system_key' => 'sundry_debtors'],
        ['code' => '1120', 'name' => 'Input CGST', 'type' => 'asset', 'parent_code' => '1100', 'system_key' => 'input_cgst'],
        ['code' => '1130', 'name' => 'Input SGST', 'type' => 'asset', 'parent_code' => '1100', 'system_key' => 'input_sgst'],
        ['code' => '1140', 'name' => 'Input IGST', 'type' => 'asset', 'parent_code' => '1100', 'system_key' => 'input_igst'],

        // Under Cash and Bank (1300)
        ['code' => '1310', 'name' => 'Cash Account', 'type' => 'asset', 'parent_code' => '1300', 'system_key' => 'cash_account'],
        ['code' => '1320', 'name' => 'Bank Account', 'type' => 'asset', 'parent_code' => '1300', 'system_key' => 'bank_account'],

        // Under Current Liabilities (2000)
        ['code' => '2010', 'name' => 'Sundry Creditors', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'sundry_creditors'],
        ['code' => '2020', 'name' => 'Output CGST', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'output_cgst'],
        ['code' => '2030', 'name' => 'Output SGST', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'output_sgst'],
        ['code' => '2040', 'name' => 'Output IGST', 'type' => 'liability', 'parent_code' => '2000', 'system_key' => 'output_igst'],

        // Under Sales (4000) — ledger account for revenue
        ['code' => '4010', 'name' => 'Sales Account', 'type' => 'income', 'parent_code' => '4000', 'system_key' => 'sales_account'],

        // Under Purchases (5000) — ledger account for purchases
        ['code' => '5010', 'name' => 'Purchase Account', 'type' => 'expense', 'parent_code' => '5000', 'system_key' => 'purchase_account'],
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

        $codeToId = [];

        // Create standard root accounts
        foreach ($this->standardAccounts as $account) {
            $created = ChartOfAccount::factory()->create([
                'company_id' => $company->id,
                'parent_id' => null,
                'code' => $account['code'],
                'name' => $account['name'],
                'type' => $account['type'],
                'group' => $account['group'],
                'system_key' => $account['system_key'],
                'is_system' => true,
                'is_active' => true,
            ]);
            $codeToId[$account['code']] = $created->id;
        }

        // Create essential sub-accounts with system_keys
        foreach ($this->essentialAccounts as $account) {
            $parentId = $codeToId[$account['parent_code']] ?? null;
            $created = ChartOfAccount::factory()->create([
                'company_id' => $company->id,
                'parent_id' => $parentId,
                'code' => $account['code'],
                'name' => $account['name'],
                'type' => $account['type'],
                'group' => $account['type'],
                'system_key' => $account['system_key'],
                'is_system' => true,
                'is_active' => true,
            ]);
            $codeToId[$account['code']] = $created->id;
        }
    }
}
