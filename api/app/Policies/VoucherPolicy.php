<?php

namespace App\Policies;

use App\Models\Voucher;
use App\Models\User;

class VoucherPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('accounting.view');
    }

    public function view(User $user, Voucher $entry): bool
    {
        return $user->company_id === $entry->company_id && $user->hasPermissionTo('accounting.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('accounting.create');
    }

    public function update(User $user, Voucher $entry): bool
    {
        return $user->company_id === $entry->company_id && $user->hasPermissionTo('accounting.edit');
    }

    public function delete(User $user, Voucher $entry): bool
    {
        return $user->company_id === $entry->company_id && $user->hasPermissionTo('accounting.delete');
    }
}
