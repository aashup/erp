<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            // Foundation
            RolePermissionSeeder::class,
            CompanySeeder::class,
            BranchSeeder::class,
            UserSeeder::class,
            FinancialYearSeeder::class,
            AccountingGroupSeeder::class,
            LedgerSeeder::class,
            UnitSeeder::class,

            // Inventory
            GodownSeeder::class,
            ItemSeeder::class,
            BatchSeeder::class,
            StockLedgerSeeder::class,

            // Parties (observer auto-creates ledgers)
            PartySeeder::class,

            // Purchase
            PurchaseOrderSeeder::class,
            PurchaseInvoiceSeeder::class,

            // Sales
            SalesOrderSeeder::class,
            SalesInvoiceSeeder::class,

            // Sample Invoices
            AidwayBiotechInvoiceSeeder::class,

            // Accounting
            PaymentReceiptSeeder::class,
            VoucherSeeder::class,
        ]);
    }
}
