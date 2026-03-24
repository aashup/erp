<?php

namespace App\Models;

use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PoLine extends Model
{
    use HasFactory, HasSyncColumns, HasUuid;

    protected $fillable = [
        'purchase_order_id',
        'item_id',
        'quantity',
        'rate',
        'discount_percent',
        'taxable_amount',
        'gst_rate',
        'cgst',
        'sgst',
        'igst',
        'line_total',
        'received_quantity',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'rate' => 'decimal:2',
            'discount_percent' => 'decimal:2',
            'taxable_amount' => 'decimal:2',
            'gst_rate' => 'decimal:2',
            'cgst' => 'decimal:2',
            'sgst' => 'decimal:2',
            'igst' => 'decimal:2',
            'line_total' => 'decimal:2',
            'received_quantity' => 'decimal:3',
        ];
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
