<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\HasSyncColumns;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Branch extends Model
{
    use HasUuid, HasSyncColumns, BelongsToCompany, SoftDeletes, LogsActivity;

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'address',
        'city',
        'state',
        'state_code',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function godowns()
    {
        return $this->hasMany(Godown::class);
    }
}
