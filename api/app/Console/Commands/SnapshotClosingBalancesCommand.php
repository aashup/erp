<?php

namespace App\Console\Commands;

use App\Models\FinancialYear;
use App\Models\Ledger;
use App\Models\LedgerClosingBalance;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SnapshotClosingBalancesCommand extends Command
{
    protected $signature = 'accounting:snapshot-closing-balances {financial_year_id : The UUID of the financial year}';

    protected $description = 'Calculate and persist the closing balance for every ledger in the given financial year';

    public function handle(): int
    {
        $fyId = $this->argument('financial_year_id');

        $fy = FinancialYear::find($fyId);

        if (!$fy) {
            $this->error("Financial year [{$fyId}] not found.");
            return self::FAILURE;
        }

        $this->info("Snapshotting closing balances for FY: {$fy->label} (company: {$fy->company_id})");

        // Fetch all active ledgers for this company
        $ledgers = Ledger::where('company_id', $fy->company_id)->get();

        if ($ledgers->isEmpty()) {
            $this->warn('No ledgers found for this company.');
            return self::SUCCESS;
        }

        // Sum debits/credits per ledger for all posted vouchers in this FY
        $totals = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $fy->company_id)
            ->where('vouchers.financial_year_id', $fyId)
            ->where('vouchers.is_posted', true)
            ->groupBy('voucher_lines.ledger_id')
            ->select(
                'voucher_lines.ledger_id',
                DB::raw('SUM(voucher_lines.debit) as total_debit'),
                DB::raw('SUM(voucher_lines.credit) as total_credit')
            )
            ->get()
            ->keyBy('ledger_id');

        $created = 0;
        $updated = 0;

        foreach ($ledgers as $ledger) {
            $openingDebit  = $ledger->opening_type === 'dr' ? (float) $ledger->opening_balance : 0;
            $openingCredit = $ledger->opening_type === 'cr' ? (float) $ledger->opening_balance : 0;

            $txnRow     = $totals->get($ledger->id);
            $txnDebit   = $txnRow ? (float) $txnRow->total_debit  : 0;
            $txnCredit  = $txnRow ? (float) $txnRow->total_credit : 0;

            $net = ($openingDebit + $txnDebit) - ($openingCredit + $txnCredit);

            $closingBalance = abs($net);
            $balanceType    = $net >= 0 ? 'dr' : 'cr';

            $existing = LedgerClosingBalance::where('financial_year_id', $fyId)
                ->where('ledger_id', $ledger->id)
                ->first();

            if ($existing) {
                $existing->update([
                    'closing_balance' => $closingBalance,
                    'balance_type'    => $balanceType,
                ]);
                $updated++;
            } else {
                LedgerClosingBalance::create([
                    'company_id'        => $fy->company_id,
                    'financial_year_id' => $fyId,
                    'ledger_id'         => $ledger->id,
                    'closing_balance'   => $closingBalance,
                    'balance_type'      => $balanceType,
                ]);
                $created++;
            }
        }

        $total = $created + $updated;
        $this->info("Done. Processed {$total} ledgers — Created: {$created}, Updated: {$updated}.");

        return self::SUCCESS;
    }
}
