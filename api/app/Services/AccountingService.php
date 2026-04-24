<?php

namespace App\Services;

use App\Models\AccountingGroup;
use App\Models\CompanySetting;
use App\Models\FinancialYear;
use App\Models\Ledger;
use App\Models\Party;
use App\Models\PayrollRun;
use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;

class AccountingService
{
    /**
     * Create a journal entry for a confirmed Sales Invoice.
     *
     * Dr: Party Debtor Ledger (grand_total)
     *   Cr: Sales Ledger (taxable_amount)
     *   Cr: Output CGST/SGST/IGST Ledgers
     */
    public function postSalesInvoice(SalesInvoice $invoice, string $userId): ?Voucher
    {
        $companyId = $invoice->company_id;
        $party = Party::find($invoice->party_id);

        if (! $party || ! $party->debtor_ledger_id) {
            return null;
        }

        $salesLedger = Ledger::findBySystemKey($companyId, 'sales_account');
        if (! $salesLedger) {
            return null;
        }

        $fy = $this->getCurrentFY($companyId, $invoice->invoice_date);
        if (! $fy) {
            return null;
        }

        return DB::transaction(function () use ($invoice, $party, $salesLedger, $companyId, $userId, $fy) {
            $voucherNumber = $this->generateVoucherNumber($companyId, 'sales');

            $entry = Voucher::create([
                'company_id' => $companyId,
                'financial_year_id' => $fy->id,
                'voucher_number' => $voucherNumber,
                'voucher_date' => $invoice->invoice_date,
                'voucher_type' => 'sales',
                'narration' => "Sales Invoice #{$invoice->invoice_number} to {$party->name}",
                'source' => 'auto',
                'reference_type' => SalesInvoice::class,
                'reference_id' => $invoice->id,
                'is_posted' => true,
                'created_by' => $userId,
            ]);

            // Dr: Party Debtor Ledger (grand_total)
            $entry->lines()->create([
                'ledger_id' => $party->debtor_ledger_id,
                'debit' => $invoice->grand_total,
                'credit' => 0,
                'narration' => "Sale to {$party->name}",
            ]);

            // Cr: Sales Ledger (taxable_amount)
            $entry->lines()->create([
                'ledger_id' => $salesLedger->id,
                'debit' => 0,
                'credit' => $invoice->taxable_amount,
                'narration' => 'Sales revenue',
            ]);

            // Cr: GST output ledgers
            $this->addGstCreditLines($entry, $companyId, $invoice->cgst_total, $invoice->sgst_total, $invoice->igst_total, 'output');

            // Round-off balancing line
            $roundOff = (float) ($invoice->round_off ?? 0);
            if (abs($roundOff) > 0.001) {
                $roundOffLedger = Ledger::findBySystemKey($companyId, 'round_off');
                if (! $roundOffLedger) {
                    $indirectIncomeGroup = AccountingGroup::where('company_id', $companyId)
                        ->where('name', 'Indirect Income')->first();
                    if ($indirectIncomeGroup) {
                        $roundOffLedger = Ledger::firstOrCreate(
                            ['company_id' => $companyId, 'system_key' => 'round_off'],
                            ['name' => 'Round Off', 'group_id' => $indirectIncomeGroup->id, 'is_system' => true, 'created_by' => $userId]
                        );
                    }
                }
                if ($roundOffLedger) {
                    if ($roundOff > 0) {
                        // Rounded up → customer paid more → Cr round_off (income)
                        $entry->lines()->create(['ledger_id' => $roundOffLedger->id, 'debit' => 0, 'credit' => $roundOff, 'narration' => 'Round Off']);
                    } else {
                        // Rounded down → customer paid less → Dr round_off (expense)
                        $entry->lines()->create(['ledger_id' => $roundOffLedger->id, 'debit' => abs($roundOff), 'credit' => 0, 'narration' => 'Round Off']);
                    }
                }
            }

            return $entry;
        });
    }

    /**
     * Create a journal entry for a Purchase Invoice.
     *
     * Dr: Purchase Ledger (taxable_amount)
     * Dr: Input CGST/SGST/IGST Ledgers
     *   Cr: Party Creditor Ledger (grand_total)
     */
    public function postPurchaseInvoice(PurchaseInvoice $invoice, string $userId): ?Voucher
    {
        $companyId = $invoice->company_id;
        $party = Party::find($invoice->party_id);

        if (! $party || ! $party->creditor_ledger_id) {
            return null;
        }

        $purchaseLedger = Ledger::findBySystemKey($companyId, 'purchase_account');
        if (! $purchaseLedger) {
            return null;
        }

        $fy = $this->getCurrentFY($companyId, $invoice->invoice_date);
        if (! $fy) {
            return null;
        }

        return DB::transaction(function () use ($invoice, $party, $purchaseLedger, $companyId, $userId, $fy) {
            $voucherNumber = $this->generateVoucherNumber($companyId, 'purchase');

            $entry = Voucher::create([
                'company_id' => $companyId,
                'financial_year_id' => $fy->id,
                'voucher_number' => $voucherNumber,
                'voucher_date' => $invoice->invoice_date,
                'voucher_type' => 'purchase',
                'narration' => "Purchase Invoice #{$invoice->invoice_number} from {$party->name}",
                'source' => 'auto',
                'reference_type' => PurchaseInvoice::class,
                'reference_id' => $invoice->id,
                'is_posted' => true,
                'created_by' => $userId,
            ]);

            // Dr: Purchase Ledger (taxable_amount)
            $entry->lines()->create([
                'ledger_id' => $purchaseLedger->id,
                'debit' => $invoice->taxable_amount,
                'credit' => 0,
                'narration' => 'Purchase expense',
            ]);

            // Dr: GST input ledgers
            $this->addGstDebitLines($entry, $companyId, $invoice->cgst_total, $invoice->sgst_total, $invoice->igst_total, 'input');

            // Cr: Party Creditor Ledger (grand_total)
            $entry->lines()->create([
                'ledger_id' => $party->creditor_ledger_id,
                'debit' => 0,
                'credit' => $invoice->grand_total,
                'narration' => "Purchase from {$party->name}",
            ]);

            return $entry;
        });
    }

    /**
     * Create a journal entry for a Payment (paying a vendor).
     *
     * Dr: Party Creditor Ledger (amount)
     *   Cr: Cash/Bank Ledger (amount)
     */
    public function postPayment(string $companyId, Party $party, float $amount, string $paymentMode, string $receiptDate, string $narration, string $userId, ?string $referenceType = null, ?string $referenceId = null): ?Voucher
    {
        if (! $party->creditor_ledger_id) {
            return null;
        }

        $cashOrBank = $this->getCashOrBankLedger($companyId, $paymentMode);
        if (! $cashOrBank) {
            return null;
        }

        $fy = $this->getCurrentFY($companyId, $receiptDate);
        if (! $fy) {
            return null;
        }

        return DB::transaction(function () use ($companyId, $party, $amount, $cashOrBank, $receiptDate, $narration, $userId, $fy, $referenceType, $referenceId) {
            $voucherNumber = $this->generateVoucherNumber($companyId, 'payment');

            $entry = Voucher::create([
                'company_id' => $companyId,
                'financial_year_id' => $fy->id,
                'voucher_number' => $voucherNumber,
                'voucher_date' => $receiptDate,
                'voucher_type' => 'payment',
                'narration' => $narration,
                'source' => 'auto',
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'is_posted' => true,
                'created_by' => $userId,
            ]);

            // Dr: Party Creditor Ledger (reduces creditor balance)
            $entry->lines()->create([
                'ledger_id' => $party->creditor_ledger_id,
                'debit' => $amount,
                'credit' => 0,
                'narration' => "Payment to {$party->name}",
            ]);

            // Cr: Cash/Bank Ledger
            $entry->lines()->create([
                'ledger_id' => $cashOrBank->id,
                'debit' => 0,
                'credit' => $amount,
                'narration' => "Payment via {$cashOrBank->name}",
            ]);

            return $entry;
        });
    }

    /**
     * Create a journal entry for a Receipt (receiving from customer).
     *
     * Dr: Cash/Bank Ledger (amount)
     *   Cr: Party Debtor Ledger (amount)
     */
    public function postReceipt(string $companyId, Party $party, float $amount, string $paymentMode, string $receiptDate, string $narration, string $userId, ?string $referenceType = null, ?string $referenceId = null): ?Voucher
    {
        if (! $party->debtor_ledger_id) {
            return null;
        }

        $cashOrBank = $this->getCashOrBankLedger($companyId, $paymentMode);
        if (! $cashOrBank) {
            return null;
        }

        $fy = $this->getCurrentFY($companyId, $receiptDate);
        if (! $fy) {
            return null;
        }

        return DB::transaction(function () use ($companyId, $party, $amount, $cashOrBank, $receiptDate, $narration, $userId, $fy, $referenceType, $referenceId) {
            $voucherNumber = $this->generateVoucherNumber($companyId, 'receipt');

            $entry = Voucher::create([
                'company_id' => $companyId,
                'financial_year_id' => $fy->id,
                'voucher_number' => $voucherNumber,
                'voucher_date' => $receiptDate,
                'voucher_type' => 'receipt',
                'narration' => $narration,
                'source' => 'auto',
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'is_posted' => true,
                'created_by' => $userId,
            ]);

            // Dr: Cash/Bank Ledger
            $entry->lines()->create([
                'ledger_id' => $cashOrBank->id,
                'debit' => $amount,
                'credit' => 0,
                'narration' => "Receipt via {$cashOrBank->name}",
            ]);

            // Cr: Party Debtor Ledger (reduces debtor balance)
            $entry->lines()->create([
                'ledger_id' => $party->debtor_ledger_id,
                'debit' => 0,
                'credit' => $amount,
                'narration' => "Receipt from {$party->name}",
            ]);

            return $entry;
        });
    }

    /**
     * Create a journal entry for an approved Payroll Run.
     *
     * Dr: Salary Expense (gross + employer PF + employer ESI)
     *   Cr: Salary Payable (net salary)
     *   Cr: PF Payable (employee PF + employer PF)
     *   Cr: ESI Payable (employee ESI + employer ESI)
     *   Cr: PT Payable (professional tax)
     */
    public function postPayroll(PayrollRun $run, string $userId): ?Voucher
    {
        $companyId = $run->company_id;
        $run->loadMissing('entries');

        $totalGross = (float) $run->total_gross;
        $totalNet = (float) $run->total_net;
        $totalPfEmployer = (float) $run->total_pf_employer;
        $totalEsiEmployer = (float) $run->total_esi_employer;

        $totalPfEmployee = $run->entries->sum('pf_employee');
        $totalEsiEmployee = $run->entries->sum('esi_employee');
        $totalPt = $run->entries->sum('professional_tax');
        $totalTds = $run->entries->sum('tds');

        $salaryExpenseLedger = Ledger::findBySystemKey($companyId, 'salary_expense');
        $salaryPayableLedger = Ledger::findBySystemKey($companyId, 'salary_payable');

        if (! $salaryExpenseLedger || ! $salaryPayableLedger) {
            return null;
        }

        $voucherDate = date('Y-m-d', mktime(0, 0, 0, $run->month, 1, $run->year));
        $fy = $this->getCurrentFY($companyId, $voucherDate);
        if (! $fy) {
            return null;
        }

        return DB::transaction(function () use (
            $run, $companyId, $userId, $fy, $voucherDate,
            $totalGross, $totalNet, $totalPfEmployer, $totalEsiEmployer,
            $totalPfEmployee, $totalEsiEmployee, $totalPt, $totalTds,
            $salaryExpenseLedger, $salaryPayableLedger
        ) {
            $periodLabel = date('F Y', mktime(0, 0, 0, $run->month, 1, $run->year));
            $voucherNumber = $this->generateVoucherNumber($companyId, 'payroll');

            $entry = Voucher::create([
                'company_id' => $companyId,
                'financial_year_id' => $fy->id,
                'voucher_number' => $voucherNumber,
                'voucher_date' => $voucherDate,
                'voucher_type' => 'payroll',
                'narration' => "Payroll for {$periodLabel}",
                'source' => 'auto',
                'reference_type' => PayrollRun::class,
                'reference_id' => $run->id,
                'is_posted' => true,
                'created_by' => $userId,
            ]);

            // Dr: Salary Expense = gross + employer PF + employer ESI
            $totalExpense = $totalGross + $totalPfEmployer + $totalEsiEmployer;
            $entry->lines()->create([
                'ledger_id' => $salaryExpenseLedger->id,
                'debit' => $totalExpense,
                'credit' => 0,
                'narration' => "Salary expense for {$periodLabel}",
            ]);

            // Cr: Salary Payable (net salary)
            $entry->lines()->create([
                'ledger_id' => $salaryPayableLedger->id,
                'debit' => 0,
                'credit' => $totalNet,
                'narration' => 'Net salary payable',
            ]);

            // Cr: PF Payable
            $totalPf = round((float) $totalPfEmployee + $totalPfEmployer, 2);
            if ($totalPf > 0) {
                $pfLedger = Ledger::findBySystemKey($companyId, 'pf_payable');
                if ($pfLedger) {
                    $entry->lines()->create([
                        'ledger_id' => $pfLedger->id,
                        'debit' => 0,
                        'credit' => $totalPf,
                        'narration' => 'PF payable (employee + employer)',
                    ]);
                }
            }

            // Cr: ESI Payable
            $totalEsi = round((float) $totalEsiEmployee + $totalEsiEmployer, 2);
            if ($totalEsi > 0) {
                $esiLedger = Ledger::findBySystemKey($companyId, 'esi_payable');
                if ($esiLedger) {
                    $entry->lines()->create([
                        'ledger_id' => $esiLedger->id,
                        'debit' => 0,
                        'credit' => $totalEsi,
                        'narration' => 'ESI payable (employee + employer)',
                    ]);
                }
            }

            // Cr: PT Payable
            if ($totalPt > 0) {
                $ptLedger = Ledger::findBySystemKey($companyId, 'pt_payable');
                if ($ptLedger) {
                    $entry->lines()->create([
                        'ledger_id' => $ptLedger->id,
                        'debit' => 0,
                        'credit' => round((float) $totalPt, 2),
                        'narration' => 'Professional tax payable',
                    ]);
                }
            }

            // Cr: TDS (use salary_payable as fallback or skip when ledger absent)
            if ($totalTds > 0) {
                // Add TDS to salary payable credit if no dedicated ledger
                $entry->lines()->create([
                    'ledger_id' => $salaryPayableLedger->id,
                    'debit' => 0,
                    'credit' => round((float) $totalTds, 2),
                    'narration' => 'TDS payable',
                ]);
            }

            return $entry;
        });
    }

    /**
     * Add GST credit lines (for sales — output GST).
     */
    private function addGstCreditLines(Voucher $entry, string $companyId, float $cgst, float $sgst, float $igst, string $prefix): void
    {
        if ($cgst > 0) {
            $ledger = Ledger::findBySystemKey($companyId, "{$prefix}_cgst");
            if ($ledger) {
                $entry->lines()->create([
                    'ledger_id' => $ledger->id,
                    'debit' => 0,
                    'credit' => $cgst,
                    'narration' => strtoupper($prefix).' CGST',
                ]);
            }
        }

        if ($sgst > 0) {
            $ledger = Ledger::findBySystemKey($companyId, "{$prefix}_sgst");
            if ($ledger) {
                $entry->lines()->create([
                    'ledger_id' => $ledger->id,
                    'debit' => 0,
                    'credit' => $sgst,
                    'narration' => strtoupper($prefix).' SGST',
                ]);
            }
        }

        if ($igst > 0) {
            $ledger = Ledger::findBySystemKey($companyId, "{$prefix}_igst");
            if ($ledger) {
                $entry->lines()->create([
                    'ledger_id' => $ledger->id,
                    'debit' => 0,
                    'credit' => $igst,
                    'narration' => strtoupper($prefix).' IGST',
                ]);
            }
        }
    }

    /**
     * Add GST debit lines (for purchases — input GST).
     */
    private function addGstDebitLines(Voucher $entry, string $companyId, float $cgst, float $sgst, float $igst, string $prefix): void
    {
        if ($cgst > 0) {
            $ledger = Ledger::findBySystemKey($companyId, "{$prefix}_cgst");
            if ($ledger) {
                $entry->lines()->create([
                    'ledger_id' => $ledger->id,
                    'debit' => $cgst,
                    'credit' => 0,
                    'narration' => strtoupper($prefix).' CGST',
                ]);
            }
        }

        if ($sgst > 0) {
            $ledger = Ledger::findBySystemKey($companyId, "{$prefix}_sgst");
            if ($ledger) {
                $entry->lines()->create([
                    'ledger_id' => $ledger->id,
                    'debit' => $sgst,
                    'credit' => 0,
                    'narration' => strtoupper($prefix).' SGST',
                ]);
            }
        }

        if ($igst > 0) {
            $ledger = Ledger::findBySystemKey($companyId, "{$prefix}_igst");
            if ($ledger) {
                $entry->lines()->create([
                    'ledger_id' => $ledger->id,
                    'debit' => $igst,
                    'credit' => 0,
                    'narration' => strtoupper($prefix).' IGST',
                ]);
            }
        }
    }

    /**
     * Get Cash or Bank ledger based on payment mode.
     */
    private function getCashOrBankLedger(string $companyId, string $paymentMode): ?Ledger
    {
        if ($paymentMode === 'cash') {
            return Ledger::findBySystemKey($companyId, 'cash');
        }

        // bank, cheque, upi, other → all go to bank ledger
        // Look for any ledger under the bank_account group
        $bankGroup = AccountingGroup::findBySystemKey($companyId, 'bank_account');
        if ($bankGroup) {
            $bankLedger = Ledger::where('company_id', $companyId)
                ->where('group_id', $bankGroup->id)
                ->first();
            if ($bankLedger) {
                return $bankLedger;
            }
        }

        return Ledger::findBySystemKey($companyId, 'cash');
    }

    /**
     * Find the financial year for a given date.
     */
    private function getCurrentFY(string $companyId, string $date): ?FinancialYear
    {
        return FinancialYear::where('company_id', $companyId)
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->first()
            ?? FinancialYear::where('company_id', $companyId)
                ->where('is_current', true)
                ->first();
    }

    /**
     * Generate a unique voucher number using company-specific sequential counter.
     *
     * @param  string  $type  (sales, purchase, payment, receipt, journal, contra)
     * @return string Formatted voucher number (e.g., "PUR-00001")
     */
    private function generateVoucherNumber(string $companyId, string $type): string
    {
        $nextNumber = CompanySetting::getAndIncrementVoucherIndex($companyId, $type);
        $prefix = Voucher::getTypePrefix($type);

        return $prefix.'-'.str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
    }
}
