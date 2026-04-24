import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  ArrowLeftRight,
  CreditCard,
  HandCoins,
  BookOpen,
  ChevronRight,
} from "lucide-react";

const VOUCHER_TYPES = [
  {
    key: "contra",
    label: "Contra",
    shortcut: "F4",
    purpose:
      "Fund transfers between Cash and Bank or between two Bank accounts.",
    icon: ArrowLeftRight,
    color:
      "border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600",
    iconBg: "bg-purple-100 dark:bg-purple-900/40",
    iconColor: "text-purple-600 dark:text-purple-400",
    labelColor: "text-purple-700 dark:text-purple-300",
  },
  {
    key: "payment",
    label: "Payment",
    shortcut: "F5",
    purpose:
      "All types of payments (Cash/Bank) made to parties or for expenses.",
    icon: CreditCard,
    color:
      "border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600",
    iconBg: "bg-red-100 dark:bg-red-900/40",
    iconColor: "text-red-600 dark:text-red-400",
    labelColor: "text-red-700 dark:text-red-300",
  },
  {
    key: "receipt",
    label: "Receipt",
    shortcut: "F6",
    purpose: "All money received (Cash/Bank) from customers or other sources.",
    icon: HandCoins,
    color:
      "border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600",
    iconBg: "bg-green-100 dark:bg-green-900/40",
    iconColor: "text-green-600 dark:text-green-400",
    labelColor: "text-green-700 dark:text-green-300",
  },
  {
    key: "journal",
    label: "Journal",
    shortcut: "F7",
    purpose: "Adjustment entries, depreciation, and non-cash transactions.",
    icon: BookOpen,
    color:
      "border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    labelColor: "text-blue-700 dark:text-blue-300",
  },
  // {
  //   key: 'sales',
  //   label: 'Sales',
  //   shortcut: 'F8',
  //   purpose: 'Recording the sale of goods or services.',
  //   icon: Receipt,
  //   color: 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600',
  //   iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
  //   iconColor: 'text-emerald-600 dark:text-emerald-400',
  //   labelColor: 'text-emerald-700 dark:text-emerald-300',
  // },
  // {
  //   key: 'purchase',
  //   label: 'Purchase',
  //   shortcut: 'F9',
  //   purpose: 'Recording the purchase of goods or services.',
  //   icon: ShoppingCart,
  //   color: 'border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600',
  //   iconBg: 'bg-orange-100 dark:bg-orange-900/40',
  //   iconColor: 'text-orange-600 dark:text-orange-400',
  //   labelColor: 'text-orange-700 dark:text-orange-300',
  // },
];

export default function VouchersHub() {
  usePageTitle("Vouchers Entry");
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Vouchers Entry
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Select a voucher type to view entries or create a new one.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VOUCHER_TYPES.map((vt) => {
          const Icon = vt.icon;
          return (
            <button
              key={vt.key}
              onClick={() => navigate(`/accounting/vouchers/${vt.key}`)}
              className={`group flex items-start gap-4 rounded-xl border-2 bg-white dark:bg-gray-900 p-5 text-left transition-all duration-200 hover:shadow-md ${vt.color}`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${vt.iconBg}`}
              >
                <Icon className={`h-6 w-6 ${vt.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-base font-semibold ${vt.labelColor}`}>
                    {vt.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <kbd className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {vt.shortcut}
                    </kbd>
                    <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {vt.purpose}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
