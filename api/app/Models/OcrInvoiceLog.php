<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OcrInvoiceLog extends Model
{
    use BelongsToCompany, HasUuid;

    protected $fillable = [
        'company_id',
        'image_path',
        'provider',
        'model',
        'raw_response',
        'extracted_data',
        'status',
        'error_message',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'raw_response' => 'array',
            'extracted_data' => 'array',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
