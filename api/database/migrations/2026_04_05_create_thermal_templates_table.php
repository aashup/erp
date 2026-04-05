<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('thermal_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->string('name', 255);
            $table->longText('html_content');
            $table->enum('paper_size', ['2inch', '3inch'])->default('2inch');
            $table->boolean('is_default')->default(false);
            $table->foreignUuid('created_by')->constrained('users');
            $table->foreignUuid('updated_by')->nullable()->constrained('users');

            // Sync columns for offline-first
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local');

            $table->timestamps();
            $table->softDeletes();

            // Indices
            $table->index(['company_id', 'paper_size']);
            $table->unique(['company_id', 'paper_size', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('thermal_templates');
    }
};
