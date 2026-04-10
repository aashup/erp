import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { salesInvoicesApi } from "@/api/sales";
import { formatCurrency } from "@/lib/utils";

export function RecentInvoicesWidget() {
  const { data: invoices } = useQuery({
    queryKey: ["sales-invoices-recent"],
    queryFn: () => salesInvoicesApi.list({ per_page: "5" }),
    select: (res) => res.data.data,
  });

  if (!invoices || invoices.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent Sales Invoices
          </h3>
          <Link
            to="/sales/invoices"
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="pb-2 font-medium">Invoice #</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium text-right">Balance</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b last:border-0 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200"
                >
                  <td className="py-2 font-medium">{inv.invoice_number}</td>
                  <td className="py-2">{inv.party?.name ?? "—"}</td>
                  <td className="py-2 text-right">
                    {formatCurrency(inv.grand_total)}
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(inv.balance_due)}
                  </td>
                  <td className="py-2">
                    <Badge
                      variant={
                        inv.status === "confirmed"
                          ? "success"
                          : inv.status === "cancelled"
                            ? "danger"
                            : "default"
                      }
                    >
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
  );
}
