import { useState } from 'react';
import { X, Banknote, Smartphone, CreditCard, Scissors, CheckCircle, BookOpen, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Party } from '@/types';

export type PaymentMode = 'cash' | 'upi' | 'card' | 'lend';

export interface PaymentEntry {
  mode: PaymentMode;
  amount: number;
  reference: string;
}

interface Props {
  grandTotal: number;   // raw total before round-off
  netPayable: number;   // rounded total (what customer pays)
  roundOff: number;     // difference (signed)
  customer: Party | null;
  onConfirm: (payments: PaymentEntry[], amountTendered: number, changeAmount: number, postPayment?: boolean) => void;
  onClose: () => void;
  loading?: boolean;
}

type Tab = 'cash' | 'upi' | 'card' | 'split' | 'post';

export default function POSPaymentModal2({ grandTotal, netPayable, roundOff, customer, onConfirm, onClose, loading }: Props) {
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

  // Post payment only available for registered (non-walk-in) customers
  const isRegisteredCustomer = !!customer && customer.name !== 'Walk-in Customer';

  function handleConfirm() {
    if (activeTab === 'cash') {
      onConfirm([{ mode: 'cash', amount: netPayable, reference: '' }], tendered, change);
    } else if (activeTab === 'upi') {
      onConfirm([{ mode: 'upi', amount: netPayable, reference: upiRef }], netPayable, 0);
    } else if (activeTab === 'card') {
      onConfirm([{ mode: 'card', amount: netPayable, reference: cardRef }], netPayable, 0);
    } else if (activeTab === 'post') {
      onConfirm([], 0, 0, true);
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
      : true; // upi, card, post — always confirmable

  // Quick cash amounts based on netPayable (already rounded)
  const quickAmounts = [
    netPayable,
    Math.ceil(netPayable / 10) * 10,
    Math.ceil(netPayable / 50) * 50,
    Math.ceil(netPayable / 100) * 100,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; hidden?: boolean }[] = [
    { id: 'cash',  label: 'Cash',  icon: <Banknote className="h-4 w-4" /> },
    { id: 'upi',   label: 'UPI',   icon: <Smartphone className="h-4 w-4" /> },
    { id: 'card',  label: 'Card',  icon: <CreditCard className="h-4 w-4" /> },
    { id: 'split', label: 'Split', icon: <Scissors className="h-4 w-4" /> },
    { id: 'post',  label: 'Post',  icon: <BookOpen className="h-4 w-4" />, hidden: !isRegisteredCustomer },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {tabs.filter((t) => !t.hidden).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? tab.id === 'post'
                    ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400 dark:border-orange-400'
                    : 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
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
                    {isRegisteredCustomer && <option value="lend">Lend</option>}
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
              {splitLines.some((l) => l.mode === 'lend' && parseFloat(l.amount) > 0) && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg px-3 py-2 text-xs text-orange-700 dark:text-orange-400">
                  Lent amount will be added to <span className="font-semibold">{customer?.name}</span>'s outstanding balance.
                </div>
              )}
            </div>
          )}

          {activeTab === 'post' && (
            <div className="space-y-4">
              {/* Info card */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Post Payment (Credit Sale)</p>
                </div>
                <p className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed">
                  No payment will be collected now. The full amount will be added to the customer's outstanding ledger balance and can be collected later.
                </p>
              </div>

              {/* Amount summary */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Amount to Ledger</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">₹{netPayable}</p>
                </div>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Invoice will be confirmed. Balance due will appear in party ledger.
              </p>
            </div>
          )}
        </div>

        {/* Confirm button */}
        <div className="px-5 pb-5">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={`w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition-colors ${
              activeTab === 'post'
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : activeTab === 'post' ? (
              <>
                <BookOpen className="h-5 w-5" />
                Post to Ledger
              </>
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
