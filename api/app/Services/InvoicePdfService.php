<?php

namespace App\Services;

use App\Helpers\NumberToWords;
use App\Models\Company;
use App\Models\CompanySetting;
use App\Models\SalesInvoice;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPDF;

class InvoicePdfService
{
    /**
     * Generate a PDF for the given sales invoice.
     */
    public function generate(SalesInvoice $invoice, ?string $templateSlug = null): DomPDF
    {
        // Load relationships
        $invoice->loadMissing([
            'lines.item',
            'lines.batch',
            'lines.godown',
            'party',
            'branch',
            'godown',
        ]);

        // Get company
        $company = Company::find($invoice->company_id);

        // Resolve template
        if (! $templateSlug) {
            $templateSlug = CompanySetting::getValue(
                $invoice->company_id,
                'default_invoice_template',
                'pharma-distributor'
            );
        }

        $viewName = InvoiceTemplateRegistry::getViewName($templateSlug);

        // Calculate round-off
        $grandTotal = (float) $invoice->grand_total;
        $roundedTotal = round($grandTotal);
        $roundOff = $roundedTotal - $grandTotal;

        // Prepare view data
        $data = [
            'invoice' => $invoice,
            'company' => $company,
            'party' => $invoice->party,
            'lines' => $invoice->lines,
            'amountInWords' => NumberToWords::convert($roundedTotal),
            'roundOff' => $roundOff,
            'netPayable' => $roundedTotal,
        ];

        return Pdf::loadView($viewName, $data)
            ->setPaper('a4', 'portrait');
    }

    /**
     * Generate rendered HTML string for the given sales invoice.
     */
    public function generateHtml(SalesInvoice $invoice, ?string $templateSlug = null): string
    {
        // Load relationships
        $invoice->loadMissing([
            'lines.item',
            'lines.batch',
            'lines.godown',
            'party',
            'branch',
            'godown',
        ]);

        // Get company
        $company = Company::find($invoice->company_id);

        // Resolve template
        if (! $templateSlug) {
            $templateSlug = CompanySetting::getValue(
                $invoice->company_id,
                'default_invoice_template',
                'pharma-distributor'
            );
        }

        $viewName = InvoiceTemplateRegistry::getViewName($templateSlug);

        // Calculate round-off
        $grandTotal = (float) $invoice->grand_total;
        $roundedTotal = round($grandTotal);
        $roundOff = $roundedTotal - $grandTotal;

        // Prepare view data
        $data = [
            'invoice' => $invoice,
            'company' => $company,
            'party' => $invoice->party,
            'lines' => $invoice->lines,
            'amountInWords' => NumberToWords::convert($roundedTotal),
            'roundOff' => $roundOff,
            'netPayable' => $roundedTotal,
        ];

        return view($viewName, $data)->render();
    }
}
