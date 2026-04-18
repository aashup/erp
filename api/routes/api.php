<?php

use App\Http\Controllers\Api\V1\AccountingGroupController;
use App\Http\Controllers\Api\V1\POSController;
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
use App\Http\Controllers\Api\V1\ItemGroupController;
use App\Http\Controllers\Api\V1\LedgerController;
use App\Http\Controllers\Api\V1\PartyController;
use App\Http\Controllers\Api\V1\PaymentReceiptController;
use App\Http\Controllers\Api\V1\OcrInvoiceController;
use App\Http\Controllers\Api\V1\PurchaseInvoiceController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SalesInvoiceController;
use App\Http\Controllers\Api\V1\SalesOrderController;
use App\Http\Controllers\Api\V1\StockLedgerController;
use App\Http\Controllers\Api\V1\SyncController;
use App\Http\Controllers\Api\V1\ThermalTemplateController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\UserController;
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
    Route::get('/dashboard/chart', [DashboardController::class, 'chart']);

    // Auth
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/profile/avatar', [AuthController::class, 'uploadAvatar']);
    Route::put('/auth/password', [AuthController::class, 'updatePassword']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/logout-all', [AuthController::class, 'logoutAll']);

    // Sync
    Route::post('/sync/push', [SyncController::class, 'push']);
    Route::get('/sync/pull', [SyncController::class, 'pull']);

    // Inventory
    Route::apiResource('units', UnitController::class);
    Route::apiResource('item-groups', ItemGroupController::class);
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
    Route::get('batches', [BatchController::class, 'allBatches']);
    Route::get('batches/expiring', [BatchController::class, 'expiring']);
    Route::get('items/{item}/batches', [BatchController::class, 'index']);
    Route::post('items/{item}/batches', [BatchController::class, 'store']);
    Route::put('batches/{batch}', [BatchController::class, 'update']);
    Route::delete('batches/{batch}', [BatchController::class, 'destroy']);

    // Parties
    Route::apiResource('parties', PartyController::class);

    // Branches
    Route::apiResource('branches', BranchController::class);

    // Users & Roles
    Route::apiResource('users', UserController::class);
    Route::apiResource('roles', RoleController::class);
    Route::get('permissions', [RoleController::class, 'permissions']);

    // Purchase
    Route::patch('purchase-orders/{purchase_order}/status', [PurchaseOrderController::class, 'updateStatus']);
    Route::apiResource('purchase-orders', PurchaseOrderController::class);
    Route::apiResource('purchase-invoices', PurchaseInvoiceController::class);
    Route::post('ocr/scan-invoice', [OcrInvoiceController::class, 'scan']);

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
    Route::post('companies/{company}/logo', [CompanyController::class, 'uploadLogo']);

    // Invoice Templates & Company Settings
    Route::get('invoice-templates', [InvoiceTemplateController::class, 'index']);
    Route::patch('thermal-templates/{thermal_template}/set-default', [ThermalTemplateController::class, 'setDefault']);
    Route::apiResource('thermal-templates', ThermalTemplateController::class);
    Route::get('company-settings', [CompanySettingController::class, 'index']);
    Route::put('company-settings', [CompanySettingController::class, 'update']);

    // Financial Years
    Route::patch('financial-years/{financial_year}/set-current', [FinancialYearController::class, 'setCurrent']);
    Route::apiResource('financial-years', FinancialYearController::class);

    // Accounting
    Route::post('accounting-groups/load-defaults', [AccountingGroupController::class, 'loadDefaults']);
    Route::apiResource('accounting-groups', AccountingGroupController::class);
    Route::get('ledgers/{ledger}/balance', [LedgerController::class, 'balance']);
    Route::apiResource('ledgers', LedgerController::class);
    Route::apiResource('vouchers', VoucherController::class)->except(['update']);
    Route::get('payment-receipts/{payment_receipt}/journal', [PaymentReceiptController::class, 'journal']);
    Route::apiResource('payment-receipts', PaymentReceiptController::class)->except(['update']);

    // POS
    Route::get('pos/items', [POSController::class, 'items']);
    Route::post('pos/checkout', [POSController::class, 'checkout']);
    Route::post('pos/hold', [POSController::class, 'hold']);
    Route::get('pos/held', [POSController::class, 'heldList']);
    Route::delete('pos/held/{salesInvoice}', [POSController::class, 'deleteHeld']);
    Route::post('pos/quick-party', [POSController::class, 'quickParty']);

    // Reports
    Route::get('reports/trial-balance', [ReportController::class, 'trialBalance']);
    Route::get('reports/profit-and-loss', [ReportController::class, 'profitAndLoss']);
    Route::get('reports/balance-sheet', [ReportController::class, 'balanceSheet']);
    Route::get('reports/party-ledger', [ReportController::class, 'partyLedger']);
    Route::get('reports/ledger-transactions', [ReportController::class, 'ledgerTransactions']);
    Route::get('reports/cash-book', [ReportController::class, 'cashBook']);
    Route::get('reports/bank-book', [ReportController::class, 'bankBook']);
    Route::get('reports/day-book', [ReportController::class, 'dayBook']);
});
