<?php

namespace Database\Seeders;

use App\Models\FinancialYear;
use App\Models\Company;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class FinancialYearSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get the first company
        $company = Company::first();

        if (!$company) {
            $company = Company::factory()->create();
        }

        // Create current financial year (April to March)
        $currentYear = Carbon::now()->year;
        $startDate = Carbon::create($currentYear, 4, 1);
        $endDate = Carbon::create($currentYear + 1, 3, 31);

        FinancialYear::factory()->create([
            'company_id' => $company->id,
            'label' => $currentYear . '-' . ($currentYear + 1),
            'start_date' => $startDate,
            'end_date' => $endDate,
            'is_current' => true,
            'is_locked' => false,
        ]);

        // Create previous financial year
        $prevStartDate = $startDate->copy()->subYear();
        $prevEndDate = $endDate->copy()->subYear();

        FinancialYear::factory()->create([
            'company_id' => $company->id,
            'label' => ($currentYear - 1) . '-' . $currentYear,
            'start_date' => $prevStartDate,
            'end_date' => $prevEndDate,
            'is_current' => false,
            'is_locked' => true,
        ]);

        // Create additional financial years if needed
        if (app()->environment('local', 'testing')) {
            FinancialYear::factory()->count(3)->create([
                'company_id' => $company->id,
            ]);
        }
    }
}