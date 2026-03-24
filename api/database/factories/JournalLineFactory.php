<?php

namespace Database\Factories;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use Illuminate\Database\Eloquent\Factories\Factory;

class JournalLineFactory extends Factory
{
    public function definition(): array
    {
        $isDebit = fake()->boolean();
        $amount = fake()->randomFloat(2, 100, 50000);

        return [
            'journal_entry_id' => JournalEntry::factory(),
            'account_id' => ChartOfAccount::factory(),
            'debit' => $isDebit ? $amount : 0,
            'credit' => $isDebit ? 0 : $amount,
            'narration' => fake()->optional()->sentence(),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }

    public function debit(float $amount): static
    {
        return $this->state(['debit' => $amount, 'credit' => 0]);
    }

    public function credit(float $amount): static
    {
        return $this->state(['debit' => 0, 'credit' => $amount]);
    }
}
