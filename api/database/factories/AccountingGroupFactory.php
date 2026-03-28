<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

class AccountingGroupFactory extends Factory
{
    public function definition(): array
    {
        $types = ['asset', 'liability', 'equity', 'income', 'expense'];
        $groups = [
            'asset' => ['current_asset', 'fixed_asset', 'investment'],
            'liability' => ['current_liability', 'long_term_liability'],
            'equity' => ['equity'],
            'income' => ['sales', 'other_income'],
            'expense' => ['purchase', 'direct_expense', 'indirect_expense', 'financial_expense'],
        ];

        $type = fake()->randomElement($types);
        $group = fake()->randomElement($groups[$type]);

        return [
            'company_id' => Company::factory(),
            'parent_id' => null,
            'code' => fake()->unique()->regexify('[1-9][0-9]{3}'),
            'name' => fake()->words(3, true),
            'type' => $type,
            'group' => $group,
            'is_system' => false,
            'is_active' => true,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
