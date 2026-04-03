import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function FilterPanel({ open, onClose, children }: FilterPanelProps) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}
      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-80 transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body - children go here */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
