<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('document_counters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('financial_year_id');
            $table->enum('document_type', [
                'purchase_order',
                'sales_order',
                'purchase_invoice',
                'sales_invoice',
                'contra',
                'payment',
                'receipt',
                'journal',
                'purchase',
                'sales'
            ]);
            $table->string('prefix', 50)->nullable();
            $table->integer('next_number')->default(1);
            $table->timestamps();

            // Foreign keys
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('financial_year_id')->references('id')->on('financial_years')->onDelete('cascade');

            // Unique constraint: one counter per company per FY per document type
            $table->unique(['company_id', 'financial_year_id', 'document_type'], 'doc_counters_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_counters');
    }
};
