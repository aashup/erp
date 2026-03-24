<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\HasSyncColumns;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class PaymentReceipt extends Model
{
    use HasUuid, HasSyncColumns, BelongsToCompany, SoftDeletes, LogsActivity;

    protected $fillable = [
        'company_id',
        'party_id',
        'type',
        'receipt_number',
        'receipt_date',
        'amount',
        'payment_mode',
        'reference_number',
        'bank_name',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'receipt_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function party()
    {
        return $this->belongsTo(Party::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
