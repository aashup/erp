<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            'inventory', 'purchase', 'sales', 'accounting', 'party', 'branch',
        ];

        $actions = ['view', 'create', 'edit', 'delete'];

        $permissions = [];
        foreach ($modules as $module) {
            foreach ($actions as $action) {
                $permissions[] = Permission::firstOrCreate([
                    'name' => "{$module}.{$action}",
                    'guard_name' => 'web',
                ]);
            }
        }

        // Admin — all permissions
        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->syncPermissions(Permission::all());

        // Manager — all except delete
        $manager = Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'web']);
        $manager->syncPermissions(
            Permission::where('name', 'not like', '%.delete')->get()
        );

        // Accountant — accounting + view others
        $accountant = Role::firstOrCreate(['name' => 'accountant', 'guard_name' => 'web']);
        $accountant->syncPermissions(
            Permission::where('name', 'like', 'accounting.%')
                ->orWhere('name', 'like', '%.view')
                ->get()
        );

        // Salesman — sales + inventory view + party view
        $salesman = Role::firstOrCreate(['name' => 'salesman', 'guard_name' => 'web']);
        $salesman->syncPermissions(
            Permission::where('name', 'like', 'sales.%')
                ->orWhere('name', 'inventory.view')
                ->orWhere('name', 'party.view')
                ->get()
        );
    }
}
