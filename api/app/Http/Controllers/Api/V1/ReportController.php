<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FinancialYear;
use App\Models\Ledger;
use App\Models\Party;
use App\Models\Voucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Trial Balance — all ledgers with their net balance.
     *
     * Balance = Opening Balance + Sum(Debits) - Sum(Credits)
     */
    public function trialBalance(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;

        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        // Get all ledgers with their group info
        $ledgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get();

        // Get journal line totals grouped by ledger_id
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true);

        if ($dateFrom && $dateTo) {
            $query->whereDate('vouchers.voucher_date', '>=', $dateFrom)
                ->whereDate('vouchers.voucher_date', '<=', $dateTo);
        }

        $totals = $query->select(
            'voucher_lines.ledger_id',
            DB::raw('SUM(voucher_lines.debit) as total_debit'),
            DB::raw('SUM(voucher_lines.credit) as total_credit')
        )
            ->groupBy('voucher_lines.ledger_id')
            ->get()
            ->keyBy('ledger_id');

        $trialBalanceRows = [];
        $grandTotalDebit = 0;
        $grandTotalCredit = 0;

        foreach ($ledgers as $ledger) {
            $txn = $totals[$ledger->id] ?? null;
            $txnDebit = (float) ($txn->total_debit ?? 0);
            $txnCredit = (float) ($txn->total_credit ?? 0);

            // Opening balance
            $openingDebit = $ledger->opening_type === 'dr' ? (float) $ledger->opening_balance : 0;
            $openingCredit = $ledger->opening_type === 'cr' ? (float) $ledger->opening_balance : 0;

            $totalDebit = $openingDebit + $txnDebit;
            $totalCredit = $openingCredit + $txnCredit;

            $net = $totalDebit - $totalCredit;
            $closingDebit = $net > 0 ? round($net, 2) : 0;
            $closingCredit = $net < 0 ? round(abs($net), 2) : 0;

            $grandTotalDebit += $closingDebit;
            $grandTotalCredit += $closingCredit;

            $trialBalanceRows[] = [
                'ledger_id' => $ledger->id,
                'name' => $ledger->name,
                'group_id' => $ledger->group_id,
                'group_name' => $ledger->group?->name,
                'group_type' => $ledger->group?->type,
                'group_code' => $ledger->group?->code,
                'parent_id' => $ledger->group?->parent_id,
                'opening_debit' => round($openingDebit, 2),
                'opening_credit' => round($openingCredit, 2),
                'txn_debit' => round($txnDebit, 2),
                'txn_credit' => round($txnCredit, 2),
                'closing_debit' => $closingDebit,
                'closing_credit' => $closingCredit,
            ];
        }

        return response()->json([
            'data' => $trialBalanceRows,
            'summary' => [
                'total_debit' => round($grandTotalDebit, 2),
                'total_credit' => round($grandTotalCredit, 2),
                'difference' => round($grandTotalDebit - $grandTotalCredit, 2),
            ],
        ]);
    }

    /**
     * Resolve date range from explicit params or FY.
     */
    private function resolveDateRange(Request $request): array
    {
        if ($request->date_from && $request->date_to) {
            return [$request->date_from, $request->date_to];
        }

        $fyId = $request->financial_year_id;
        if ($fyId) {
            $fy = FinancialYear::find($fyId);
            if ($fy) {
                return [$fy->start_date, $fy->end_date];
            }
        }

        return [null, null];
    }

    /**
     * Profit & Loss Statement.
     *
     * Income - Expenses = Net Profit/Loss
     */
    public function profitAndLoss(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        // Get income and expense ledgers via their group type
        $ledgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereHas('group', fn ($q) => $q->whereIn('type', ['income', 'expense']))
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get();

        // Get journal line totals
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->whereIn('voucher_lines.ledger_id', $ledgers->pluck('id'));

        if ($dateFrom && $dateTo) {
            $query->whereDate('vouchers.voucher_date', '>=', $dateFrom)
                ->whereDate('vouchers.voucher_date', '<=', $dateTo);
        }

        $totals = $query->select(
            'voucher_lines.ledger_id',
            DB::raw('SUM(voucher_lines.debit) as total_debit'),
            DB::raw('SUM(voucher_lines.credit) as total_credit')
        )
            ->groupBy('voucher_lines.ledger_id')
            ->get()
            ->keyBy('ledger_id');

        $incomeItems = [];
        $expenseItems = [];
        $totalIncome = 0;
        $totalExpense = 0;

        foreach ($ledgers as $ledger) {
            $txn = $totals[$ledger->id] ?? null;
            $debit = (float) ($txn->total_debit ?? 0);
            $credit = (float) ($txn->total_credit ?? 0);
            $groupType = $ledger->group?->type;

            if ($groupType === 'income') {
                $amount = $credit - $debit;
                if ($amount == 0) {
                    continue;
                }
                $totalIncome += $amount;
                $incomeItems[] = [
                    'ledger_id' => $ledger->id,
                    'name' => $ledger->name,
                    'group_name' => $ledger->group?->name,
                    'group_id' => $ledger->group_id,
                    'parent_id' => $ledger->group?->parent_id,
                    'amount' => round($amount, 2),
                ];
            } else {
                $amount = $debit - $credit;
                if ($amount == 0) {
                    continue;
                }
                $totalExpense += $amount;
                $expenseItems[] = [
                    'ledger_id' => $ledger->id,
                    'name' => $ledger->name,
                    'group_name' => $ledger->group?->name,
                    'group_id' => $ledger->group_id,
                    'parent_id' => $ledger->group?->parent_id,
                    'amount' => round($amount, 2),
                ];
            }
        }

        $netProfitLoss = $totalIncome - $totalExpense;

        return response()->json([
            'data' => [
                'income' => [
                    'items' => $incomeItems,
                    'total' => round($totalIncome, 2),
                ],
                'expense' => [
                    'items' => $expenseItems,
                    'total' => round($totalExpense, 2),
                ],
                'net_profit_loss' => round($netProfitLoss, 2),
                'is_profit' => $netProfitLoss >= 0,
            ],
        ]);
    }

    /**
     * Party Ledger — all transactions for a specific party.
     */
    public function partyLedger(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
        ]);

        $companyId = $request->user()->company_id;
        $party = Party::findOrFail($request->party_id);

        // Collect all ledger IDs for this party
        $ledgerIds = array_filter([
            $party->debtor_ledger_id,
            $party->creditor_ledger_id,
        ]);

        if (empty($ledgerIds)) {
            return response()->json(['data' => [], 'opening_balance' => 0, 'closing_balance' => 0]);
        }

        $fyId = $request->financial_year_id;
        $dateFrom = null;
        $dateTo = null;
        if ($fyId) {
            $fy = FinancialYear::find($fyId);
            if ($fy) {
                $dateFrom = $fy->start_date;
                $dateTo = $fy->end_date;
            }
        }

        // Get all journal lines for this party's ledger(s)
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->whereIn('voucher_lines.ledger_id', $ledgerIds);

        if ($dateFrom && $dateTo) {
            $query->whereDate('vouchers.voucher_date', '>=', $dateFrom)
                ->whereDate('vouchers.voucher_date', '<=', $dateTo);
        }

        $entries = $query->select(
            'vouchers.voucher_number',
            'vouchers.voucher_date',
            'vouchers.voucher_type',
            'vouchers.narration as entry_narration',
            'voucher_lines.debit',
            'voucher_lines.credit',
            'voucher_lines.narration as line_narration'
        )
            ->orderBy('vouchers.voucher_date')
            ->orderBy('vouchers.created_at')
            ->get();

        // Calculate running balance
        $openingBalance = (float) $party->opening_balance;
        if ($party->balance_type === 'cr') {
            $openingBalance = -$openingBalance;
        }

        $runningBalance = $openingBalance;
        $rows = [];

        foreach ($entries as $entry) {
            $debit = (float) $entry->debit;
            $credit = (float) $entry->credit;
            $runningBalance += ($debit - $credit);

            $rows[] = [
                'voucher_number' => $entry->voucher_number,
                'voucher_date' => $entry->voucher_date,
                'voucher_type' => $entry->voucher_type,
                'narration' => $entry->line_narration ?? $entry->entry_narration,
                'debit' => round($debit, 2),
                'credit' => round($credit, 2),
                'balance' => round($runningBalance, 2),
            ];
        }

        return response()->json([
            'data' => $rows,
            'party' => [
                'id' => $party->id,
                'name' => $party->name,
                'type' => $party->type,
            ],
            'opening_balance' => round($openingBalance, 2),
            'closing_balance' => round($runningBalance, 2),
        ]);
    }
}
