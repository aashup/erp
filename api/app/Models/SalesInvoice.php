<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class SalesInvoice extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $fillable = [
        'company_id',
        'party_id',
        'branch_id',
        'sales_order_id',
        'godown_id',
        'invoice_number',
        'invoice_date',
        'due_date',
        'is_inter_state',
        'is_printed',
        'status',
        'total_amount',
        'discount_amount',
        'taxable_amount',
        'cgst_total',
        'sgst_total',
        'igst_total',
        'grand_total',
        'amount_paid',
        'balance_due',
        'notes',
        'pos_held',
        'pos_payment_mode',
        'share_token',
        'amount_tendered',
        'change_amount',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
            'due_date' => 'date',
            'is_inter_state' => 'boolean',
            'is_printed' => 'boolean',
            'total_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'taxable_amount' => 'decimal:2',
            'cgst_total' => 'decimal:2',
            'sgst_total' => 'decimal:2',
            'igst_total' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'balance_due' => 'decimal:2',
            'pos_held' => 'boolean',
            'amount_tendered' => 'decimal:2',
            'change_amount' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (SalesInvoice $invoice) {
            if (empty($invoice->share_token)) {
                $invoice->share_token = bin2hex(random_bytes(24)); // 48-char hex token
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function party()
    {
        return $this->belongsTo(Party::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function salesOrder()
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function godown()
    {
        return $this->belongsTo(Godown::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function lines()
    {
        return $this->hasMany(SalesInvoiceLine::class);
    }

    public function returns()
    {
        return $this->hasMany(SalesReturn::class);
    }
}
