<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanySetting extends Model
{
    use HasUuids;

    public const ITEM_UNITS_KEY = 'item_units';

    public const DEFAULT_ITEM_UNITS = [
        ['value' => 'PCS', 'label' => 'Pieces'],
        ['value' => 'KG', 'label' => 'Kilograms'],
        ['value' => 'BOX', 'label' => 'Box'],
        ['value' => 'STRIP', 'label' => 'Strip'],
    ];

    protected $fillable = ['company_id', 'key', 'value'];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get a setting value for a company.
     */
    public static function getValue(string $companyId, string $key, mixed $default = null): mixed
    {
        $setting = static::where('company_id', $companyId)
            ->where('key', $key)
            ->first();

        return $setting?->value ?? $default;
    }

    /**
     * Set (upsert) a setting value for a company.
     */
    public static function setValue(string $companyId, string $key, mixed $value): static
    {
        if ($key === static::ITEM_UNITS_KEY) {
            $value = json_encode(static::normalizeItemUnits($value), JSON_UNESCAPED_UNICODE);
        }

        return static::updateOrCreate(
            ['company_id' => $companyId, 'key' => $key],
            ['value' => $value]
        );
    }

    /**
     * Get all settings for a company, with structured values normalized for API responses.
     *
     * @return array<string, mixed>
     */
    public static function getFormattedSettings(string $companyId): array
    {
        $settings = static::where('company_id', $companyId)
            ->get()
            ->pluck('value', 'key')
            ->toArray();

        $settings[static::ITEM_UNITS_KEY] = static::getItemUnits($companyId);

        return $settings;
    }

    /**
     * Get the normalized unit options for a company.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function getItemUnits(string $companyId): array
    {
        $rawValue = static::getValue($companyId, static::ITEM_UNITS_KEY);
        $units = static::normalizeItemUnits($rawValue);

        return $units !== [] ? $units : static::DEFAULT_ITEM_UNITS;
    }

    /**
     * Get the unit values that can be stored on item records.
     *
     * @return array<int, string>
     */
    public static function getItemUnitValues(string $companyId): array
    {
        return array_column(static::getItemUnits($companyId), 'value');
    }

    /**
     * Normalize raw company setting data into stable item unit options.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function normalizeItemUnits(mixed $units): array
    {
        if (is_string($units)) {
            $decoded = json_decode($units, true);
            $units = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        if (! is_array($units)) {
            return [];
        }

        $normalized = [];

        foreach ($units as $unit) {
            $value = null;
            $label = null;

            if (is_string($unit)) {
                $value = trim($unit);
                $label = trim($unit);
            } elseif (is_array($unit)) {
                $value = trim((string) ($unit['value'] ?? ''));
                $label = trim((string) ($unit['label'] ?? ''));
            }

            if ($value === null || $value === '') {
                continue;
            }

            $value = strtoupper($value);
            $label = $label !== null && $label !== '' ? $label : $value;

            $normalized[$value] = [
                'value' => $value,
                'label' => $label,
            ];
        }

        return array_values($normalized);
    }
}
