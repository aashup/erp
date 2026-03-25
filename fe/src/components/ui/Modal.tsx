import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const { theme } = useTheme();
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} mx-4 rounded-xl bg-white shadow-xl dark:bg-gray-800`}>
        <div className={`flex items-center justify-between border-b px-6 py-4 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>
        <div className={`px-6 py-4 max-h-[70vh] overflow-y-auto ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>{children}</div>
      </div>
    </div>
  );
}
