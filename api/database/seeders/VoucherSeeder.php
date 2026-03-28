<?php

namespace Database\Seeders;

use App\Models\AccountingGroup;
use App\Models\Company;
use App\Models\FinancialYear;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherLine;
use Illuminate\Database\Seeder;

class VoucherSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $fy = FinancialYear::where('company_id', $company->id)->where('is_current', true)->first();
        $user = User::where('company_id', $company->id)->first();
        $accounts = AccountingGroup::where('company_id', $company->id)->get();

        if (! $fy || ! $user || $accounts->count() < 4) {
            return;
        }

        $cashAccount = $accounts->where('code', '1300')->first();
        $salesAccount = $accounts->where('code', '4000')->first();
        $purchaseAccount = $accounts->where('code', '5000')->first();
        $expenseAccount = $accounts->where('code', '5200')->first();

        if (! $cashAccount || ! $salesAccount || ! $purchaseAccount || ! $expenseAccount) {
            return;
        }

        // Manual voucher entries
        $entries = [
            [
                'voucher_type' => 'journal',
                'narration' => 'Office rent payment for the month',
                'lines' => [
                    ['account_id' => $expenseAccount->id, 'debit' => 15000, 'credit' => 0],
                    ['account_id' => $cashAccount->id, 'debit' => 0, 'credit' => 15000],
                ],
            ],
            [
                'voucher_type' => 'receipt',
                'narration' => 'Cash sales collection',
                'lines' => [
                    ['account_id' => $cashAccount->id, 'debit' => 25000, 'credit' => 0],
                    ['account_id' => $salesAccount->id, 'debit' => 0, 'credit' => 25000],
                ],
            ],
            [
                'voucher_type' => 'payment',
                'narration' => 'Purchase payment via cash',
                'lines' => [
                    ['account_id' => $purchaseAccount->id, 'debit' => 35000, 'credit' => 0],
                    ['account_id' => $cashAccount->id, 'debit' => 0, 'credit' => 35000],
                ],
            ],
        ];

        foreach ($entries as $idx => $entry) {
            $voucher = Voucher::create([
                'company_id' => $company->id,
                'financial_year_id' => $fy->id,
                'voucher_number' => 'JV-'.str_pad($idx + 1, 6, '0', STR_PAD_LEFT),
                'voucher_date' => now()->subDays(rand(1, 30)),
                'voucher_type' => $entry['voucher_type'],
                'narration' => $entry['narration'],
                'source' => 'manual',
                'is_posted' => true,
                'created_by' => $user->id,
                'sync_status' => 'synced',
                'synced_at' => now(),
                'updated_at_local' => now(),
            ]);

            foreach ($entry['lines'] as $line) {
                VoucherLine::create([
                    'voucher_id' => $voucher->id,
                    'account_id' => $line['account_id'],
                    'debit' => $line['debit'],
                    'credit' => $line['credit'],
                    'sync_status' => 'synced',
                    'synced_at' => now(),
                    'updated_at_local' => now(),
                ]);
            }
        }
    }
}
