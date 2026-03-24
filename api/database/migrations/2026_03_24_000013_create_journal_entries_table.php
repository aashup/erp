<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journal_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('voucher_no')->unique()->index();
            $table->enum('type', ['purchase', 'sales', 'payment', 'receipt', 'journal', 'contribution']);
            $table->date('voucher_date');
            $table->string('reference_type')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->text('narration')->nullable();
            $table->decimal('total_debit', 15, 2)->default(0);
            $table->decimal('total_credit', 15, 2)->default(0);
            $table->enum('status', ['posted', 'cancelled'])->default('posted');
            $table->string('created_by')->nullable();
            $table->string('updated_by')->nullable();

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'failed', 'conflict'])->default('pending');
            $table->uuid('device_id')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->nullable();
            $table->timestamps();
        });

        Schema::create('journal_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('journal_entry_id')->index();
            $table->uuid('account_id')->index();
            $table->enum('debit_credit', 'debit')->default('debit');
            $table->decimal('amount', 15, 2);
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
        Schema::dropIfExists('journal_lines');
        Schema::dropIfExists('journal_entries');
    }
};