<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\HasSyncColumns;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Item extends Model
{
    use HasUuid, HasSyncColumns, BelongsToCompany, SoftDeletes, LogsActivity;

    protected $fillable = [
        'company_id',
        'name',
        'sku',
        'hsn_code',
        'unit',
        'category',
        'gst_rate',
        'mrp',
        'purchase_price',
        'selling_price',
        'reorder_level',
        'is_batch_tracked',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'gst_rate' => 'decimal:2',
            'mrp' => 'decimal:2',
            'purchase_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'is_batch_tracked' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function batches()
    {
        return $this->hasMany(Batch::class);
    }

    public function stockLedger()
    {
        return $this->hasMany(StockLedger::class);
    }
}
