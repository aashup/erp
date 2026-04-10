import { Card, CardContent } from "@/components/ui/Card";
import { Package, Users, ShoppingCart, IndianRupee } from "lucide-react";

interface CountStat {
  name: string;
  value: string;
  icon: React.ElementType;
  color: string;
}

interface Props {
  itemsTotal?: number;
  partiesTotal?: number;
  posTotal?: number;
  invoicesTotal?: number;
}

export function CountStatsRow({ itemsTotal, partiesTotal, posTotal, invoicesTotal }: Props) {
  const stats: CountStat[] = [
    { name: "Total Items",      value: itemsTotal?.toString()    ?? "—", icon: Package,      color: "bg-blue-500"   },
    { name: "Parties",          value: partiesTotal?.toString()  ?? "—", icon: Users,        color: "bg-green-500"  },
    { name: "Purchase Orders",  value: posTotal?.toString()      ?? "—", icon: ShoppingCart, color: "bg-orange-500" },
    { name: "Sales Invoices",   value: invoicesTotal?.toString() ?? "—", icon: IndianRupee,  color: "bg-purple-500" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.name}>
          <CardContent className="flex items-center gap-4 py-5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color} text-white`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.name}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
