import { useParams } from 'react-router-dom';
import { PAYMENT_TYPES, type VoucherTab } from './vouchers/types';
import { JournalVoucherForm } from './vouchers/JournalVoucherForm';
import { ContraVoucherForm } from './vouchers/ContraVoucherForm';
import { PaymentReceiptForm } from './vouchers/PaymentReceiptForm';
import { PaymentVoucherForm } from './vouchers/PaymentVoucherForm';

export default function VoucherEntryForm() {
  const { type } = useParams<{ type: VoucherTab }>();
  const voucherType = (type ?? 'journal') as VoucherTab;

  if (voucherType === 'payment') return <PaymentVoucherForm />;
  if (PAYMENT_TYPES.has(voucherType)) return <PaymentReceiptForm voucherType={voucherType} />;
  if (voucherType === 'contra') return <ContraVoucherForm />;
  return <JournalVoucherForm voucherType={voucherType} />;
}
