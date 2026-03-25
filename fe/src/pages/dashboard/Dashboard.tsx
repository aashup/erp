import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/authStore';
import { useSync } from '@/hooks/useSync';
import { itemsApi } from '@/api/inventory';
import { partiesApi } from '@/api/parties';
import { purchaseOrdersApi } from '@/api/purchase';
import { salesInvoicesApi } from '@/api/sales';
import { dashboardApi } from '@/api/dashboard';
import { formatCurrency } from '@/lib/utils';
import {
  Package,
  ShoppingCart,
  IndianRupee,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

type Period = 'today' | 'this_week' | 'this_month' | 'this_year';

const periodLabels: Record<Period, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  this_year: 'This Year',
};

function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1">
      {(Object.keys(periodLabels) as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === p
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {periodLabels[p]}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const { pendingCount, lastSync, isSyncing } = useSync();
  const [salesPeriod, setSalesPeriod] = useState<Period>('this_month');
  const [purchasePeriod, setPurchasePeriod] = useState<Period>('this_month');
  const [pnlPeriod, setPnlPeriod] = useState<Period>('this_month');

  const { data: itemsData } = useQuery({
    queryKey: ['items', 1],
    queryFn: () => itemsApi.list({ per_page: '1' }),
    select: (res) => res.data,
  });

  const { data: partiesData } = useQuery({
    queryKey: ['parties', 1],
    queryFn: () => partiesApi.list({ per_page: '1' }),
    select: (res) => res.data,
  });

  const { data: posData } = useQuery({
    queryKey: ['purchase-orders', 1],
    queryFn: () => purchaseOrdersApi.list({ per_page: '1' }),
    select: (res) => res.data,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['sales-invoices', 1],
    queryFn: () => salesInvoicesApi.list({ per_page: '5' }),
    select: (res) => res.data,
  });

  // Dashboard stats queries — each widget has its own period
  const { data: salesStats, isLoading: salesLoading } = useQuery({
    queryKey: ['dashboard-stats-sales', salesPeriod],
    queryFn: () => dashboardApi.stats(salesPeriod),
    select: (res) => res.data.data,
  });

  const { data: purchaseStats, isLoading: purchaseLoading } = useQuery({
    queryKey: ['dashboard-stats-purchase', purchasePeriod],
    queryFn: () => dashboardApi.stats(purchasePeriod),
    select: (res) => res.data.data,
  });

  const { data: pnlStats, isLoading: pnlLoading } = useQuery({
    queryKey: ['dashboard-stats-pnl', pnlPeriod],
    queryFn: () => dashboardApi.stats(pnlPeriod),
    select: (res) => res.data.data,
  });

  const countStats = [
    { name: 'Total Items', value: itemsData?.total?.toString() ?? '—', icon: Package, color: 'bg-blue-500' },
    { name: 'Parties', value: partiesData?.total?.toString() ?? '—', icon: Users, color: 'bg-green-500' },
    { name: 'Purchase Orders', value: posData?.total?.toString() ?? '—', icon: ShoppingCart, color: 'bg-orange-500' },
    { name: 'Sales Invoices', value: invoicesData?.total?.toString() ?? '—', icon: IndianRupee, color: 'bg-purple-500' },
  ];

  const quickActions = [
    { name: 'New Sales Invoice', href: '/sales/invoices', icon: TrendingUp },
    { name: 'New Purchase Order', href: '/purchase/orders', icon: TrendingDown },
    { name: 'Add Item', href: '/inventory/items', icon: Package },
    { name: 'Add Party', href: '/parties', icon: Users },
  ];

  const recentInvoices = invoicesData?.data ?? [];
  const pnlValue = pnlStats?.pnl ?? 0;
  const pnlIsPositive = pnlValue >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user?.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Count Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {countStats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color} text-white`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales / Purchase / P&L Widgets */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Total Sales */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-white">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700">Total Sales</h3>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PeriodFilter value={salesPeriod} onChange={setSalesPeriod} />
            <div className="mt-4">
              {salesLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
              ) : (
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(salesStats?.total_sales ?? 0)}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                {salesStats?.from} — {salesStats?.to}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Purchase */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700">Total Purchase</h3>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PeriodFilter value={purchasePeriod} onChange={setPurchasePeriod} />
            <div className="mt-4">
              {purchaseLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
              ) : (
                <p className="text-3xl font-bold text-orange-600">
                  {formatCurrency(purchaseStats?.total_purchase ?? 0)}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                {purchaseStats?.from} — {purchaseStats?.to}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* P&L */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${pnlIsPositive ? 'bg-emerald-500' : 'bg-red-500'} text-white`}>
                  <IndianRupee className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700">Profit & Loss</h3>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PeriodFilter value={pnlPeriod} onChange={setPnlPeriod} />
            <div className="mt-4">
              {pnlLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
              ) : (
                <>
                  <p className={`text-3xl font-bold ${pnlIsPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {pnlIsPositive ? '+' : ''}{formatCurrency(pnlValue)}
                  </p>
                  <div className="mt-2 flex gap-4 text-xs text-gray-500">
                    <span>Sales: {formatCurrency(pnlStats?.total_sales ?? 0)}</span>
                    <span>Purchase: {formatCurrency(pnlStats?.total_purchase ?? 0)}</span>
                  </div>
                </>
              )}
              <p className="mt-1 text-xs text-gray-400">
                {pnlStats?.from} — {pnlStats?.to}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  to={action.href}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                >
                  <action.icon className="h-5 w-5 text-primary-600" />
                  <span className="text-sm font-medium text-gray-700">{action.name}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Sync */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Alerts & Sync</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingCount > 0 && (
                <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm text-yellow-700">{pendingCount} record(s) pending sync</span>
                </div>
              )}
              {isSyncing && (
                <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-3">
                  <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                  <span className="text-sm text-blue-700">Syncing data...</span>
                </div>
              )}
              {!isSyncing && pendingCount === 0 && (
                <div className="flex items-center gap-3 rounded-lg bg-green-50 p-3">
                  <Clock className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-700">
                    All data synced{lastSync ? ` — last sync ${lastSync.toLocaleTimeString('en-IN')}` : ''}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Invoices */}
      {recentInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Sales Invoices</h3>
              <Link to="/sales/invoices" className="text-sm text-primary-600 hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Invoice #</th>
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium text-right">Balance</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{inv.invoice_number}</td>
                      <td className="py-2">{inv.party?.name ?? '—'}</td>
                      <td className="py-2 text-right">{formatCurrency(inv.grand_total)}</td>
                      <td className="py-2 text-right">{formatCurrency(inv.balance_due)}</td>
                      <td className="py-2">
                        <Badge variant={inv.status === 'confirmed' ? 'success' : inv.status === 'cancelled' ? 'danger' : 'default'}>
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
