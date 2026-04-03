import { useState, useEffect } from 'react';

export function Footer() {
  const [currentDateTime, setCurrentDateTime] = useState<string>('');

  useEffect(() => {
    // Set initial time
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setCurrentDateTime(formatted);
    };

    updateTime();

    // Update every second
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 sm:py-3 sm:text-sm">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 md:pl-80">
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row sm:gap-4">
          <div className="text-center sm:text-left">
            <p>&copy; {currentYear} Your Company. All rights reserved.</p>
          </div>
          <div className="text-center sm:text-right">
            <p>{currentDateTime || 'Loading...'}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
