<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ $ogTitle }}</title>

    {{-- Open Graph tags — enables WhatsApp / social link preview --}}
    <meta property="og:type"        content="website" />
    <meta property="og:title"       content="{{ $ogTitle }}" />
    <meta property="og:description" content="{{ $ogDescription }}" />
    <meta property="og:url"         content="{{ $shareUrl }}" />
    <meta name="description"        content="{{ $ogDescription }}" />

    {{-- Twitter card (optional, helps other apps) --}}
    <meta name="twitter:card"        content="summary" />
    <meta name="twitter:title"       content="{{ $ogTitle }}" />
    <meta name="twitter:description" content="{{ $ogDescription }}" />

    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f3f4f6;
            min-height: 100vh;
            padding: 16px;
        }

        .wrapper {
            max-width: 480px;
            margin: 0 auto;
        }

        /* Top action bar */
        .action-bar {
            display: flex;
            gap: 10px;
            margin-bottom: 16px;
        }

        .btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            text-decoration: none;
            transition: opacity 0.15s;
        }
        .btn:hover { opacity: 0.88; }

        .btn-print {
            background: #4f46e5;
            color: #fff;
        }
        .btn-download {
            background: #059669;
            color: #fff;
        }

        /* Invoice card */
        .card {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 1px 8px rgba(0,0,0,.1);
            overflow: hidden;
        }

        /* Invoice header inside card */
        .invoice-meta {
            padding: 16px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .invoice-meta .number {
            font-size: 15px;
            font-weight: 700;
            color: #111827;
        }
        .invoice-meta .date {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
        }
        .invoice-meta .amount {
            font-size: 20px;
            font-weight: 800;
            color: #059669;
        }

        /* Invoice body — rendered receipt */
        .invoice-body {
            padding: 12px;
            display: flex;
            justify-content: center;
            background: #fafafa;
        }

        /* Footer */
        .footer {
            text-align: center;
            margin-top: 16px;
            font-size: 11px;
            color: #9ca3af;
            padding-bottom: 24px;
        }

        @media print {
            body { background: #fff; padding: 0; }
            .action-bar { display: none; }
            .card { box-shadow: none; border-radius: 0; }
            .footer { display: none; }
        }
    </style>
</head>
<body>
<div class="wrapper">

    {{-- Action bar --}}
    <div class="action-bar">
        <button class="btn btn-print" onclick="window.print()">
            🖨️ Print
        </button>
        <a class="btn btn-download"
           href="{{ $shareUrl }}?format=pdf&paper_size={{ $paperSize }}">
            ⬇️ Download PDF
        </a>
    </div>

    {{-- Invoice card --}}
    <div class="card">
        <div class="invoice-meta">
            <div>
                <div class="number">{{ $invoice->invoice_number }}</div>
                <div class="date">{{ \Carbon\Carbon::parse($invoice->invoice_date)->format('d M Y') }}</div>
                @if($invoice->party && $invoice->party->name !== 'Walk-in Customer')
                <div class="date" style="margin-top:4px;font-weight:600;color:#374151;">
                    {{ $invoice->party->name }}
                </div>
                @endif
            </div>
            <div class="amount">₹{{ $netPayable }}</div>
        </div>

        <div class="invoice-body">
            {!! $invoiceHtml !!}
        </div>
    </div>

    <div class="footer">
        {{ $company->name ?? '' }} &nbsp;·&nbsp; Powered by ERP
    </div>
</div>
</body>
</html>
