import { ArrowLeft } from 'lucide-react';
import { TYPE_CONFIG, type VoucherTab } from './types';

interface VoucherFormHeaderProps {
  voucherType: VoucherTab;
  isEdit?: boolean;
  onBack: () => void;
}

export function VoucherFormHeader({ voucherType, isEdit = false, onBack }: VoucherFormHeaderProps) {
  const config = TYPE_CONFIG[voucherType];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.iconBg}`}>
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
        </div>
        <div>
          <h1 className={`text-xl font-bold ${config.color}`}>
            {isEdit ? 'Edit' : 'New'} {config.label} Voucher
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Shortcut:{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-gray-800 rounded">
              {config.shortcut}
            </kbd>
          </p>
        </div>
      </div>
    </div>
  );
}
