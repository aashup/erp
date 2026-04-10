import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Package, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

const QUICK_ACTIONS = [
  { name: "New Sales Invoice",    href: "/sales/invoices",   icon: TrendingUp   },
  { name: "New Purchase Order",   href: "/purchase/orders",  icon: TrendingDown },
  { name: "Add Item",             href: "/inventory/items",  icon: Package      },
  { name: "Add Party",            href: "/parties",          icon: Users        },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.name}
              to={action.href}
              className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <action.icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.name}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
