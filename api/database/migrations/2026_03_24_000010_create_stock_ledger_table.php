<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Stock ledger - append-only, tracks every stock movement
     * Used for auditing and reconciliation
     */
    public function up(): void
    {
        Schema::create('stock_ledger', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('item_id')->index();
            $table->uuid('godown_id')->nullable()->index();
            $table->string('batch_no', 50)->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('type')->comment('in, out, adjustment, transfer_in, transfer_out');
            $table->integer('quantity');
            $table->decimal('rate', 15, 2)->nullable();
            $table->decimal('amount', 15, 2)->nullable();
            $table->string('reference_type')->nullable(); // po, grn, invoice, transfer, etc.
            $table->uuid('reference_id')->nullable();
            $table->text('narration')->nullable();
            $table->string('created_by')->nullable();
            $table->string('updated_by')->nullable();

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'failed', 'conflict'])->default('pending');
            $table->uuid('device_id')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_ledger_meta', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('stock_ledger_id');
            $table->string('key');
            $table->text('value')->nullable();
            $table->timestamps();
            $table->foreign('stock_ledger_id')->references('id')->on('stock_ledger')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_ledger_meta');
        Schema::dropIfExists('stock_ledger');
    }
};