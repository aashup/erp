<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\HasSyncColumns;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class JournalEntry extends Model
{
    use HasFactory, HasUuid, HasSyncColumns, BelongsToCompany, LogsActivity;

    protected $fillable = [
        'company_id',
        'financial_year_id',
        'voucher_number',
        'voucher_date',
        'voucher_type',
        'narration',
        'source',
        'reference_type',
        'reference_id',
        'is_posted',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'voucher_date' => 'date',
            'is_posted' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function financialYear()
    {
        return $this->belongsTo(FinancialYear::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lines()
    {
        return $this->hasMany(JournalLine::class);
    }

    public function reference()
    {
        return $this->morphTo();
    }
}
