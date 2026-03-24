import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';
import {
  Package,
  ShoppingCart,
  IndianRupee,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
} from 'lucide-react';

const stats = [
  { name: 'Total Items', value: '—', icon: Package, color: 'bg-blue-500' },
  { name: 'Parties', value: '—', icon: Users, color: 'bg-green-500' },
  { name: 'Purchase Orders', value: '—', icon: ShoppingCart, color: 'bg-orange-500' },
  { name: 'Sales Invoices', value: '—', icon: IndianRupee, color: 'bg-purple-500' },
];

const quickActions = [
  { name: 'New Sales Invoice', href: '/sales/invoices', icon: TrendingUp },
  { name: 'New Purchase Order', href: '/purchase/orders', icon: TrendingDown },
  { name: 'Add Item', href: '/inventory/items', icon: Package },
  { name: 'Add Party', href: '/parties', icon: Users },
];

export default function Dashboard() {
  const { user } = useAuthStore();

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
                <a
                  key={action.name}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                >
                  <action.icon className="h-5 w-5 text-primary-600" />
                  <span className="text-sm font-medium text-gray-700">{action.name}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Alerts</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-yellow-700">Low stock alerts will appear here</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-blue-700">Pending sync items will appear here</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
