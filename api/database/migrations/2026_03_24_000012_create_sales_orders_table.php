<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('customer_id')->index();
            $table->string('so_number')->unique()->index();
            $table->date('so_date');
            $table->date('delivery_date')->nullable();
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->enum('status', ['draft', 'confirmed', 'delivered', 'cancelled'])->default('draft');
            $table->string('created_by')->nullable();
            $table->string('updated_by')->nullable();

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'failed', 'conflict'])->default('pending');
            $table->uuid('device_id')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->nullable();
            $table->timestamps();
        });

        Schema::create('so_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sales_order_id')->index();
            $table->uuid('item_id')->index();
            $table->integer('quantity');
            $table->decimal('rate', 15, 2);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2);
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
    }

    public function down(): void
    {
        Schema::dropIfExists('so_lines');
        Schema::dropIfExists('sales_orders');
    }
};