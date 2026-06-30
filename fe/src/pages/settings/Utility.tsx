import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardHeader } from '@/components/ui/Card';
import { QrCode, Barcode } from 'lucide-react';

const tools = [
  {
    name: 'Print QR Codes',
    description: 'Generate and print QR code tags for items',
    href: '/settings/utility/print-qr',
    icon: QrCode,
  },
  {
    name: 'Print Barcodes',
    description: 'Generate and print barcode tags for items',
    href: '/settings/utility/print-barcode',
    icon: Barcode,
  },
];

export default function Utility() {
  usePageTitle('Utility');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Utility</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tools for generating and printing item tags
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
          <div
            key={tool.href}
            onClick={() => navigate(tool.href)}
            className="cursor-pointer"
          >
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/30">
                    <tool.icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
