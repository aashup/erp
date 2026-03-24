<?php

namespace App\Policies;

use App\Models\JournalEntry;
use App\Models\User;

class JournalEntryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('accounting.view');
    }

    public function view(User $user, JournalEntry $entry): bool
    {
        return $user->company_id === $entry->company_id && $user->hasPermissionTo('accounting.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('accounting.create');
    }

    public function update(User $user, JournalEntry $entry): bool
    {
        return $user->company_id === $entry->company_id && $user->hasPermissionTo('accounting.edit');
    }

    public function delete(User $user, JournalEntry $entry): bool
    {
        return $user->company_id === $entry->company_id && $user->hasPermissionTo('accounting.delete');
    }
}
