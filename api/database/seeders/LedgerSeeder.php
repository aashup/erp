<?php

namespace Database\Seeders;

use App\Models\AccountingGroup;
use App\Models\Company;
use App\Models\Ledger;
use App\Models\User;
use Illuminate\Database\Seeder;

class LedgerSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $user = User::where('company_id', $company->id)->first();
        if (! $user) {
            return;
        }

        $groups = AccountingGroup::where('company_id', $company->id)->get();
        $cashGroup = $groups->where('system_key', 'cash_account')->first();
        $bankGroup = $groups->where('system_key', 'bank_account')->first();
        $salesGroup = $groups->where('system_key', 'sales_account')->first();
        $purchaseGroup = $groups->where('system_key', 'purchase_account')->first();

        $ledgers = [
            [
                'name' => 'Cash',
                'alias' => 'Cash A/c',
                'group_id' => $cashGroup?->id,
                'opening_balance' => 50000,
                'opening_type' => 'dr',
            ],
            [
                'name' => 'HDFC Bank',
                'alias' => 'HDFC Current A/c',
                'group_id' => $bankGroup?->id,
                'opening_balance' => 250000,
                'opening_type' => 'dr',
            ],
            [
                'name' => 'SBI Bank',
                'alias' => null,
                'group_id' => $bankGroup?->id,
                'opening_balance' => 150000,
                'opening_type' => 'dr',
            ],
            [
                'name' => 'Sales - General',
                'alias' => null,
                'group_id' => $salesGroup?->id,
                'opening_balance' => 0,
                'opening_type' => 'cr',
            ],
            [
                'name' => 'Purchase - General',
                'alias' => null,
                'group_id' => $purchaseGroup?->id,
                'opening_balance' => 0,
                'opening_type' => 'dr',
            ],
        ];

        foreach ($ledgers as $data) {
            if (! $data['group_id']) {
                continue;
            }

            Ledger::create([
                'company_id' => $company->id,
                ...$data,
                'is_system' => false,
                'allow_manual_entry' => true,
                'created_by' => $user->id,
                'updated_by' => $user->id,
                'sync_status' => 'synced',
                'synced_at' => now(),
                'updated_at_local' => now(),
            ]);
        }
    }
}
