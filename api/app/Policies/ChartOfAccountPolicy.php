<?php

namespace App\Policies;

use App\Models\ChartOfAccount;
use App\Models\User;

class ChartOfAccountPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('accounting.view');
    }

    public function view(User $user, ChartOfAccount $account): bool
    {
        return $user->company_id === $account->company_id && $user->hasPermissionTo('accounting.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('accounting.create');
    }

    public function update(User $user, ChartOfAccount $account): bool
    {
        if ($account->is_system) {
            return false;
        }
        return $user->company_id === $account->company_id && $user->hasPermissionTo('accounting.edit');
    }

    public function delete(User $user, ChartOfAccount $account): bool
    {
        if ($account->is_system) {
            return false;
        }
        return $user->company_id === $account->company_id && $user->hasPermissionTo('accounting.delete');
    }
}
