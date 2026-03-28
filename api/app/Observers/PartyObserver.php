<?php

namespace App\Observers;

use App\Models\AccountingGroup;
use App\Models\Party;

class PartyObserver
{
    /**
     * When a party is created, auto-create a ledger account under
     * Sundry Debtors (customer) or Sundry Creditors (vendor).
     */
    public function created(Party $party): void
    {
        $companyId = $party->company_id;

        // Determine the parent group based on party type
        if ($party->type === 'vendor') {
            $parentKey = 'sundry_creditors';
            $type = 'liability';
        } else {
            // customer or both → Sundry Debtors
            $parentKey = 'sundry_debtors';
            $type = 'asset';
        }

        $parentAccount = AccountingGroup::findBySystemKey($companyId, $parentKey);

        if (! $parentAccount) {
            // If system accounts not yet set up, skip silently
            return;
        }

        // Generate a unique code for this party ledger
        $lastCode = AccountingGroup::where('company_id', $companyId)
            ->where('parent_id', $parentAccount->id)
            ->orderByDesc('code')
            ->value('code');

        $nextCode = $lastCode
            ? (string) ((int) $lastCode + 1)
            : $parentAccount->code.'01';

        // Determine opening balance type
        $balanceType = 'dr';
        if ($party->balance_type === 'credit' || $party->balance_type === 'cr') {
            $balanceType = 'cr';
        }

        $ledgerAccount = AccountingGroup::create([
            'company_id' => $companyId,
            'parent_id' => $parentAccount->id,
            'code' => $nextCode,
            'name' => $party->name,
            'type' => $type,
            'group' => $parentAccount->group,
            'is_system' => false,
            'is_active' => true,
            'opening_balance' => $party->opening_balance ?? 0,
            'balance_type' => $balanceType,
        ]);

        // Link party to its ledger account (without triggering observer again)
        Party::withoutEvents(function () use ($party, $ledgerAccount) {
            $party->update(['ledger_account_id' => $ledgerAccount->id]);
        });
    }

    /**
     * When a party name is updated, sync the ledger account name.
     */
    public function updated(Party $party): void
    {
        if ($party->isDirty('name') && $party->ledger_account_id) {
            $party->ledgerAccount?->update(['name' => $party->name]);
        }
    }
}
