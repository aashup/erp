<?php

namespace App\Models;

use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VoucherLine extends Model
{
    use HasFactory, HasSyncColumns, HasUuid;

    protected $fillable = [
        'voucher_id',
        'account_id',
        'debit',
        'credit',
        'narration',
    ];

    protected function casts(): array
    {
        return [
            'debit' => 'decimal:2',
            'credit' => 'decimal:2',
        ];
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    public function account()
    {
        return $this->belongsTo(AccountingGroup::class, 'account_id');
    }
}
