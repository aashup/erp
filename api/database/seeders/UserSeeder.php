<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get the first company and branch
        $company = Company::first();
        $branch = Branch::where('company_id', $company->id)->first();

        if (! $company) {
            $company = Company::factory()->create();
        }
        if (! $branch) {
            $branch = Branch::factory()->create(['company_id' => $company->id]);
        }

        // Create admin user
        User::factory()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Admin User',
            'email' => 'admin@demo.com',
            'role' => 'admin',
            'is_active' => true,
        ]);

        // Create manager user
        User::factory()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Manager User',
            'email' => 'manager@demo.com',
            'role' => 'manager',
            'is_active' => true,
        ]);

        // Create accountant user
        User::factory()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Accountant User',
            'email' => 'accountant@demo.com',
            'role' => 'accountant',
            'is_active' => true,
        ]);

        // Create salesman user
        User::factory()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Salesman User',
            'email' => 'salesman@demo.com',
            'role' => 'salesman',
            'is_active' => true,
        ]);

        // Create additional users if needed
        if (app()->environment('local', 'testing')) {
            User::factory()->count(10)->create([
                'company_id' => $company->id,
                'branch_id' => $branch->id,
            ]);
        }
    }
}
