import { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { formatCurrency, calcGST, calcRoundOff } from '@/lib/utils';
import type { CartLine } from './POSPage2';

interface Props {
  lines: CartLine[];
  isInterState: boolean;
  onQtyChange: (id: string, qty: number) => void;
  onDiscChange: (id: string, disc: number) => void;
  onRemove: (id: string) => void;
}

export default function POSCart2({ lines, isInterState, onQtyChange, onDiscChange, onRemove }: Props) {
  const [editingDisc, setEditingDisc] = useState<string | null>(null);

  // Calculate totals
  const totals = lines.reduce(
    (acc, line) => {
      const taxable = line.quantity * line.rate * (1 - line.discountPct / 100);
      const gst = calcGST(taxable, line.gstRate, isInterState);
      acc.subtotal += line.quantity * line.rate;
      acc.discountAmt += line.quantity * line.rate * (line.discountPct / 100);
      acc.taxable += taxable;
      acc.cgst += gst.cgst;
      acc.sgst += gst.sgst;
      acc.igst += gst.igst;
      acc.total += taxable + gst.cgst + gst.sgst + gst.igst;
      return acc;
    },
    { subtotal: 0, discountAmt: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  );
  const { roundOff, netPayable } = calcRoundOff(totals.total);

  function handleQtyInput(id: string, val: string) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) onQtyChange(id, num);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cart lines */}
      <div className="flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 select-none">
            <p className="text-4xl mb-2">🛒</p>
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs mt-1">Search or tap a product to add</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {lines.map((line) => {
              const taxable = line.quantity * line.rate * (1 - line.discountPct / 100);
              const gst = calcGST(taxable, line.gstRate, isInterState);
              const lineTotal = taxable + gst.cgst + gst.sgst + gst.igst;
              return (
                <div key={line.id} className="px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{line.name}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(line.rate)} / {line.unit}</p>
                      {line.currentStock !== undefined && line.quantity > line.currentStock && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span className="text-xs text-amber-500">Only {line.currentStock} in stock</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {formatCurrency(lineTotal)}
                    </p>
                    <button
                      onClick={() => onRemove(line.id)}
                      className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5">
                    {/* Qty controls */}
                    <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                      <button
                        onClick={() => onQtyChange(line.id, Math.max(0.001, line.quantity - 1))}
                        className="px-2 py-1 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => handleQtyInput(line.id, e.target.value)}
                        className="w-12 text-center text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 outline-none py-1"
                        min="0.001"
                        step="1"
                      />
                      <button
                        onClick={() => onQtyChange(line.id, line.quantity + 1)}
                        className="px-2 py-1 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Discount */}
                    <div className="flex items-center gap-1">
                      {editingDisc === line.id ? (
                        <input
                          type="number"
                          value={line.discountPct}
                          onChange={(e) => onDiscChange(line.id, Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                          onBlur={() => setEditingDisc(null)}
                          autoFocus
                          className="w-16 text-center text-xs border border-indigo-400 rounded-lg py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none"
                          min="0"
                          max="100"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingDisc(line.id)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        >
                          {line.discountPct > 0 ? `${line.discountPct}% off` : '+ Disc'}
                        </button>
                      )}
                    </div>

                    {/* GST info */}
                    {line.gstRate > 0 && (
                      <span className="ml-auto text-xs text-gray-400">
                        GST {line.gstRate}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totals */}
      {lines.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.discountAmt > 0 && (
            <div className="flex justify-between text-xs text-green-600 dark:text-green-400">
              <span>Discount</span>
              <span>-{formatCurrency(totals.discountAmt)}</span>
            </div>
          )}
          {!isInterState ? (
            <>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>CGST</span>
                <span>{formatCurrency(totals.cgst)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>SGST</span>
                <span>{formatCurrency(totals.sgst)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>IGST</span>
              <span>{formatCurrency(totals.igst)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Total</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Round Off</span>
            <span className={roundOff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
              {roundOff >= 0 ? '+' : ''}{formatCurrency(roundOff)}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-100 pt-1 border-t border-gray-200 dark:border-gray-700">
            <span>Net Payable</span>
            <span>₹{netPayable}</span>
          </div>
        </div>
      )}
    </div>
  );
}
