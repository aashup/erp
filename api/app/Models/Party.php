<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\HasSyncColumns;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Party extends Model
{
    use HasUuid, HasSyncColumns, BelongsToCompany, SoftDeletes, LogsActivity;

    protected $fillable = [
        'company_id',
        'type',
        'name',
        'gstin',
        'pan',
        'address',
        'city',
        'state',
        'state_code',
        'pincode',
        'phone',
        'email',
        'contact_person',
        'credit_limit',
        'opening_balance',
        'balance_type',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'credit_limit' => 'decimal:2',
            'opening_balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function purchaseInvoices()
    {
        return $this->hasMany(PurchaseInvoice::class);
    }

    public function salesOrders()
    {
        return $this->hasMany(SalesOrder::class);
    }

    public function salesInvoices()
    {
        return $this->hasMany(SalesInvoice::class);
    }

    public function paymentReceipts()
    {
        return $this->hasMany(PaymentReceipt::class);
    }
}
