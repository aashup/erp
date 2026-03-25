import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  const { theme } = useTheme();
  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm',
        theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  const { theme } = useTheme();
  return (
    <div
      className={cn(
        'px-6 py-4',
        theme === 'dark' ? 'border-b border-gray-700' : 'border-b border-gray-200',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className }: CardProps) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>;
}
