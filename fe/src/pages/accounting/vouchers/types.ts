import { ArrowLeftRight, CreditCard, HandCoins, BookOpen, ShoppingCart, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type VoucherTab = 'contra' | 'payment' | 'receipt' | 'journal' | 'sales' | 'purchase';

interface VoucherTypeConfig {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  color: string;
}

export const TYPE_CONFIG: Record<VoucherTab, VoucherTypeConfig> = {
  contra:   { label: 'Contra',   shortcut: 'F4', icon: ArrowLeftRight, iconBg: 'bg-purple-100 dark:bg-purple-900/40',  iconColor: 'text-purple-600 dark:text-purple-400',  color: 'text-purple-700 dark:text-purple-300' },
  payment:  { label: 'Payment',  shortcut: 'F5', icon: CreditCard,     iconBg: 'bg-red-100 dark:bg-red-900/40',        iconColor: 'text-red-600 dark:text-red-400',        color: 'text-red-700 dark:text-red-300' },
  receipt:  { label: 'Receipt',  shortcut: 'F6', icon: HandCoins,      iconBg: 'bg-green-100 dark:bg-green-900/40',    iconColor: 'text-green-600 dark:text-green-400',    color: 'text-green-700 dark:text-green-300' },
  journal:  { label: 'Journal',  shortcut: 'F7', icon: BookOpen,       iconBg: 'bg-blue-100 dark:bg-blue-900/40',      iconColor: 'text-blue-600 dark:text-blue-400',      color: 'text-blue-700 dark:text-blue-300' },
  sales:    { label: 'Sales',    shortcut: 'F8', icon: Receipt,        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',iconColor: 'text-emerald-600 dark:text-emerald-400',color: 'text-emerald-700 dark:text-emerald-300' },
  purchase: { label: 'Purchase', shortcut: 'F9', icon: ShoppingCart,   iconBg: 'bg-orange-100 dark:bg-orange-900/40',  iconColor: 'text-orange-600 dark:text-orange-400',  color: 'text-orange-700 dark:text-orange-300' },
};

export const PAYMENT_TYPES = new Set<VoucherTab>(['payment', 'receipt']);
