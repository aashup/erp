<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Godown;
use App\Models\Item;
use App\Models\Voucher;
use App\Models\Party;
use App\Models\PaymentReceipt;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseOrder;
use App\Models\SalesInvoice;
use App\Models\SalesOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SyncController extends Controller
{
    private array $syncableModels = [
        'items' => Item::class,
        'parties' => Party::class,
        'batches' => Batch::class,
        'godowns' => Godown::class,
        'branches' => Branch::class,
        'purchase_orders' => PurchaseOrder::class,
        'purchase_invoices' => PurchaseInvoice::class,
        'sales_orders' => SalesOrder::class,
        'sales_invoices' => SalesInvoice::class,
        'vouchers' => Voucher::class,
        'payment_receipts' => PaymentReceipt::class,
    ];

    public function push(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'changes' => 'required|array',
            'changes.*.table' => 'required|string',
            'changes.*.records' => 'required|array',
        ]);

        $synced = 0;

        DB::transaction(function () use ($validated, &$synced) {
            foreach ($validated['changes'] as $change) {
                $table = $change['table'];
                if (! isset($this->syncableModels[$table])) {
                    continue;
                }

                $modelClass = $this->syncableModels[$table];

                foreach ($change['records'] as $record) {
                    $modelClass::updateOrCreate(
                        ['id' => $record['id']],
                        array_merge($record, [
                            'sync_status' => 'synced',
                            'synced_at' => now(),
                        ])
                    );
                    $synced++;
                }
            }
        });

        return response()->json([
            'message' => 'Sync complete',
            'synced_count' => $synced,
        ]);
    }

    public function pull(Request $request): JsonResponse
    {
        $lastSyncedAt = $request->input('last_synced_at');

        $changes = [];

        foreach ($this->syncableModels as $table => $modelClass) {
            $query = $modelClass::withoutGlobalScopes();

            if ($lastSyncedAt) {
                $query->where('updated_at', '>', $lastSyncedAt);
            }

            $records = $query->limit(500)->get();

            if ($records->isNotEmpty()) {
                $changes[$table] = $records;
            }
        }

        return response()->json([
            'data' => $changes,
            'synced_at' => now()->toISOString(),
        ]);
    }
}
