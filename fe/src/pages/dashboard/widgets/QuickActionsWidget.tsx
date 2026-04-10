import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Package, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

const QUICK_ACTIONS: { name: string; href: string; Icon: LucideIcon }[] = [
  { name: "New Sales Invoice", href: "/sales/invoices", Icon: TrendingUp },
  { name: "New Purchase Order", href: "/purchase/orders", Icon: TrendingDown },
  { name: "Add Item", href: "/inventory/items", Icon: Package },
  { name: "Add Party", href: "/parties", Icon: Users },
];

export function QuickActionsWidget() {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Quick Actions
        </h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map(({ name, href, Icon }) => (
            <Link
              key={name}
              to={href}
              className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {name}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
