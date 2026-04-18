import { useState, useEffect } from 'react';
import { X, Banknote, Smartphone, CreditCard, Scissors, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export type PaymentMode = 'cash' | 'upi' | 'card';

export interface PaymentEntry {
  mode: PaymentMode;
  amount: number;
  reference: string;
}

interface Props {
  grandTotal: number;   // raw total before round-off
  netPayable: number;   // rounded total (what customer pays)
  roundOff: number;     // difference (signed)
  onConfirm: (payments: PaymentEntry[], amountTendered: number, changeAmount: number) => void;
  onClose: () => void;
  loading?: boolean;
}

const MODE_ICONS: Record<PaymentMode, React.ReactNode> = {
  cash: <Banknote className="h-5 w-5" />,
  upi: <Smartphone className="h-5 w-5" />,
  card: <CreditCard className="h-5 w-5" />,
};

const MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
};

type Tab = 'cash' | 'upi' | 'card' | 'split';

export default function POSPaymentModal({ grandTotal, netPayable, roundOff, onConfirm, onClose, loading }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('cash');
  const [cashTendered, setCashTendered] = useState(netPayable.toFixed(0));
  const [upiRef, setUpiRef] = useState('');
  const [cardRef, setCardRef] = useState('');

  // Split payment
  const [splitLines, setSplitLines] = useState<{ mode: PaymentMode; amount: string; reference: string }[]>([
    { mode: 'cash', amount: netPayable.toFixed(0), reference: '' },
    { mode: 'upi', amount: '0.00', reference: '' },
  ]);

  const tendered = parseFloat(cashTendered) || 0;
  const change = Math.max(0, tendered - netPayable);

  const splitTotal = splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const splitRemaining = netPayable - splitTotal;

  function handleConfirm() {
    if (activeTab === 'cash') {
      onConfirm(
        [{ mode: 'cash', amount: netPayable, reference: '' }],
        tendered,
        change,
      );
    } else if (activeTab === 'upi') {
      onConfirm([{ mode: 'upi', amount: netPayable, reference: upiRef }], netPayable, 0);
    } else if (activeTab === 'card') {
      onConfirm([{ mode: 'card', amount: netPayable, reference: cardRef }], netPayable, 0);
    } else {
      // Split
      const payments = splitLines
        .filter((l) => parseFloat(l.amount) > 0)
        .map((l) => ({ mode: l.mode, amount: parseFloat(l.amount), reference: l.reference }));
      if (payments.length === 0) return;
      const cashLine = payments.find((p) => p.mode === 'cash');
      const cashAmt = cashLine?.amount ?? 0;
      onConfirm(payments, cashAmt, 0);
    }
  }

  function updateSplitLine(idx: number, field: 'mode' | 'amount' | 'reference', val: string) {
    setSplitLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
  }

  const canConfirm =
    activeTab === 'cash'
      ? tendered >= netPayable
      : activeTab === 'split'
      ? Math.abs(splitRemaining) < 0.01
      : true;

  // Quick cash amounts based on netPayable (already rounded)
  const quickAmounts = [netPayable, Math.ceil(netPayable / 10) * 10, Math.ceil(netPayable / 50) * 50, Math.ceil(netPayable / 100) * 100].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Total</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-through">{formatCurrency(grandTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Round Off</p>
                <p className={`text-sm font-medium ${roundOff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {roundOff >= 0 ? '+' : ''}{formatCurrency(roundOff)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Net Payable</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{netPayable}</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {(['cash', 'upi', 'card', 'split'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab === 'cash' && <Banknote className="h-4 w-4" />}
              {tab === 'upi' && <Smartphone className="h-4 w-4" />}
              {tab === 'card' && <CreditCard className="h-4 w-4" />}
              {tab === 'split' && <Scissors className="h-4 w-4" />}
              {tab === 'cash' ? 'Cash' : tab === 'split' ? 'Split' : tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {activeTab === 'cash' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cash Tendered (₹)</label>
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="w-full text-xl font-bold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-400 text-center"
                  autoFocus
                />
              </div>
              {/* Quick amount buttons */}
              <div className="flex gap-2">
                {quickAmounts.slice(0, 4).map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCashTendered(amt.toFixed(2))}
                    className="flex-1 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    ₹{amt % 1 === 0 ? amt : amt.toFixed(2)}
                  </button>
                ))}
              </div>
              {/* Change */}
              <div className={`flex justify-between rounded-xl px-4 py-3 ${change > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                <span className={`text-sm font-medium ${change > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  Change to Return
                </span>
                <span className={`text-lg font-bold ${change > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-400'}`}>
                  {formatCurrency(change)}
                </span>
              </div>
              {tendered < netPayable && tendered > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  ₹{formatCurrency(netPayable - tendered)} still remaining
                </p>
              )}
            </>
          )}

          {activeTab === 'upi' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">UPI Reference (optional)</label>
              <input
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value)}
                placeholder="UPI transaction ID"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-2 text-center">
                Collecting ₹{netPayable} via UPI
              </p>
            </div>
          )}

          {activeTab === 'card' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Card Reference (optional)</label>
              <input
                value={cardRef}
                onChange={(e) => setCardRef(e.target.value)}
                placeholder="Card approval code"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-2 text-center">
                Collecting ₹{netPayable} via Card
              </p>
            </div>
          )}

          {activeTab === 'split' && (
            <div className="space-y-3">
              {splitLines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={line.mode}
                    onChange={(e) => updateSplitLine(idx, 'mode', e.target.value)}
                    className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                  <input
                    type="number"
                    value={line.amount}
                    onChange={(e) => updateSplitLine(idx, 'amount', e.target.value)}
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400"
                    placeholder="Amount"
                    min="0"
                  />
                  <input
                    value={line.reference}
                    onChange={(e) => updateSplitLine(idx, 'reference', e.target.value)}
                    className="w-24 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none"
                    placeholder="Ref"
                  />
                </div>
              ))}
              <div className={`text-xs text-center font-medium ${Math.abs(splitRemaining) < 0.01 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {Math.abs(splitRemaining) < 0.01
                  ? '✓ Amounts match'
                  : splitRemaining > 0
                  ? `Still ₹${formatCurrency(splitRemaining)} remaining`
                  : `₹${formatCurrency(-splitRemaining)} over total`}
              </div>
            </div>
          )}
        </div>

        {/* Confirm button */}
        <div className="px-5 pb-5">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Confirm Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
