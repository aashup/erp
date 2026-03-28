<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountingGroup;
use App\Models\FinancialYear;
use App\Models\Voucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Trial Balance — all accounts with their net balance.
     *
     * Balance = Opening Balance + Sum(Debits) - Sum(Credits)
     * For liability/income/equity: natural credit balance
     * For asset/expense: natural debit balance
     */
    public function trialBalance(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;

        // Date range: explicit params override FY dates
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        // Get ALL active accounts (frontend builds tree & filters zero-balance)
        $accounts = AccountingGroup::where('company_id', $companyId)
            ->where('is_active', true)
            ->orderBy('code')
            ->get();

        // Pre-compute which accounts are groups (have children) — avoids N+1
        $parentIds = $accounts->whereNotNull('parent_id')->pluck('parent_id')->unique()->toArray();

        // Get journal line totals grouped by account_id
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true);

        if ($dateFrom && $dateTo) {
            $query->whereDate('vouchers.voucher_date', '>=', $dateFrom)
                ->whereDate('vouchers.voucher_date', '<=', $dateTo);
        }

        $totals = $query->select(
            'voucher_lines.account_id',
            DB::raw('SUM(voucher_lines.debit) as total_debit'),
            DB::raw('SUM(voucher_lines.credit) as total_credit')
        )
            ->groupBy('voucher_lines.account_id')
            ->get()
            ->keyBy('account_id');

        $trialBalanceRows = [];
        $grandTotalDebit = 0;
        $grandTotalCredit = 0;

        foreach ($accounts as $account) {
            $txn = $totals[$account->id] ?? null;
            $txnDebit = (float) ($txn->total_debit ?? 0);
            $txnCredit = (float) ($txn->total_credit ?? 0);

            $openingDebit = $account->balance_type === 'dr' ? (float) $account->opening_balance : 0;
            $openingCredit = $account->balance_type === 'cr' ? (float) $account->opening_balance : 0;

            $totalDebit = $openingDebit + $txnDebit;
            $totalCredit = $openingCredit + $txnCredit;

            $net = $totalDebit - $totalCredit;
            $closingDebit = $net > 0 ? round($net, 2) : 0;
            $closingCredit = $net < 0 ? round(abs($net), 2) : 0;

            $grandTotalDebit += $closingDebit;
            $grandTotalCredit += $closingCredit;

            $trialBalanceRows[] = [
                'account_id' => $account->id,
                'code' => $account->code,
                'name' => $account->name,
                'type' => $account->type,
                'parent_id' => $account->parent_id,
                'is_group' => in_array($account->id, $parentIds),
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
        // Explicit date params take priority
        if ($request->date_from && $request->date_to) {
            return [$request->date_from, $request->date_to];
        }

        // Fall back to FY dates (auto-attached by axios interceptor)
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
     * Groups: Income (type=income), Expenses (type=expense)
     */
    public function profitAndLoss(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        // Get income and expense accounts
        $accounts = AccountingGroup::where('company_id', $companyId)
            ->where('is_active', true)
            ->whereIn('type', ['income', 'expense'])
            ->orderBy('code')
            ->get();

        // Get journal line totals
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->whereIn('voucher_lines.account_id', $accounts->pluck('id'));

        if ($dateFrom && $dateTo) {
            $query->whereDate('vouchers.voucher_date', '>=', $dateFrom)
                ->whereDate('vouchers.voucher_date', '<=', $dateTo);
        }

        $totals = $query->select(
            'voucher_lines.account_id',
            DB::raw('SUM(voucher_lines.debit) as total_debit'),
            DB::raw('SUM(voucher_lines.credit) as total_credit')
        )
            ->groupBy('voucher_lines.account_id')
            ->get()
            ->keyBy('account_id');

        $incomeItems = [];
        $expenseItems = [];
        $totalIncome = 0;
        $totalExpense = 0;

        foreach ($accounts as $account) {
            $txn = $totals[$account->id] ?? null;
            $debit = (float) ($txn->total_debit ?? 0);
            $credit = (float) ($txn->total_credit ?? 0);

            if ($account->type === 'income') {
                // Income: natural credit balance. Amount = Credits - Debits
                $amount = $credit - $debit;
                if ($amount == 0) {
                    continue;
                }
                $totalIncome += $amount;
                $incomeItems[] = [
                    'account_id' => $account->id,
                    'code' => $account->code,
                    'name' => $account->name,
                    'parent_id' => $account->parent_id,
                    'amount' => round($amount, 2),
                ];
            } else {
                // Expense: natural debit balance. Amount = Debits - Credits
                $amount = $debit - $credit;
                if ($amount == 0) {
                    continue;
                }
                $totalExpense += $amount;
                $expenseItems[] = [
                    'account_id' => $account->id,
                    'code' => $account->code,
                    'name' => $account->name,
                    'parent_id' => $account->parent_id,
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
        $party = \App\Models\Party::findOrFail($request->party_id);

        if (! $party->ledger_account_id) {
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

        // Get all journal lines for this party's ledger account
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->where('voucher_lines.account_id', $party->ledger_account_id);

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
        $ledgerAccount = AccountingGroup::find($party->ledger_account_id);
        $openingBalance = $ledgerAccount
            ? ($ledgerAccount->balance_type === 'dr' ? (float) $ledgerAccount->opening_balance : -(float) $ledgerAccount->opening_balance)
            : 0;

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
