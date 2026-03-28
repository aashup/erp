<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\FinancialYear;
use App\Models\JournalEntry;
use App\Models\Party;
use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use Illuminate\Support\Facades\DB;

class AccountingService
{
    /**
     * Create a journal entry for a confirmed Sales Invoice.
     *
     * Dr: Party Ledger (grand_total)
     *   Cr: Sales Account (taxable_amount)
     *   Cr: Output CGST (cgst_total)
     *   Cr: Output SGST (sgst_total)
     *   Cr: Output IGST (igst_total)
     */
    public function postSalesInvoice(SalesInvoice $invoice, string $userId): ?JournalEntry
    {
        $companyId = $invoice->company_id;
        $party = Party::find($invoice->party_id);

        if (! $party || ! $party->ledger_account_id) {
            return null;
        }

        $salesAccount = ChartOfAccount::findBySystemKey($companyId, 'sales_account');
        if (! $salesAccount) {
            return null;
        }

        $fy = $this->getCurrentFY($companyId, $invoice->invoice_date);
        if (! $fy) {
            return null;
        }

        return DB::transaction(function () use ($invoice, $party, $salesAccount, $companyId, $userId, $fy) {
            $voucherNumber = $this->generateVoucherNumber('sales');

            $entry = JournalEntry::create([
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

            // Dr: Party Ledger (grand_total)
            $entry->lines()->create([
                'account_id' => $party->ledger_account_id,
                'debit' => $invoice->grand_total,
                'credit' => 0,
                'narration' => "Sale to {$party->name}",
            ]);

            // Cr: Sales Account (taxable_amount)
            $entry->lines()->create([
                'account_id' => $salesAccount->id,
                'debit' => 0,
                'credit' => $invoice->taxable_amount,
                'narration' => 'Sales revenue',
            ]);

            // Cr: GST accounts
            $this->addGstCreditLines($entry, $companyId, $invoice->cgst_total, $invoice->sgst_total, $invoice->igst_total, 'output');

            return $entry;
        });
    }

    /**
     * Create a journal entry for a Purchase Invoice.
     *
     * Dr: Purchase Account (taxable_amount)
     * Dr: Input CGST / SGST / IGST
     *   Cr: Party Ledger (grand_total)
     */
    public function postPurchaseInvoice(PurchaseInvoice $invoice, string $userId): ?JournalEntry
    {
        $companyId = $invoice->company_id;
        $party = Party::find($invoice->party_id);

        if (! $party || ! $party->ledger_account_id) {
            return null;
        }

        $purchaseAccount = ChartOfAccount::findBySystemKey($companyId, 'purchase_account');
        if (! $purchaseAccount) {
            return null;
        }

        $fy = $this->getCurrentFY($companyId, $invoice->invoice_date);
        if (! $fy) {
            return null;
        }

        return DB::transaction(function () use ($invoice, $party, $purchaseAccount, $companyId, $userId, $fy) {
            $voucherNumber = $this->generateVoucherNumber('purchase');

            $entry = JournalEntry::create([
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

            // Dr: Purchase Account (taxable_amount)
            $entry->lines()->create([
                'account_id' => $purchaseAccount->id,
                'debit' => $invoice->taxable_amount,
                'credit' => 0,
                'narration' => 'Purchase expense',
            ]);

            // Dr: GST input accounts
            $this->addGstDebitLines($entry, $companyId, $invoice->cgst_total, $invoice->sgst_total, $invoice->igst_total, 'input');

            // Cr: Party Ledger (grand_total)
            $entry->lines()->create([
                'account_id' => $party->ledger_account_id,
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
     * Dr: Party Ledger (amount)
     *   Cr: Cash/Bank (amount)
     */
    public function postPayment(string $companyId, Party $party, float $amount, string $paymentMode, string $receiptDate, string $narration, string $userId, ?string $referenceType = null, ?string $referenceId = null): ?JournalEntry
    {
        if (! $party->ledger_account_id) {
            return null;
        }

        $cashOrBank = $this->getCashOrBankAccount($companyId, $paymentMode);
        if (! $cashOrBank) {
            return null;
        }

        $fy = $this->getCurrentFY($companyId, $receiptDate);
        if (! $fy) {
            return null;
        }

        return DB::transaction(function () use ($companyId, $party, $amount, $cashOrBank, $receiptDate, $narration, $userId, $fy, $referenceType, $referenceId) {
            $voucherNumber = $this->generateVoucherNumber('payment');

            $entry = JournalEntry::create([
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

            // Dr: Party Ledger (reduces creditor balance)
            $entry->lines()->create([
                'account_id' => $party->ledger_account_id,
                'debit' => $amount,
                'credit' => 0,
                'narration' => "Payment to {$party->name}",
            ]);

            // Cr: Cash/Bank
            $entry->lines()->create([
                'account_id' => $cashOrBank->id,
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
     * Dr: Cash/Bank (amount)
     *   Cr: Party Ledger (amount)
     */
    public function postReceipt(string $companyId, Party $party, float $amount, string $paymentMode, string $receiptDate, string $narration, string $userId, ?string $referenceType = null, ?string $referenceId = null): ?JournalEntry
    {
        if (! $party->ledger_account_id) {
            return null;
        }

        $cashOrBank = $this->getCashOrBankAccount($companyId, $paymentMode);
        if (! $cashOrBank) {
            return null;
        }

        $fy = $this->getCurrentFY($companyId, $receiptDate);
        if (! $fy) {
            return null;
        }

        return DB::transaction(function () use ($companyId, $party, $amount, $cashOrBank, $receiptDate, $narration, $userId, $fy, $referenceType, $referenceId) {
            $voucherNumber = $this->generateVoucherNumber('receipt');

            $entry = JournalEntry::create([
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

            // Dr: Cash/Bank
            $entry->lines()->create([
                'account_id' => $cashOrBank->id,
                'debit' => $amount,
                'credit' => 0,
                'narration' => "Receipt via {$cashOrBank->name}",
            ]);

            // Cr: Party Ledger (reduces debtor balance)
            $entry->lines()->create([
                'account_id' => $party->ledger_account_id,
                'debit' => 0,
                'credit' => $amount,
                'narration' => "Receipt from {$party->name}",
            ]);

            return $entry;
        });
    }

    /**
     * Add GST credit lines (for sales — output GST).
     */
    private function addGstCreditLines(JournalEntry $entry, string $companyId, float $cgst, float $sgst, float $igst, string $prefix): void
    {
        if ($cgst > 0) {
            $account = ChartOfAccount::findBySystemKey($companyId, "{$prefix}_cgst");
            if ($account) {
                $entry->lines()->create([
                    'account_id' => $account->id,
                    'debit' => 0,
                    'credit' => $cgst,
                    'narration' => strtoupper($prefix) . ' CGST',
                ]);
            }
        }

        if ($sgst > 0) {
            $account = ChartOfAccount::findBySystemKey($companyId, "{$prefix}_sgst");
            if ($account) {
                $entry->lines()->create([
                    'account_id' => $account->id,
                    'debit' => 0,
                    'credit' => $sgst,
                    'narration' => strtoupper($prefix) . ' SGST',
                ]);
            }
        }

        if ($igst > 0) {
            $account = ChartOfAccount::findBySystemKey($companyId, "{$prefix}_igst");
            if ($account) {
                $entry->lines()->create([
                    'account_id' => $account->id,
                    'debit' => 0,
                    'credit' => $igst,
                    'narration' => strtoupper($prefix) . ' IGST',
                ]);
            }
        }
    }

    /**
     * Add GST debit lines (for purchases — input GST).
     */
    private function addGstDebitLines(JournalEntry $entry, string $companyId, float $cgst, float $sgst, float $igst, string $prefix): void
    {
        if ($cgst > 0) {
            $account = ChartOfAccount::findBySystemKey($companyId, "{$prefix}_cgst");
            if ($account) {
                $entry->lines()->create([
                    'account_id' => $account->id,
                    'debit' => $cgst,
                    'credit' => 0,
                    'narration' => strtoupper($prefix) . ' CGST',
                ]);
            }
        }

        if ($sgst > 0) {
            $account = ChartOfAccount::findBySystemKey($companyId, "{$prefix}_sgst");
            if ($account) {
                $entry->lines()->create([
                    'account_id' => $account->id,
                    'debit' => $sgst,
                    'credit' => 0,
                    'narration' => strtoupper($prefix) . ' SGST',
                ]);
            }
        }

        if ($igst > 0) {
            $account = ChartOfAccount::findBySystemKey($companyId, "{$prefix}_igst");
            if ($account) {
                $entry->lines()->create([
                    'account_id' => $account->id,
                    'debit' => $igst,
                    'credit' => 0,
                    'narration' => strtoupper($prefix) . ' IGST',
                ]);
            }
        }
    }

    /**
     * Get Cash or Bank account based on payment mode.
     */
    private function getCashOrBankAccount(string $companyId, string $paymentMode): ?ChartOfAccount
    {
        if ($paymentMode === 'cash') {
            return ChartOfAccount::findBySystemKey($companyId, 'cash_account');
        }

        // bank, cheque, upi, other → all go to bank account
        return ChartOfAccount::findBySystemKey($companyId, 'bank_account')
            ?? ChartOfAccount::findBySystemKey($companyId, 'cash_account');
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
     * Generate a unique voucher number.
     */
    private function generateVoucherNumber(string $type): string
    {
        $prefix = match ($type) {
            'sales' => 'SV',
            'purchase' => 'PV',
            'payment' => 'PMT',
            'receipt' => 'RCT',
            default => 'JV',
        };

        $count = JournalEntry::withoutGlobalScopes()->count() + 1;

        return $prefix . '-' . str_pad($count, 6, '0', STR_PAD_LEFT);
    }
}
