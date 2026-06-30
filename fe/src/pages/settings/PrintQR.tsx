import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';

function zeroPad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function buildCodes(prefix: string, start: number, postfix: string, qty: number): string[] {
  const width = String(start + qty - 1).length;
  return Array.from({ length: qty }, (_, i) => `${prefix}${zeroPad(start + i, width)}${postfix}`);
}

const COLS_OPTIONS = [2, 3, 4, 6];

export default function PrintQR() {
  usePageTitle('Print QR Codes');
  const navigate = useNavigate();

  const [prefix, setPrefix] = useState('');
  const [start, setStart] = useState(1);
  const [postfix, setPostfix] = useState('');
  const [qty, setQty] = useState(10);
  const [size, setSize] = useState(100);
  const [cols, setCols] = useState(4);

  const codes = buildCodes(prefix, start, postfix, Math.max(1, Math.min(qty, 500)));

  const handlePrint = () => {
    const area = document.getElementById('qr-print-area');
    if (!area) return;

    const pw = window.open('', '_blank', 'width=900,height=700');
    if (!pw) return;

    pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>QR Tags</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; font-family: sans-serif; }
    .grid {
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 6px;
      padding: 10px;
    }
    .tag {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border: 1px solid #ccc;
      page-break-inside: avoid;
      break-inside: avoid;
      background: #fff;
    }
    .tag-text {
      font-size: 10px;
      margin-top: 4px;
      word-break: break-all;
      text-align: center;
      color: #000;
    }
    @page { margin: 0.5cm; }
  </style>
</head>
<body>
  <div class="grid">${area.innerHTML}</div>
</body>
</html>`);
    pw.document.close();
    pw.focus();
    setTimeout(() => { pw.print(); pw.close(); }, 400);
  };

  const colsClass: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    6: 'grid-cols-6',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings/utility')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Print QR Codes</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Generate QR code tags for item labelling
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Prefix</label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. ITEM-"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Start Number</label>
            <input
              type="number"
              value={start}
              min={0}
              onChange={(e) => setStart(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Postfix</label>
            <input
              type="text"
              value={postfix}
              onChange={(e) => setPostfix(e.target.value)}
              placeholder="e.g. -A"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Quantity <span className="text-gray-400">(1–500)</span>
            </label>
            <input
              type="number"
              value={qty}
              min={1}
              max={500}
              onChange={(e) => setQty(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              QR Size: <span className="font-semibold text-primary-600">{size}px</span>
            </label>
            <input
              type="range"
              min={40}
              max={200}
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>40px</span><span>200px</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Labels per Row</label>
            <div className="flex gap-2">
              {COLS_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCols(c)}
                  className={`flex-1 rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
                    cols === c
                      ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">
            Preview ({codes.length} label{codes.length !== 1 ? 's' : ''})
          </h2>
        </div>

        <div id="qr-print-area" className={`grid gap-3 ${colsClass[cols] ?? 'grid-cols-4'}`}>
          {codes.map((code) => (
            <div
              key={code}
              className="tag flex flex-col items-center justify-center rounded-md border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
            >
              <QRCodeSVG value={code || ' '} size={size} />
              <span className="tag-text mt-2 break-all text-center text-xs text-gray-700 dark:text-gray-300">
                {code}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Print Bar */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white py-3 dark:border-gray-700 dark:bg-gray-900">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-md bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 active:bg-primary-800"
        >
          <Printer className="h-4 w-4" />
          Print {codes.length} Label{codes.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
