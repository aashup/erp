<?php

use App\Http\Controllers\Api\V1\AccountingGroupController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BatchController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\CompanyController;
use App\Http\Controllers\Api\V1\CompanySettingController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\FinancialYearController;
use App\Http\Controllers\Api\V1\GodownController;
use App\Http\Controllers\Api\V1\InvoiceTemplateController;
use App\Http\Controllers\Api\V1\ItemController;
use App\Http\Controllers\Api\V1\LedgerController;
use App\Http\Controllers\Api\V1\PartyController;
use App\Http\Controllers\Api\V1\PaymentReceiptController;
use App\Http\Controllers\Api\V1\PurchaseInvoiceController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\SalesInvoiceController;
use App\Http\Controllers\Api\V1\SalesOrderController;
use App\Http\Controllers\Api\V1\StockLedgerController;
use App\Http\Controllers\Api\V1\SyncController;
use App\Http\Controllers\Api\V1\VoucherController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| Protected Routes (Sanctum)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Auth
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/logout-all', [AuthController::class, 'logoutAll']);

    // Sync
    Route::post('/sync/push', [SyncController::class, 'push']);
    Route::get('/sync/pull', [SyncController::class, 'pull']);

    // Inventory
    Route::apiResource('items', ItemController::class);
    Route::apiResource('godowns', GodownController::class);

    // Stock Ledger & Inventory Operations
    Route::get('stock-ledger', [StockLedgerController::class, 'index']);
    Route::get('stock-summary', [StockLedgerController::class, 'summary']);
    Route::post('stock-ledger/opening', [StockLedgerController::class, 'opening']);
    Route::post('stock-ledger/adjustment', [StockLedgerController::class, 'adjustment']);
    Route::post('stock-ledger/transfer', [StockLedgerController::class, 'transfer']);
    Route::get('stock-ledger/reorder-alerts', [StockLedgerController::class, 'reorderAlerts']);
    Route::get('items/{item}/movements', [StockLedgerController::class, 'itemMovements']);

    // Batches
    Route::get('items/{item}/batches', [BatchController::class, 'index']);
    Route::post('items/{item}/batches', [BatchController::class, 'store']);
    Route::put('batches/{batch}', [BatchController::class, 'update']);
    Route::delete('batches/{batch}', [BatchController::class, 'destroy']);
    Route::get('batches/expiring', [BatchController::class, 'expiring']);

    // Parties
    Route::apiResource('parties', PartyController::class);

    // Branches
    Route::apiResource('branches', BranchController::class);

    // Purchase
    Route::patch('purchase-orders/{purchase_order}/status', [PurchaseOrderController::class, 'updateStatus']);
    Route::apiResource('purchase-orders', PurchaseOrderController::class);
    Route::apiResource('purchase-invoices', PurchaseInvoiceController::class);

    // Sales
    Route::patch('sales-orders/{sales_order}/status', [SalesOrderController::class, 'updateStatus']);
    Route::apiResource('sales-orders', SalesOrderController::class);
    Route::get('sales-invoices/{sales_invoice}/pdf', [SalesInvoiceController::class, 'pdf']);
    Route::get('sales-invoices/{sales_invoice}/html', [SalesInvoiceController::class, 'html']);
    Route::patch('sales-invoices/{sales_invoice}/status', [SalesInvoiceController::class, 'updateStatus']);
    Route::apiResource('sales-invoices', SalesInvoiceController::class);

    // Company
    Route::get('companies/{company}', [CompanyController::class, 'show']);
    Route::put('companies/{company}', [CompanyController::class, 'update']);

    // Invoice Templates & Company Settings
    Route::get('invoice-templates', [InvoiceTemplateController::class, 'index']);
    Route::get('company-settings', [CompanySettingController::class, 'index']);
    Route::put('company-settings', [CompanySettingController::class, 'update']);

    // Financial Years
    Route::patch('financial-years/{financial_year}/set-current', [FinancialYearController::class, 'setCurrent']);
    Route::apiResource('financial-years', FinancialYearController::class);

    // Accounting
    Route::post('accounting-groups/load-defaults', [AccountingGroupController::class, 'loadDefaults']);
    Route::apiResource('accounting-groups', AccountingGroupController::class);
    Route::apiResource('ledgers', LedgerController::class);
    Route::apiResource('vouchers', VoucherController::class)->except(['update']);
    Route::apiResource('payment-receipts', PaymentReceiptController::class)->except(['update']);

    // Reports
    Route::get('reports/trial-balance', [ReportController::class, 'trialBalance']);
    Route::get('reports/profit-and-loss', [ReportController::class, 'profitAndLoss']);
    Route::get('reports/party-ledger', [ReportController::class, 'partyLedger']);
});
