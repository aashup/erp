<?php

namespace App\Services;

use App\Models\AccountingGroup;
use App\Models\FinancialYear;
use App\Models\Ledger;
use App\Models\Party;
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
            $voucherNumber = $this->generateVoucherNumber('sales');

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
            $voucherNumber = $this->generateVoucherNumber('purchase');

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
            $voucherNumber = $this->generateVoucherNumber('payment');

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
            $voucherNumber = $this->generateVoucherNumber('receipt');

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

        $count = Voucher::withoutGlobalScopes()->count() + 1;

        return $prefix.'-'.str_pad($count, 6, '0', STR_PAD_LEFT);
    }
}
