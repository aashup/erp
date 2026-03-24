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
     * Standard Chart of Accounts for Indian SME
     */
    protected array $standardAccounts = [
        // Assets
        ['code' => '1000', 'name' => 'Fixed Assets', 'type' => 'asset', 'group' => 'fixed_asset', 'is_system' => true],
        ['code' => '1100', 'name' => 'Current Assets', 'type' => 'asset', 'group' => 'current_asset', 'is_system' => true],
        ['code' => '1200', 'name' => 'Investments', 'type' => 'asset', 'group' => 'investment', 'is_system' => true],
        ['code' => '1300', 'name' => 'Cash and Bank', 'type' => 'asset', 'group' => 'current_asset', 'is_system' => true],

        // Liabilities
        ['code' => '2000', 'name' => 'Current Liabilities', 'type' => 'liability', 'group' => 'current_liability', 'is_system' => true],
        ['code' => '2100', 'name' => 'Long Term Liabilities', 'type' => 'liability', 'group' => 'long_term_liability', 'is_system' => true],
        ['code' => '2200', 'name' => 'Provisions', 'type' => 'liability', 'group' => 'current_liability', 'is_system' => true],

        // Equity
        ['code' => '3000', 'name' => 'Equity', 'type' => 'equity', 'group' => 'equity', 'is_system' => true],
        ['code' => '3100', 'name' => 'Reserves and Surplus', 'type' => 'equity', 'group' => 'equity', 'is_system' => true],

        // Income
        ['code' => '4000', 'name' => 'Sales', 'type' => 'income', 'group' => 'sales', 'is_system' => true],
        ['code' => '4100', 'name' => 'Other Income', 'type' => 'income', 'group' => 'other_income', 'is_system' => true],
        ['code' => '4200', 'name' => 'Purchase Returns', 'type' => 'income', 'group' => 'other_income', 'is_system' => true],

        // Expenses
        ['code' => '5000', 'name' => 'Purchases', 'type' => 'expense', 'group' => 'purchase', 'is_system' => true],
        ['code' => '5100', 'name' => 'Direct Expenses', 'type' => 'expense', 'group' => 'direct_expense', 'is_system' => true],
        ['code' => '5200', 'name' => 'Indirect Expenses', 'type' => 'expense', 'group' => 'indirect_expense', 'is_system' => true],
        ['code' => '5300', 'name' => 'Financial Expenses', 'type' => 'expense', 'group' => 'financial_expense', 'is_system' => true],
        ['code' => '5400', 'name' => 'Sales Returns', 'type' => 'expense', 'group' => 'direct_expense', 'is_system' => true],
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get the first company
        $company = Company::first();

        if (! $company) {
            $company = Company::factory()->create();
        }

        // Create standard chart of accounts
        foreach ($this->standardAccounts as $account) {
            ChartOfAccount::factory()->create([
                'company_id' => $company->id,
                'parent_id' => null,
                'code' => $account['code'],
                'name' => $account['name'],
                'type' => $account['type'],
                'group' => $account['group'],
                'is_system' => $account['is_system'],
                'is_active' => true,
            ]);
        }

        // Create additional accounts if needed
        if (app()->environment('local', 'testing')) {
            ChartOfAccount::factory()->count(20)->create([
                'company_id' => $company->id,
            ]);
        }
    }
}
