import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardHeader } from '@/components/ui/Card';
import { ArrowLeftRight, PackageOpen } from 'lucide-react';

const items = [
  {
    name: 'Stock Transfer',
    description: 'Transfer stock between godowns / warehouses',
    href: '/inventory/stock-transfer',
    icon: ArrowLeftRight,
  },
  {
    name: 'Opening Stock',
    description: 'Set opening stock for items across godowns',
    href: '/inventory/opening-stock',
    icon: PackageOpen,
  },
];

export default function InventorySettings() {
  usePageTitle('Inventory Settings');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage stock transfers and opening stock entries
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.href}
            onClick={() => navigate(item.href)}
            className="cursor-pointer"
          >
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/30">
                    <item.icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
