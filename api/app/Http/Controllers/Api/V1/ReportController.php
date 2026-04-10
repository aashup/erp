<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountingGroup;
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

        // 1. All active accounting groups — returned as folder/group rows
        $groups = AccountingGroup::where('company_id', $companyId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        // 2. All ledgers with their group info
        $ledgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get();

        // 3. Voucher line totals per ledger
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

        $rows = [];
        $grandTotalDebit = 0;
        $grandTotalCredit = 0;

        // Group rows (is_group = true) — values are aggregated on the frontend from children
        foreach ($groups as $group) {
            $rows[] = [
                'account_id'     => $group->id,
                'name'           => $group->name,
                'code'           => $group->code ?? '',
                'type'           => $group->type,
                'parent_id'      => $group->parent_id, // null for root groups
                'is_group'       => true,
                'opening_debit'  => 0,
                'opening_credit' => 0,
                'txn_debit'      => 0,
                'txn_credit'     => 0,
                'closing_debit'  => 0,
                'closing_credit' => 0,
            ];
        }

        // Ledger rows (is_group = false) — parent is their accounting group
        foreach ($ledgers as $ledger) {
            $txn = $totals[$ledger->id] ?? null;
            $txnDebit  = (float) ($txn->total_debit ?? 0);
            $txnCredit = (float) ($txn->total_credit ?? 0);

            $openingDebit  = $ledger->opening_type === 'dr' ? (float) $ledger->opening_balance : 0;
            $openingCredit = $ledger->opening_type === 'cr' ? (float) $ledger->opening_balance : 0;

            $totalDebit  = $openingDebit + $txnDebit;
            $totalCredit = $openingCredit + $txnCredit;

            $net = $totalDebit - $totalCredit;
            $closingDebit  = $net > 0 ? round($net, 2) : 0;
            $closingCredit = $net < 0 ? round(abs($net), 2) : 0;

            $grandTotalDebit  += $closingDebit;
            $grandTotalCredit += $closingCredit;

            $rows[] = [
                'account_id'     => $ledger->id,
                'name'           => $ledger->name,
                'code'           => $ledger->group?->code ?? '',
                'type'           => $ledger->group?->type ?? 'asset',
                'parent_id'      => $ledger->group_id, // ledger's parent = its accounting group
                'is_group'       => false,
                'opening_debit'  => round($openingDebit, 2),
                'opening_credit' => round($openingCredit, 2),
                'txn_debit'      => round($txnDebit, 2),
                'txn_credit'     => round($txnCredit, 2),
                'closing_debit'  => $closingDebit,
                'closing_credit' => $closingCredit,
            ];
        }

        return response()->json([
            'data' => $rows,
            'summary' => [
                'total_debit'  => round($grandTotalDebit, 2),
                'total_credit' => round($grandTotalCredit, 2),
                'difference'   => round($grandTotalDebit - $grandTotalCredit, 2),
            ],
        ]);
    }

    /**
     * Ledger drill-down — all posted voucher lines for a specific ledger
     * with opening balance and running balance.
     */
    public function ledgerTransactions(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $request->validate(['ledger_id' => 'required|uuid|exists:ledgers,id']);

        $companyId = $request->user()->company_id;
        $ledger = Ledger::with('group')
            ->where('company_id', $companyId)
            ->findOrFail($request->ledger_id);

        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->where('voucher_lines.ledger_id', $ledger->id);

        if ($dateFrom && $dateTo) {
            $query->whereDate('vouchers.voucher_date', '>=', $dateFrom)
                ->whereDate('vouchers.voucher_date', '<=', $dateTo);
        }

        $entries = $query->select(
            'vouchers.id as voucher_id',
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

        $openingDebit  = $ledger->opening_type === 'dr' ? (float) $ledger->opening_balance : 0;
        $openingCredit = $ledger->opening_type === 'cr' ? (float) $ledger->opening_balance : 0;
        $runningBalance = $openingDebit - $openingCredit;

        $rows = [];
        foreach ($entries as $entry) {
            $debit  = (float) $entry->debit;
            $credit = (float) $entry->credit;
            $runningBalance += ($debit - $credit);

            $rows[] = [
                'voucher_id'     => $entry->voucher_id,
                'voucher_number' => $entry->voucher_number,
                'voucher_date'   => $entry->voucher_date,
                'voucher_type'   => $entry->voucher_type,
                'narration'      => $entry->line_narration ?? $entry->entry_narration,
                'debit'          => round($debit, 2),
                'credit'         => round($credit, 2),
                'balance'        => round($runningBalance, 2),
            ];
        }

        return response()->json([
            'ledger' => [
                'id'             => $ledger->id,
                'name'           => $ledger->name,
                'group_name'     => $ledger->group?->name,
                'opening_debit'  => round($openingDebit, 2),
                'opening_credit' => round($openingCredit, 2),
            ],
            'data'            => $rows,
            'closing_balance' => round($runningBalance, 2),
        ]);
    }

    /**
     * Calculate Opening and Closing stock values for P&L.
     *
     * Strategy: SUM(quantity) per item × item.purchase_price.
     * We use quantity (properly signed: +in / -out) rather than the value
     * column because sales entries store the selling price (positive),
     * not the cost, so SUM(value) is incorrect for stock valuation.
     *
     * @return array{float, float} [openingStockValue, closingStockValue]
     */
    private function calcStockValues(string $companyId, ?string $dateFrom, ?string $dateTo): array
    {
        // Helper: sum of (qty × item.purchase_price) for all items with a given date filter
        $stockValue = function (?string $beforeDate, ?string $upToDate) use ($companyId): float {
            $query = DB::table('stock_ledger as sl')
                ->where('sl.company_id', $companyId);

            if ($beforeDate) {
                $query->whereDate('sl.created_at', '<', $beforeDate);
            } elseif ($upToDate) {
                $query->whereDate('sl.created_at', '<=', $upToDate);
            }

            $rows = $query
                ->select('sl.item_id', DB::raw('SUM(sl.quantity) as total_qty'))
                ->groupBy('sl.item_id')
                ->havingRaw('SUM(sl.quantity) > 0')
                ->get();

            if ($rows->isEmpty()) {
                return 0.0;
            }

            $itemIds = $rows->pluck('item_id')->toArray();
            $prices  = DB::table('items')
                ->whereIn('id', $itemIds)
                ->pluck('purchase_price', 'id');

            $value = 0.0;
            foreach ($rows as $row) {
                $price = (float) ($prices[$row->item_id] ?? 0);
                $value += (float) $row->total_qty * $price;
            }

            return $value;
        };

        if ($dateFrom) {
            // Date range provided: opening = stock on hand BEFORE period start
            $openingStock = $stockValue($dateFrom, null);
            $closingStock = $stockValue(null, $dateTo ?? date('Y-m-d'));
        } else {
            // No date range: opening = only 'opening' type entries (preserves the
            // original entered rate), closing = current stock at purchase price
            $openingStock = (float) DB::table('stock_ledger')
                ->where('company_id', $companyId)
                ->where('type', 'opening')
                ->sum('value');

            $closingStock = $stockValue(null, null);
        }

        return [$openingStock, $closingStock];
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
     * Profit & Loss Statement — hierarchical income/expense groups and ledgers.
     *
     * Returns a flat list of rows (groups + ledgers) that the frontend builds
     * into an expandable tree. Groups have amount=0 (frontend aggregates from children).
     */
    public function profitAndLoss(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        // 1. All active income/expense accounting groups
        $groups = AccountingGroup::where('company_id', $companyId)
            ->whereIn('type', ['income', 'expense'])
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        // 2. All income/expense ledgers
        $ledgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereHas('group', fn ($q) => $q->whereIn('type', ['income', 'expense']))
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get();

        // 3. Voucher line totals
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

        $rows = [];
        $totalIncome  = 0;
        $totalExpense = 0;

        // Group rows — values are 0, frontend aggregates from children
        foreach ($groups as $group) {
            $rows[] = [
                'account_id' => $group->id,
                'name'       => $group->name,
                'code'       => $group->code ?? '',
                'type'       => $group->type,
                'parent_id'  => $group->parent_id,
                'is_group'   => true,
                'amount'     => 0,
            ];
        }

        // Ledger rows
        foreach ($ledgers as $ledger) {
            $txn    = $totals[$ledger->id] ?? null;
            $debit  = (float) ($txn->total_debit ?? 0);
            $credit = (float) ($txn->total_credit ?? 0);

            // Include opening balance in P&L amount
            $openingDebit  = $ledger->opening_type === 'dr' ? (float) $ledger->opening_balance : 0;
            $openingCredit = $ledger->opening_type === 'cr' ? (float) $ledger->opening_balance : 0;

            $totalDebit  = $openingDebit + $debit;
            $totalCredit = $openingCredit + $credit;

            $groupType = $ledger->group?->type;

            if ($groupType === 'income') {
                $amount = $totalCredit - $totalDebit; // income = net credit
                $totalIncome += $amount;
            } else {
                $amount = $totalDebit - $totalCredit; // expense = net debit
                $totalExpense += $amount;
            }

            $rows[] = [
                'account_id' => $ledger->id,
                'name'       => $ledger->name,
                'code'       => $ledger->group?->code ?? '',
                'type'       => $groupType ?? 'expense',
                'parent_id'  => $ledger->group_id, // ledger's parent = its accounting group
                'is_group'   => false,
                'amount'     => round($amount, 2),
            ];
        }

        // ── Stock Valuation ────────────────────────────────────────────────────
        // Sales entries store value as positive (selling price), so we cannot
        // use SUM(value) directly. We use SUM(quantity) × item.purchase_price
        // per item to get the cost-based stock value.

        [$openingStockValue, $closingStockValue] = $this->calcStockValues($companyId, $dateFrom, $dateTo);

        // Net P&L in Tally format:
        //   Gross = (Sales + Closing Stock) − (Purchases + Opening Stock + Direct Exp)
        //   Net   = Gross + Indirect Income − Indirect Expenses
        // Simplified: Net = totalIncome + closingStock − totalExpense − openingStock
        $netProfitLoss = $totalIncome - $totalExpense + $closingStockValue - $openingStockValue;

        return response()->json([
            'data' => $rows,
            'summary' => [
                'total_income'    => round($totalIncome, 2),
                'total_expense'   => round($totalExpense, 2),
                'opening_stock'   => round($openingStockValue, 2),
                'closing_stock'   => round($closingStockValue, 2),
                'net_profit_loss' => round($netProfitLoss, 2),
                'is_profit'       => $netProfitLoss >= 0,
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
