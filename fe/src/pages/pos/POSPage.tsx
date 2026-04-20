import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  ShoppingCart, X, PauseCircle, Trash2, FileText, Printer,
  MessageSquare, WifiOff, Clock, Maximize2, Minimize2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/axios';
import { posApi } from '@/api/pos';
import { godownsApi } from '@/api/inventory';
import { companySettingsApi } from '@/api/settings';
import { thermalTemplatesApi } from '@/api/thermalTemplates';
import { salesInvoicesApi } from '@/api/sales';
import { render, openThermalPrintWindow } from '@/lib/thermalTemplateRenderer';
import type { CompanySettings } from '@/types';
import { calcGST, calcRoundOff, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import POSItemSearch from './POSItemSearch';
import POSCart from './POSCart';
import POSPaymentModal, { type PaymentEntry } from './POSPaymentModal';
import POSCustomerBar from './POSCustomerBar';
import POSHeldBills from './POSHeldBills';
import POSReprintPanel from './POSReprintPanel';
import type { Party, Godown, SalesInvoice } from '@/types';
import type { POSItem } from '@/api/pos';

export interface CartLine {
  id: string;          // unique cart line id
  itemId: string;
  name: string;
  rate: number;
  unit: string;
  gstRate: number;
  quantity: number;
  discountPct: number;
  batchId?: string | null;
  currentStock: number;
}

interface NegativeStockAlert {
  lineId: string;
  itemName: string;
  available: number;
  requested: number;
  resolve: (proceed: boolean) => void;
}

export default function POSPage() {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const user = useAuthStore((s) => s.user);
  const { hasPermission } = usePermissions();

  if (!hasPermission('pos.view')) {
    return <Navigate to="/" replace />;
  }

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Party | null>(null);
  const [godown, setGodown] = useState<Godown | null>(null);
  const [isInterState, setIsInterState] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [heldDrawer, setHeldDrawer] = useState(false);
  const [reprintPanel, setReprintPanel] = useState(false);
  const [heldRefresh, setHeldRefresh] = useState(0);
  const [heldCount, setHeldCount] = useState(0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<SalesInvoice | null>(null);
  const [successModal, setSuccessModal] = useState(false);
  const [negativeAlert, setNegativeAlert] = useState<NegativeStockAlert | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Load company settings (paper size, invoice template) on mount
  useEffect(() => {
    companySettingsApi.get().then((res) => {
      setCompanySettings(res.data.data ?? null);
    }).catch(() => {});
  }, []);

  // Load default godown on mount
  useEffect(() => {
    godownsApi.list().then((res) => {
      const list: Godown[] = res.data.data ?? [];
      const def = list.find((g) => g.is_default) ?? list[0] ?? null;
      setGodown(def);
    }).catch(() => {});
  }, []);

  // Load held count
  useEffect(() => {
    posApi.getHeld().then((res) => setHeldCount((res.data.data ?? []).length)).catch(() => {});
  }, [heldRefresh]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl+X → exit
      if (e.ctrlKey && e.key === 'x') {
        e.preventDefault();
        navigate('/');
        return;
      }
      // F2 → focus search
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      // Escape → close modals
      if (e.key === 'Escape') {
        if (paymentModal) { setPaymentModal(false); return; }
        if (heldDrawer) { setHeldDrawer(false); return; }
        if (reprintPanel) { setReprintPanel(false); return; }
        if (successModal) { setSuccessModal(false); return; }
      }
      // Ctrl+H → hold bill
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        if (cart.length > 0) handleHold();
        return;
      }
      // Ctrl+P → open reprint panel
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        setReprintPanel(true);
        return;
      }
      // Ctrl+Enter → open payment
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0) setPaymentModal(true);
        return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, paymentModal, heldDrawer, reprintPanel, successModal, navigate]);

  const grandTotal = cart.reduce((acc, line) => {
    const taxable = line.quantity * line.rate * (1 - line.discountPct / 100);
    const gst = calcGST(taxable, line.gstRate, isInterState);
    return acc + taxable + gst.cgst + gst.sgst + gst.igst;
  }, 0);
  const { roundOff, netPayable } = calcRoundOff(grandTotal);

  // Check stock and prompt if negative
  const checkAndSetQty = useCallback((lineId: string, newQty: number, stockAvailable: number, itemName: string): Promise<number> => {
    return new Promise((resolve) => {
      if (newQty > stockAvailable && stockAvailable >= 0) {
        setNegativeAlert({
          lineId,
          itemName,
          available: stockAvailable,
          requested: newQty,
          resolve: (proceed) => {
            setNegativeAlert(null);
            resolve(proceed ? newQty : stockAvailable > 0 ? stockAvailable : 1);
          },
        });
      } else {
        resolve(newQty);
      }
    });
  }, []);

  async function handleAddItem(item: POSItem) {
    const existing = cart.find((l) => l.itemId === item.id);
    if (existing) {
      const newQty = existing.quantity + 1;
      const finalQty = await checkAndSetQty(existing.id, newQty, item.current_stock, item.name);
      setCart((prev) => prev.map((l) => l.id === existing.id ? { ...l, quantity: finalQty } : l));
    } else {
      const newLine: CartLine = {
        id: crypto.randomUUID(),
        itemId: item.id,
        name: item.name,
        rate: item.selling_price ?? 0,
        unit: item.unit,
        gstRate: item.igst ?? 0,
        quantity: 1,
        discountPct: 0,
        batchId: null,
        currentStock: item.current_stock,
      };
      if (1 > item.current_stock && item.current_stock >= 0) {
        const finalQty = await checkAndSetQty(newLine.id, 1, item.current_stock, item.name);
        setCart((prev) => [...prev, { ...newLine, quantity: finalQty }]);
      } else {
        setCart((prev) => [...prev, newLine]);
      }
    }
  }

  async function handleQtyChange(id: string, qty: number) {
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    const finalQty = await checkAndSetQty(id, qty, line.currentStock, line.name);
    setCart((prev) => prev.map((l) => l.id === id ? { ...l, quantity: finalQty } : l));
  }

  function handleDiscChange(id: string, disc: number) {
    setCart((prev) => prev.map((l) => l.id === id ? { ...l, discountPct: disc } : l));
  }

  function handleRemove(id: string) {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }

  function handleClear() {
    setCart([]);
    setCustomer(null);
    setNotes('');
  }

  async function handleHold() {
    if (!godown) { toast.error('No godown configured'); return; }
    if (cart.length === 0) return;
    try {
      await posApi.hold({
        party_id: customer?.id ?? null,
        godown_id: godown.id,
        is_inter_state: isInterState,
        invoice_date: new Date().toISOString().slice(0, 10),
        notes,
        lines: cart.map((l) => ({
          item_id: l.itemId,
          batch_id: l.batchId,
          quantity: l.quantity,
          unit: l.unit,
          rate: l.rate,
          discount_percent: l.discountPct,
          gst_rate: l.gstRate,
        })),
      });
      setHeldRefresh((n) => n + 1);
      handleClear();
      toast.success('Bill held');
    } catch {
      toast.error('Failed to hold bill');
    }
  }

  function handleResumeHeld(invoice: SalesInvoice) {
    const lines: CartLine[] = (invoice.lines ?? []).map((l) => ({
      id: crypto.randomUUID(),
      itemId: l.item_id,
      name: l.item?.name ?? 'Item',
      rate: Number(l.rate),
      unit: l.unit ?? (l.item?.unit ?? ''),
      gstRate: Number(l.gst_rate),
      quantity: Number(l.quantity),
      discountPct: Number(l.discount_percent),
      batchId: l.batch_id ?? null,
      currentStock: 0,
    }));
    setCart(lines);
    if (invoice.party) setCustomer(invoice.party as Party);
    // Delete the held bill
    posApi.deleteHeld(invoice.id).then(() => setHeldRefresh((n) => n + 1)).catch(() => {});
    toast.success('Bill resumed');
  }

  async function handleCheckout(payments: PaymentEntry[], amountTendered: number, changeAmount: number, postPayment?: boolean) {
    if (!godown) { toast.error('No godown configured'); return; }
    setCheckoutLoading(true);
    try {
      const res = await posApi.checkout({
        party_id: customer?.id ?? null,
        godown_id: godown.id,
        is_inter_state: isInterState,
        invoice_date: new Date().toISOString().slice(0, 10),
        notes,
        round_off: roundOff,
        lines: cart.map((l) => ({
          item_id: l.itemId,
          batch_id: l.batchId,
          quantity: l.quantity,
          unit: l.unit,
          rate: l.rate,
          discount_percent: l.discountPct,
          gst_rate: l.gstRate,
        })),
        ...(postPayment ? { post_payment: true } : { payments, amount_tendered: amountTendered, change_amount: changeAmount }),
      });
      const inv = res.data.data;
      setLastInvoice(inv);
      setPaymentModal(false);
      setSuccessModal(true);
      handleClear();
    } catch {
      toast.error('Checkout failed. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handlePrint(invoiceId: string) {
    try {
      const paperSize = (companySettings?.thermal_printer_paper_size ?? '2inch') as '2inch' | '3inch';

      const [invoiceRes, templatesRes] = await Promise.all([
        salesInvoicesApi.get(invoiceId),
        thermalTemplatesApi.list({ per_page: 100 }),
      ]);

      const invoice = invoiceRes.data.data;
      const templates = (templatesRes.data as any)?.data ?? [];
      const customTemplate = templates.find(
        (t: any) => t.paper_size === paperSize && t.is_default,
      );

      let html: string;
      if (customTemplate && user?.company) {
        html = render(customTemplate.html_content, invoice, user.company, { paperSize });
      } else {
        // Fallback: built-in Blade template rendered by backend
        const res = await api.get(`/sales-invoices/${invoiceId}/html`, {
          params: { template: 'thermal', paper_size: paperSize },
          responseType: 'text',
        });
        html = res.data;
      }

      const win = openThermalPrintWindow(html, paperSize);
      if (!win) toast.error('Pop-up blocked. Please allow pop-ups for printing.');
    } catch {
      toast.error('Could not load receipt for printing');
    }
  }

  function handleWhatsApp(invoice: SalesInvoice) {
    // Build public share URL using the invoice's share_token
    const shareUrl = invoice.share_token
      ? `${window.location.origin}/api/v1/public/invoices/${invoice.share_token}`
      : null;

    // Round off for display
    const { netPayable } = calcRoundOff(Number(invoice.grand_total));

    const partyName = invoice.party?.name && invoice.party.name !== 'Walk-in Customer'
      ? invoice.party.name
      : null;

    const lines = [
      `🧾 *Invoice ${invoice.invoice_number}*`,
      partyName ? `Customer: ${partyName}` : null,
      `Amount: ₹${netPayable}`,
      `Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      shareUrl ? `\n📄 View & Download Invoice:\n${shareUrl}` : null,
      `\nThank you for your business! 🙏`,
    ].filter(Boolean).join('\n');

    const msg = encodeURIComponent(lines);

    // Pre-fill phone if customer has one (strip non-digits, add India country code)
    const rawPhone = invoice.party?.phone?.replace(/\D/g, '') ?? '';
    let waPhone = '';
    if (rawPhone.length === 10) {
      waPhone = `91${rawPhone}`;
    } else if (rawPhone.length === 12 && rawPhone.startsWith('91')) {
      waPhone = rawPhone;
    } else if (rawPhone.length === 11 && rawPhone.startsWith('0')) {
      waPhone = `91${rawPhone.slice(1)}`;
    }

    window.open(`https://wa.me/${waPhone}?text=${msg}`, '_blank');
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950 overflow-hidden select-none">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs text-center py-1 flex items-center justify-center gap-2">
          <WifiOff className="h-3 w-3" />
          Offline — billing continues, will sync when connected
        </div>
      )}

      {/* Top bar */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <ShoppingCart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">POS</span>
          {user?.company?.name && (
            <span className="hidden sm:block text-xs text-gray-400">— {user.company.name}</span>
          )}
        </div>

        {/* Customer bar */}
        <div className="flex-1 flex justify-center">
          <POSCustomerBar customer={customer} onCustomerChange={setCustomer} />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Inter-state toggle */}
          <button
            onClick={() => setIsInterState((v) => !v)}
            className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
              isInterState
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {isInterState ? 'Inter-state' : 'Intra-state'}
          </button>

          {/* Held bills button */}
          <button
            onClick={() => setHeldDrawer(true)}
            className="relative flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:block">Held</span>
            {heldCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {heldCount}
              </span>
            )}
          </button>

          {/* Cart item count badge */}
          {cart.length > 0 && (
            <span className="flex items-center gap-1 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full font-medium">
              <ShoppingCart className="h-3 w-3" />
              {cart.reduce((s, l) => s + l.quantity, 0)}
            </span>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2.5 py-1.5 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {/* Exit */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 dark:hover:text-red-400 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
            title="Exit POS (Ctrl+X)"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:block">Ctrl+X</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Item search */}
        <div className="flex-1 overflow-hidden bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
          <POSItemSearch
            godownId={godown?.id ?? ''}
            onAdd={handleAddItem}
            searchRef={searchRef}
          />
        </div>

        {/* RIGHT — Cart */}
        <div className="w-80 xl:w-96 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
          {/* Cart header */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Cart</span>
            {cart.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>

          {/* Cart lines + totals */}
          <div className="flex-1 overflow-hidden">
            <POSCart
              lines={cart}
              isInterState={isInterState}
              onQtyChange={handleQtyChange}
              onDiscChange={handleDiscChange}
              onRemove={handleRemove}
            />
          </div>

          {/* Cart bottom actions */}
          {cart.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex gap-1.5">
              <button
                onClick={handleHold}
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg px-2 py-1.5 transition-colors"
                title="Hold Bill (Ctrl+H)"
              >
                <PauseCircle className="h-3.5 w-3.5" />
                Hold
              </button>
              <button
                onClick={() => setShowNotes((v) => !v)}
                className={`flex items-center gap-1 text-xs border rounded-lg px-2 py-1.5 transition-colors ${
                  notes
                    ? 'border-indigo-300 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Notes
              </button>
              <button
                onClick={() => setReprintPanel(true)}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1.5 transition-colors"
                title="Reprint invoice (Ctrl+P)"
              >
                <Printer className="h-3.5 w-3.5" />
                Reprint
              </button>
            </div>
          )}

          {/* Notes textarea */}
          {showNotes && cart.length > 0 && (
            <div className="px-2 pb-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Order notes…"
                rows={2}
                className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none resize-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setPaymentModal(true)}
            disabled={cart.length === 0}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
          >
            <span>💵</span> Cash
          </button>
          <button
            onClick={() => setPaymentModal(true)}
            disabled={cart.length === 0}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
          >
            <span>📱</span> UPI
          </button>
          <button
            onClick={() => setPaymentModal(true)}
            disabled={cart.length === 0}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
          >
            <span>💳</span> Card
          </button>
          <button
            onClick={() => setPaymentModal(true)}
            disabled={cart.length === 0}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
          >
            <span>✂️</span> Split
          </button>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setReprintPanel(true)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl px-3 py-2 transition-colors"
          title="Reprint invoice (Ctrl+P)"
        >
          <Printer className="h-4 w-4" />
          Reprint
        </button>

        <button
          onClick={() => { if (cart.length > 0) setPaymentModal(true); }}
          disabled={cart.length === 0}
          className="flex items-center gap-3 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl px-6 py-3 text-base transition-colors"
          title="Checkout (Ctrl+Enter)"
        >
          <span>₹{netPayable}</span>
          <span className="text-green-200">→</span>
          <span>Checkout</span>
        </button>
      </div>

      {/* Payment modal */}
      {paymentModal && (
        <POSPaymentModal
          grandTotal={grandTotal}
          netPayable={netPayable}
          roundOff={roundOff}
          customer={customer}
          onConfirm={handleCheckout}
          onClose={() => setPaymentModal(false)}
          loading={checkoutLoading}
        />
      )}

      {/* Reprint panel */}
      <POSReprintPanel
        open={reprintPanel}
        onClose={() => setReprintPanel(false)}
        onPrint={handlePrint}
        onWhatsApp={handleWhatsApp}
      />

      {/* Held bills drawer */}
      <POSHeldBills
        open={heldDrawer}
        onClose={() => setHeldDrawer(false)}
        onResume={handleResumeHeld}
        refreshKey={heldRefresh}
      />

      {/* Success modal */}
      {successModal && lastInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sale Complete!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Invoice #{lastInvoice.invoice_number}
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
              {formatCurrency(Number(lastInvoice.grand_total))}
            </p>
            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={() => { handlePrint(lastInvoice.id); setSuccessModal(false); }}
                className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </button>
              <button
                onClick={() => { handleWhatsApp(lastInvoice); setSuccessModal(false); }}
                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Share on WhatsApp
              </button>
              <button
                onClick={() => setSuccessModal(false)}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-2 transition-colors"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Negative stock alert */}
      {negativeAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">⚠️</div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Low Stock</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <span className="font-medium">{negativeAlert.itemName}</span>: only{' '}
                  <span className="font-bold text-amber-600 dark:text-amber-400">{negativeAlert.available}</span>{' '}
                  unit{negativeAlert.available !== 1 ? 's' : ''} available.
                  You're adding{' '}
                  <span className="font-bold">{negativeAlert.requested}</span>.
                </p>
                <p className="text-xs text-gray-400 mt-1">Sell anyway to allow negative stock?</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => negativeAlert.resolve(false)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => negativeAlert.resolve(true)}
                className="flex-1 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors"
              >
                Sell Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
