import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/authStore';
import { useSync } from '@/hooks/useSync';
import { itemsApi } from '@/api/inventory';
import { partiesApi } from '@/api/parties';
import { purchaseOrdersApi } from '@/api/purchase';
import { salesInvoicesApi } from '@/api/sales';
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

export default function Dashboard() {
  const { user } = useAuthStore();
  const { pendingCount, lastSync, isSyncing } = useSync();

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

  const stats = [
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

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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
