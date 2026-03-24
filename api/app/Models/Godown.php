<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\HasSyncColumns;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Godown extends Model
{
    use HasUuid, HasSyncColumns, BelongsToCompany, SoftDeletes, LogsActivity;

    protected $fillable = [
        'company_id',
        'branch_id',
        'name',
        'code',
        'address',
        'is_default',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function stockLedger()
    {
        return $this->hasMany(StockLedger::class);
    }
}
