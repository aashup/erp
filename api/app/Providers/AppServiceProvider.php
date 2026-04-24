<?php

namespace App\Providers;

use App\Models\Company;
use App\Models\FinancialYear;
use App\Models\PayrollRun;
use App\Observers\CompanyObserver;
use App\Observers\FinancialYearObserver;
use App\Policies\PayrollPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Company::observe(CompanyObserver::class);
        FinancialYear::observe(FinancialYearObserver::class);
        Gate::policy(PayrollRun::class, PayrollPolicy::class);
    }
}
