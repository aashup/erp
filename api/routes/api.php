<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\ChartOfAccountController;
use App\Http\Controllers\Api\V1\GodownController;
use App\Http\Controllers\Api\V1\ItemController;
use App\Http\Controllers\Api\V1\JournalEntryController;
use App\Http\Controllers\Api\V1\PartyController;
use App\Http\Controllers\Api\V1\PaymentReceiptController;
use App\Http\Controllers\Api\V1\PurchaseInvoiceController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
use App\Http\Controllers\Api\V1\SalesInvoiceController;
use App\Http\Controllers\Api\V1\SalesOrderController;
use App\Http\Controllers\Api\V1\SyncController;
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
    Route::patch('sales-invoices/{sales_invoice}/status', [SalesInvoiceController::class, 'updateStatus']);
    Route::apiResource('sales-invoices', SalesInvoiceController::class);

    // Accounting
    Route::apiResource('chart-of-accounts', ChartOfAccountController::class);
    Route::apiResource('journal-entries', JournalEntryController::class)->except(['update']);
    Route::apiResource('payment-receipts', PaymentReceiptController::class)->except(['update']);
});
