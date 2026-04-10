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
        // Add financial_year_id to purchase_orders
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->after('company_id', function (Blueprint $table) {
                $table->foreignUuid('financial_year_id')->nullable()->constrained('financial_years')->nullOnDelete();
            });
        });

        // Add financial_year_id to sales_orders
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->after('company_id', function (Blueprint $table) {
                $table->foreignUuid('financial_year_id')->nullable()->constrained('financial_years')->nullOnDelete();
            });
        });

        // Add financial_year_id to purchase_invoices
        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->after('company_id', function (Blueprint $table) {
                $table->foreignUuid('financial_year_id')->nullable()->constrained('financial_years')->nullOnDelete();
            });
        });

        // Add financial_year_id to sales_invoices
        Schema::table('sales_invoices', function (Blueprint $table) {
            $table->after('company_id', function (Blueprint $table) {
                $table->foreignUuid('financial_year_id')->nullable()->constrained('financial_years')->nullOnDelete();
            });
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropForeignIdColumns('financial_year_id');
        });

        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropForeignIdColumns('financial_year_id');
        });

        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->dropForeignIdColumns('financial_year_id');
        });

        Schema::table('sales_invoices', function (Blueprint $table) {
            $table->dropForeignIdColumns('financial_year_id');
        });
    }
};
