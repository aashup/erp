<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->string('sku')->nullable();
            $table->string('hsn_code')->nullable();
            $table->string('unit'); // e.g. PCS, KG, BOX, STRIP
            $table->string('category')->nullable();
            $table->decimal('gst_rate', 5, 2)->default(0);
            $table->decimal('mrp', 15, 2)->nullable();
            $table->decimal('purchase_price', 15, 2)->nullable();
            $table->decimal('selling_price', 15, 2)->nullable();
            $table->integer('reorder_level')->default(0);
            $table->boolean('is_batch_tracked')->default(false);
            $table->boolean('is_active')->default(true);

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
