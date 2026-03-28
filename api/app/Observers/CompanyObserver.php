<?php

namespace App\Observers;

use App\Models\Company;
use App\Models\FinancialYear;
use Carbon\Carbon;

class CompanyObserver
{
    /**
     * When a company is created, auto-create the current financial year (Apr-Mar).
     */
    public function created(Company $company): void
    {
        $now = Carbon::now();
        // Indian FY: Apr 1 – Mar 31. If current month >= April, FY starts this year; else last year.
        $fyStartYear = $now->month >= 4 ? $now->year : $now->year - 1;

        FinancialYear::create([
            'company_id' => $company->id,
            'label' => $fyStartYear.'-'.substr($fyStartYear + 1, -2),
            'start_date' => Carbon::create($fyStartYear, 4, 1),
            'end_date' => Carbon::create($fyStartYear + 1, 3, 31),
            'is_current' => true,
            'is_locked' => false,
        ]);
    }
}
