import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { ArrowLeft, Printer, AlertCircle } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';

type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC';

interface FormatOption {
  value: BarcodeFormat;
  label: string;
  hint?: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'CODE128', label: 'CODE 128', hint: 'Any characters' },
  { value: 'CODE39', label: 'CODE 39', hint: 'Uppercase + digits' },
  { value: 'EAN13', label: 'EAN-13', hint: 'Exactly 12 digits' },
  { value: 'EAN8', label: 'EAN-8', hint: 'Exactly 7 digits' },
  { value: 'UPC', label: 'UPC-A', hint: 'Exactly 11 digits' },
];

const COLS_OPTIONS = [2, 3, 4, 6];

function zeroPad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function buildCodes(prefix: string, start: number, postfix: string, qty: number): string[] {
  const width = String(start + qty - 1).length;
  return Array.from({ length: qty }, (_, i) => `${prefix}${zeroPad(start + i, width)}${postfix}`);
}

function BarcodeTag({
  code,
  format,
  width,
  height,
  showText,
}: {
  code: string;
  format: BarcodeFormat;
  width: number;
  height: number;
  showText: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, code, {
        format,
        width: Math.max(1, width / 40),
        height,
        displayValue: showText,
        fontSize: 11,
        margin: 4,
        background: '#ffffff',
        lineColor: '#000000',
      });
      setError('');
    } catch (e) {
      setError((e as Error).message ?? 'Invalid value for format');
    }
  }, [code, format, width, height, showText]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <span className="text-xs text-red-500">{code}</span>
        <span className="text-xs text-red-400">{error}</span>
      </div>
    );
  }

  return <svg ref={svgRef} className="max-w-full" />;
}

export default function PrintBarcode() {
  usePageTitle('Print Barcodes');
  const navigate = useNavigate();

  const [prefix, setPrefix] = useState('');
  const [start, setStart] = useState(1);
  const [postfix, setPostfix] = useState('');
  const [qty, setQty] = useState(10);
  const [barcodeHeight, setBarcodeHeight] = useState(60);
  const [barcodeWidth, setBarcodeWidth] = useState(160);
  const [cols, setCols] = useState(4);
  const [format, setFormat] = useState<BarcodeFormat>('CODE128');
  const [showText, setShowText] = useState(true);

  const codes = buildCodes(prefix, start, postfix, Math.max(1, Math.min(qty, 500)));
  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === format);

  const handlePrint = () => {
    const area = document.getElementById('barcode-print-area');
    if (!area) return;

    const pw = window.open('', '_blank', 'width=900,height=700');
    if (!pw) return;

    pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Barcode Tags</title>
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
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .tag svg { max-width: 100%; }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Print Barcodes</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Generate barcode tags for item labelling
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
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Barcode Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as BarcodeFormat)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {selectedFormat?.hint && (
              <p className="mt-1 text-xs text-gray-400">{selectedFormat.hint}</p>
            )}
          </div>
          <div className="flex items-center gap-3 pt-5">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={showText}
                onChange={(e) => setShowText(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full dark:bg-gray-600" />
              <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Show text</span>
            </label>
          </div>
        </div>

        {/* Size controls */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Barcode Width: <span className="font-semibold text-primary-600">{barcodeWidth}px</span>
            </label>
            <input
              type="range"
              min={80}
              max={300}
              value={barcodeWidth}
              onChange={(e) => setBarcodeWidth(parseInt(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>80px</span><span>300px</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Barcode Height: <span className="font-semibold text-primary-600">{barcodeHeight}px</span>
            </label>
            <input
              type="range"
              min={20}
              max={150}
              value={barcodeHeight}
              onChange={(e) => setBarcodeHeight(parseInt(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>20px</span><span>150px</span>
            </div>
          </div>
        </div>

        {/* Cols picker */}
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Labels per Row</label>
          <div className="flex gap-2 sm:w-56">
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

      {/* Preview */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">
            Preview ({codes.length} label{codes.length !== 1 ? 's' : ''})
          </h2>
        </div>

        <div id="barcode-print-area" className={`grid gap-3 ${colsClass[cols] ?? 'grid-cols-4'}`}>
          {codes.map((code) => (
            <div
              key={code}
              className="tag flex flex-col items-center justify-center rounded-md border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
            >
              <BarcodeTag
                code={code}
                format={format}
                width={barcodeWidth}
                height={barcodeHeight}
                showText={showText}
              />
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
